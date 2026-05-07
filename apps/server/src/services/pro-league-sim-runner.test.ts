/**
 * Sprint Pro League lot 1.A.4 — Tests du Pro League sim runner.
 *
 * Couvre :
 *  - simulateProMatch : match introuvable, idempotence sur statuts
 *    finaux, ProTeam slug invalide, simulation OK + persist Replay,
 *    erreur sim → status `failed`.
 *  - simulateUpcomingMatches : aucun match → 0/0, fenêtre 24h
 *    respectée, agrégation des compteurs simulated/skipped/failed,
 *    isolation des erreurs (un fail n'arrête pas le batch).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    replay: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@bb/sim-engine", async () => {
  const actual = await vi.importActual<typeof import("@bb/sim-engine")>(
    "@bb/sim-engine",
  );
  return {
    ...actual,
    // simulateMatch sera mocké individuellement par test ; default
    // utilise la vraie implémentation pour vérifier le pipe complet.
  };
});

import { prisma } from "../prisma";
import * as simEngine from "@bb/sim-engine";

import {
  simulateProMatch,
  simulateUpcomingMatches,
} from "./pro-league-sim-runner";

interface MockedPrisma {
  proLeagueMatch: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  replay: { upsert: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;

const MATCH_ID = "match_abc123";

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_ID,
    status: "scheduled",
    homeTeam: { slug: "pit-smashers", name: "Smashers" },
    awayTeam: { slug: "kc-soaring-hawks", name: "Soaring Hawks" },
    season: { engineVer: "0.13.0" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
    fn(prisma),
  );
});

describe("simulateProMatch — sprint 1.A.4", () => {
  it("erreur si le match n'existe pas", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expect(simulateProMatch(MATCH_ID)).rejects.toThrow(/introuvable/);
  });

  it("idempotent : skip si status = 'ready'", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      makeMatch({ status: "ready" }),
    );
    const out = await simulateProMatch(MATCH_ID);
    expect(out).toBe(false);
    expect(mocked.replay.upsert).not.toHaveBeenCalled();
    expect(mocked.proLeagueMatch.update).not.toHaveBeenCalled();
  });

  it("idempotent : skip si status = 'completed'", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      makeMatch({ status: "completed" }),
    );
    const out = await simulateProMatch(MATCH_ID);
    expect(out).toBe(false);
  });

  it("erreur si slug ProTeam introuvable dans race-profiles", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      makeMatch({
        homeTeam: { slug: "unknown-slug", name: "Foo" },
      }),
    );
    await expect(simulateProMatch(MATCH_ID)).rejects.toThrow(/race-profiles/);
  });

  it("simule + persiste Replay + update Match (pipeline complet)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    mocked.replay.upsert.mockResolvedValue({});
    mocked.proLeagueMatch.update.mockResolvedValue({});

    const out = await simulateProMatch(MATCH_ID);

    expect(out).toBe(true);
    expect(mocked.replay.upsert).toHaveBeenCalledTimes(1);
    expect(mocked.proLeagueMatch.update).toHaveBeenCalledTimes(1);

    // Vérifie quelques champs clés du upsert Replay.
    const replayCall = mocked.replay.upsert.mock.calls[0][0];
    expect(replayCall.where.matchId).toBe(MATCH_ID);
    expect(replayCall.create.matchId).toBe(MATCH_ID);
    expect(Buffer.isBuffer(replayCall.create.payload)).toBe(true);
    expect(replayCall.create.durationMs).toBeGreaterThan(0);
    expect(replayCall.create.rawJsonSize).toBeGreaterThan(0);
    expect(Array.isArray(replayCall.create.highlights)).toBe(true);

    // Vérifie le update du match.
    const updateCall = mocked.proLeagueMatch.update.mock.calls[0][0];
    expect(updateCall.where.id).toBe(MATCH_ID);
    expect(updateCall.data.status).toBe("ready");
    expect(updateCall.data.replayId).toBe(MATCH_ID);
    expect(updateCall.data.engineVer).toBe("0.13.0");
    expect(typeof updateCall.data.seed).toBe("bigint");
    expect(["home", "away", "draw"]).toContain(updateCall.data.outcome);
    expect(typeof updateCall.data.scoreHome).toBe("number");
    expect(typeof updateCall.data.scoreAway).toBe("number");
  });

  it("seed déterministe : 2 appels successifs produisent le même résultat", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    mocked.replay.upsert.mockResolvedValue({});
    mocked.proLeagueMatch.update.mockResolvedValue({});

    await simulateProMatch(MATCH_ID);
    const seed1 = mocked.proLeagueMatch.update.mock.calls[0][0].data.seed;

    vi.clearAllMocks();
    mocked.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => fn(prisma),
    );
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    mocked.replay.upsert.mockResolvedValue({});
    mocked.proLeagueMatch.update.mockResolvedValue({});

    await simulateProMatch(MATCH_ID);
    const seed2 = mocked.proLeagueMatch.update.mock.calls[0][0].data.seed;

    expect(seed1).toBe(seed2);
  });

  it("refuse de simuler si la saison est pinnée à un autre engineVer", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      makeMatch({ season: { id: "s1", engineVer: "9.99.99-pinned" } }),
    );

    await expect(simulateProMatch(MATCH_ID)).rejects.toThrow(
      /Engine version mismatch/,
    );
    expect(mocked.replay.upsert).not.toHaveBeenCalled();
    // Le match n'est PAS marqué `failed` — un mismatch n'est pas un
    // échec de sim mais un refus de policy.
    expect(mocked.proLeagueMatch.update).not.toHaveBeenCalled();
  });

  it("refuse de re-simuler un match déjà sim avec un autre engineVer", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(
      makeMatch({
        status: "failed",
        engineVer: "9.99.99-old",
      }),
    );

    await expect(simulateProMatch(MATCH_ID)).rejects.toThrow(
      /Engine version mismatch/,
    );
  });

  it("marque le match 'failed' si simulateMatch throw", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(makeMatch());
    const spy = vi
      .spyOn(simEngine, "simulateMatch")
      .mockImplementationOnce(() => {
        throw new Error("boom");
      });
    mocked.proLeagueMatch.update.mockResolvedValue({});

    await expect(simulateProMatch(MATCH_ID)).rejects.toThrow(/boom/);

    expect(mocked.proLeagueMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MATCH_ID },
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(mocked.replay.upsert).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("simulateUpcomingMatches — sprint 1.A.4", () => {
  it("renvoie zéros si aucun match dans la fenêtre", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    const out = await simulateUpcomingMatches();
    expect(out).toEqual({
      simulated: 0,
      skipped: 0,
      failed: 0,
      versionMismatched: 0,
      inspected: 0,
    });
  });

  it("fenêtre par défaut 24h (gte now, lte now+24h)", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    const now = new Date("2026-09-08T12:00:00Z");
    await simulateUpcomingMatches({ now });

    const where = mocked.proLeagueMatch.findMany.mock.calls[0][0].where;
    expect(where.status).toBe("scheduled");
    expect(where.scheduledAt.gte).toEqual(now);
    expect(where.scheduledAt.lte).toEqual(new Date("2026-09-09T12:00:00Z"));
  });

  it("agrège correctement simulated / skipped / failed", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      { id: "m1" },
      { id: "m2" },
      { id: "m3" },
    ]);
    // m1 : déjà ready (skip)
    // m2 : sim OK
    // m3 : sim throw → failed
    mocked.proLeagueMatch.findUnique.mockImplementation(({ where }) => {
      if (where.id === "m1") {
        return Promise.resolve(makeMatch({ id: "m1", status: "ready" }));
      }
      return Promise.resolve(makeMatch({ id: where.id }));
    });
    mocked.replay.upsert.mockResolvedValue({});
    mocked.proLeagueMatch.update.mockResolvedValue({});

    let simCallIdx = 0;
    const spy = vi
      .spyOn(simEngine, "simulateMatch")
      .mockImplementation((input) => {
        simCallIdx += 1;
        if (simCallIdx === 2) {
          throw new Error("boom on m3");
        }
        // m2 : passe par la vraie sim.
        const real = vi.importActual<typeof import("@bb/sim-engine")>(
          "@bb/sim-engine",
        );
        // sync fallback pour le test : juste retourner un faux résultat.
        return {
          result: "home",
          events: [],
          summary: {
            outcome: "home",
            score: { home: 2, away: 1 },
            turnoverCount: 5,
            touchdownCount: 3,
            nuffleCount: 1,
            underdogBoostCount: 0,
            durationMs: 480_000,
            momentum: [],
          },
          casualties: [],
          engineVer: "0.13.0",
        };
      });

    const out = await simulateUpcomingMatches();

    expect(out.inspected).toBe(3);
    expect(out.skipped).toBe(1);
    expect(out.simulated).toBe(1);
    expect(out.failed).toBe(1);
    spy.mockRestore();
  });

  it("respecte maxBatchSize", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await simulateUpcomingMatches({ maxBatchSize: 5 });
    const args = mocked.proLeagueMatch.findMany.mock.calls[0][0];
    expect(args.take).toBe(5);
  });
});
