/**
 * Tests pour le service SPP / progression (Lot 3.C.2).
 *
 * Couvre :
 *   - `attributeSpp` (pure) : depuis SimResult + replay events,
 *     determine les rewards par playerId (TD, CAS, COMP, MVP).
 *   - `applyMatchSpp` (I/O) : idempotent via `sppAppliedAt`, lit le
 *     replay, ecrit les compteurs et `spp` cumulatif.
 *   - `sweepMatchSpp` : cron-like, status='ready'|'completed'.
 *
 * Le service est entierement decouple du casualty applier : meme
 * pattern, fichier separe, idempotence independante.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Audit round 4 : `applyMatchSpp` wrap maintenant les updates rosters
// + update sppAppliedAt dans une seule $transaction. On simule en
// partageant les memes mocks entre prisma top-level et le `tx` du
// callback.
vi.mock("../prisma", () => {
  const proLeagueMatch = { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() };
  const proTeamRoster = { findMany: vi.fn(), update: vi.fn() };
  return {
    prisma: {
      proLeagueMatch,
      replay: { findUnique: vi.fn() },
      proTeamRoster,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn(async (cb: any) =>
        cb({ proLeagueMatch, proTeamRoster }),
      ),
    },
  };
});

vi.mock("@bb/sim-engine", () => ({
  decompressEvents: vi.fn(),
}));

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";
import {
  applyMatchSpp,
  attributeSpp,
  SppApplicationError,
  sweepMatchSpp,
  SPP_VALUES,
} from "./pro-roster-spp";

interface MockedPrisma {
  proLeagueMatch: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  replay: { findUnique: ReturnType<typeof vi.fn> };
  proTeamRoster: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
}
const mocked = prisma as unknown as MockedPrisma;
const mockedDecompress = vi.mocked(decompressEvents);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proLeagueMatch.update.mockResolvedValue({});
  mocked.proTeamRoster.update.mockResolvedValue({});
  // Re-attache le comportement par defaut du $transaction (clearAllMocks
  // l'a vide).
  mocked.$transaction.mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (cb: any) =>
      cb({
        proLeagueMatch: mocked.proLeagueMatch,
        proTeamRoster: mocked.proTeamRoster,
      }),
  );
});

describe("SPP_VALUES — Lot 3.C.2", () => {
  it("respecte la table BB officielle", () => {
    expect(SPP_VALUES).toEqual({
      td: 3,
      cas: 2,
      comp: 1,
      mvp: 4,
    });
  });
});

describe("attributeSpp — Lot 3.C.2", () => {
  function realCuid(suffix: string): string {
    // CUIDs canoniques font 25 char ; on en genere des plausibles pour
    // les tests sans imposer la regex stricte.
    return `c${suffix.padEnd(24, "0")}`;
  }

  it("PASS success non-handoff avec passerId reel attribue 1 SPP comp", () => {
    const passerA = realCuid("passer1");
    // Roster home a 2 joueurs pour rendre la chance MVP=passer = 50%.
    // Le test assert uniquement compCount (independant du MVP).
    const out = attributeSpp({
      seed: 1,
      events: [
        {
          type: "PASS",
          meta: {
            passerId: passerA,
            range: "short",
            success: true,
          },
        },
      ],
      casualties: [],
      homeRosterIds: new Set([passerA, realCuid("home2")]),
      awayRosterIds: new Set([realCuid("away1")]),
    });
    const reward = out.rewards.find((r) => r.rosterId === passerA);
    expect(reward).toBeDefined();
    expect(reward?.compCount).toBe(1);
  });

  it("HANDOFF n'attribue pas de completion (BB rules)", () => {
    const passerA = realCuid("passer2");
    const out = attributeSpp({
      seed: 1,
      events: [
        {
          type: "PASS",
          meta: { passerId: passerA, range: "handoff", success: true },
        },
      ],
      casualties: [],
      homeRosterIds: new Set([passerA, realCuid("home2")]),
      awayRosterIds: new Set([realCuid("away1")]),
    });
    const reward = out.rewards.find((r) => r.rosterId === passerA);
    // Soit absent (n'a pas eu MVP), soit present avec compCount=0.
    expect(reward?.compCount ?? 0).toBe(0);
  });

  it("PASS échouée (success=false) n'attribue rien", () => {
    const passerA = realCuid("passer3");
    const out = attributeSpp({
      seed: 1,
      events: [
        {
          type: "PASS",
          meta: { passerId: passerA, range: "short", success: false },
        },
      ],
      casualties: [],
      homeRosterIds: new Set([passerA, realCuid("home2")]),
      awayRosterIds: new Set([realCuid("away1")]),
    });
    const reward = out.rewards.find((r) => r.rosterId === passerA);
    expect(reward?.compCount ?? 0).toBe(0);
  });

  it("synthetic passerId (home-1) ne reçoit pas de SPP comp (pas un CUID reel)", () => {
    const homeReal = realCuid("home1");
    const awayReal = realCuid("away1");
    const out = attributeSpp({
      seed: 1,
      events: [
        {
          type: "PASS",
          meta: { passerId: "home-3", range: "short", success: true },
        },
      ],
      casualties: [],
      homeRosterIds: new Set([homeReal]),
      awayRosterIds: new Set([awayReal]),
    });
    // Aucun reward de type comp (pas de joueur reel) ; seuls les MVPs.
    expect(out.rewards.every((r) => r.compCount === 0)).toBe(true);
    expect(out.rewards.filter((r) => r.mvpCount === 1)).toHaveLength(2);
  });

  it("casualty avec causedById reel sur le bon side attribue 2 SPP cas", () => {
    const killer = realCuid("killer1");
    const victim = realCuid("victim1");
    const out = attributeSpp({
      seed: 1,
      events: [],
      casualties: [
        {
          playerId: victim,
          team: "home",
          causedById: killer,
          outcome: "badly_hurt",
        },
      ],
      homeRosterIds: new Set([victim]),
      awayRosterIds: new Set([killer]),
    });
    const reward = out.rewards.find((r) => r.rosterId === killer);
    expect(reward?.casCount).toBe(1);
    expect(reward?.totalSpp).toBeGreaterThanOrEqual(SPP_VALUES.cas);
  });

  it("MVP : 4 SPP exactement à 1 joueur par team (deterministe via seed)", () => {
    const homeIds = ["a", "b", "c"].map(realCuid);
    const awayIds = ["x", "y", "z"].map(realCuid);
    const out = attributeSpp({
      seed: 42,
      events: [],
      casualties: [],
      homeRosterIds: new Set(homeIds),
      awayRosterIds: new Set(awayIds),
    });
    const mvps = out.rewards.filter((r) => r.mvpCount === 1);
    expect(mvps).toHaveLength(2);
    expect(mvps.some((r) => homeIds.includes(r.rosterId))).toBe(true);
    expect(mvps.some((r) => awayIds.includes(r.rosterId))).toBe(true);
  });

  it("MVP deterministe : meme seed -> meme MVP", () => {
    const homeIds = ["a", "b", "c"].map(realCuid);
    const awayIds = ["x", "y", "z"].map(realCuid);
    const a = attributeSpp({
      seed: 99,
      events: [],
      casualties: [],
      homeRosterIds: new Set(homeIds),
      awayRosterIds: new Set(awayIds),
    });
    const b = attributeSpp({
      seed: 99,
      events: [],
      casualties: [],
      homeRosterIds: new Set(homeIds),
      awayRosterIds: new Set(awayIds),
    });
    expect(a.rewards).toEqual(b.rewards);
  });

  it("Lot 3.C.3 — TD avec scorerId reel attribue 3 SPP td au porteur", () => {
    const scorer = realCuid("scorer1");
    const out = attributeSpp({
      seed: 1,
      events: [
        {
          type: "TD",
          meta: { team: "home", scorerId: scorer, scoreAfter: { home: 1, away: 0 } },
        },
      ],
      casualties: [],
      homeRosterIds: new Set([scorer, realCuid("home2")]),
      awayRosterIds: new Set([realCuid("away1")]),
    });
    const reward = out.rewards.find((r) => r.rosterId === scorer);
    expect(reward?.tdCount).toBe(1);
    // Au moins 3 SPP du TD ; le MVP peut s'ajouter (4 de plus).
    expect(reward?.totalSpp).toBeGreaterThanOrEqual(SPP_VALUES.td);
  });

  it("Lot 3.C.3 — TD sans scorerId (hybrid driver / state corrompu) -> pas d'attribution", () => {
    const out = attributeSpp({
      seed: 1,
      events: [
        {
          type: "TD",
          meta: { team: "home", scoreAfter: { home: 1, away: 0 } }, // pas de scorerId
        },
      ],
      casualties: [],
      homeRosterIds: new Set([realCuid("home1"), realCuid("home2")]),
      awayRosterIds: new Set([realCuid("away1")]),
    });
    expect(out.rewards.every((r) => r.tdCount === 0)).toBe(true);
  });

  it("Lot 3.C.3 — TD avec scorerId synthetique -> pas d'attribution", () => {
    const out = attributeSpp({
      seed: 1,
      events: [
        {
          type: "TD",
          meta: { team: "home", scorerId: "home-3" },
        },
      ],
      casualties: [],
      homeRosterIds: new Set([realCuid("home1")]),
      awayRosterIds: new Set([realCuid("away1")]),
    });
    expect(out.rewards.every((r) => r.tdCount === 0)).toBe(true);
  });

  it("agrege multi-source : MVP + 2 completions sur le meme joueur", () => {
    const star = realCuid("star1");
    const out = attributeSpp({
      seed: 7,
      events: [
        {
          type: "PASS",
          meta: { passerId: star, range: "short", success: true },
        },
        {
          type: "PASS",
          meta: { passerId: star, range: "long", success: true },
        },
      ],
      casualties: [],
      homeRosterIds: new Set([star]),
      awayRosterIds: new Set([realCuid("away1")]),
    });
    const reward = out.rewards.find((r) => r.rosterId === star);
    expect(reward?.compCount).toBe(2);
    if (reward?.mvpCount === 1) {
      expect(reward.totalSpp).toBe(2 * SPP_VALUES.comp + SPP_VALUES.mvp);
    } else {
      expect(reward?.totalSpp).toBe(2 * SPP_VALUES.comp);
    }
  });

  it("rosters vides : aucun MVP attribue, aucun reward", () => {
    const out = attributeSpp({
      seed: 1,
      events: [],
      casualties: [],
      homeRosterIds: new Set(),
      awayRosterIds: new Set(),
    });
    expect(out.rewards).toEqual([]);
  });
});

describe("applyMatchSpp — Lot 3.C.2", () => {
  async function expectCode(p: Promise<unknown>, code: string) {
    try {
      await p;
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(SppApplicationError);
      expect((err as SppApplicationError).code).toBe(code);
    }
  }

  it("MATCH_NOT_FOUND", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expectCode(applyMatchSpp("missing"), "MATCH_NOT_FOUND");
  });

  it("MATCH_NOT_READY (status='scheduled' refuse)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "scheduled",
      sppAppliedAt: null,
      seed: BigInt(1),
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: null,
    });
    await expectCode(applyMatchSpp("m1"), "MATCH_NOT_READY");
  });

  it("idempotent : skip si sppAppliedAt non null", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "ready",
      sppAppliedAt: new Date(),
      seed: BigInt(1),
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m1",
    });
    const out = await applyMatchSpp("m1");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("already_applied");
    expect(mocked.replay.findUnique).not.toHaveBeenCalled();
  });

  it("REPLAY_NOT_FOUND si replay absent", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "ready",
      sppAppliedAt: null,
      seed: BigInt(1),
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m1",
    });
    mocked.replay.findUnique.mockResolvedValue(null);
    await expectCode(applyMatchSpp("m1"), "REPLAY_NOT_FOUND");
  });

  it("met a jour spp + compCount + mvpCount sur le bon roster", async () => {
    const passer = "ckpasser000000000000000abc";
    const homePlayer2 = "ckhome222222222222222abc";
    const awayPlayer = "ckaway1111111111111111abc";

    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m_real",
      status: "ready",
      sppAppliedAt: null,
      seed: BigInt(1234),
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m_real",
    });
    mocked.replay.findUnique.mockResolvedValue({
      payload: Buffer.from([]),
    });
    mocked.proTeamRoster.findMany
      .mockResolvedValueOnce([
        { id: passer, name: "Passer", spp: 5, compCount: 0, mvpCount: 0 },
        { id: homePlayer2, name: "Other", spp: 0, compCount: 0, mvpCount: 0 },
      ])
      .mockResolvedValueOnce([
        { id: awayPlayer, name: "Away", spp: 0, compCount: 0, mvpCount: 0 },
      ]);
    mockedDecompress.mockResolvedValue([
      {
        type: "PASS",
        meta: { passerId: passer, range: "short", success: true },
      },
    ] as never);

    const out = await applyMatchSpp("m_real");
    expect(out.skipped).toBe(false);
    expect(out.affected).toBeGreaterThanOrEqual(1);
    // Le passer reçoit forcement 1 SPP comp (et potentiellement MVP).
    const passerUpdate = (
      mocked.proTeamRoster.update as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      ([call]: Array<{ where: { id: string } }>) => call.where.id === passer,
    );
    expect(passerUpdate).toBeDefined();
    expect(mocked.proLeagueMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sppAppliedAt: expect.any(Date) }),
      }),
    );
  });

  it("no-op silencieux + marque applied si rosters vides", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m_empty",
      status: "ready",
      sppAppliedAt: null,
      seed: BigInt(1),
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m_empty",
    });
    mocked.replay.findUnique.mockResolvedValue({ payload: Buffer.from([]) });
    mocked.proTeamRoster.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockedDecompress.mockResolvedValue([] as never);
    const out = await applyMatchSpp("m_empty");
    expect(out.affected).toBe(0);
    expect(mocked.proLeagueMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sppAppliedAt: expect.any(Date) }),
      }),
    );
  });
});

describe("sweepMatchSpp — Lot 3.C.2", () => {
  it("0/0/0 si rien", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    expect(await sweepMatchSpp()).toEqual({
      inspected: 0,
      processed: 0,
      failed: 0,
    });
  });

  it("filtre status IN ['ready','completed'] et isTest=false", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await sweepMatchSpp();
    expect(mocked.proLeagueMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ready", "completed"] },
          sppAppliedAt: null,
          isTest: false,
        }),
      }),
    );
  });

  it("agrege processed + failed", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      { id: "m1" },
      { id: "m2" },
    ]);
    mocked.proLeagueMatch.findUnique
      .mockResolvedValueOnce(null) // m1 -> failed
      .mockResolvedValueOnce({
        id: "m2",
        status: "ready",
        sppAppliedAt: null,
        seed: BigInt(1),
        homeTeamId: "th",
        awayTeamId: "ta",
        replayId: "m2",
      });
    mocked.replay.findUnique.mockResolvedValue({ payload: Buffer.from([]) });
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    mockedDecompress.mockResolvedValue([] as never);

    const out = await sweepMatchSpp();
    expect(out.inspected).toBe(2);
    expect(out.processed).toBe(1);
    expect(out.failed).toBe(1);
  });
});
