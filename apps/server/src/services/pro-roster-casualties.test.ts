import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    replay: { findUnique: vi.fn() },
    proTeamRoster: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@bb/sim-engine", () => ({
  decompressEvents: vi.fn(),
}));

import { prisma } from "../prisma";
import { decompressEvents } from "@bb/sim-engine";
import {
  CasualtyApplicationError,
  applyMatchCasualties,
  countCasualtiesPerSide,
  rollCasualtyOutcome,
  sweepMatchCasualties,
} from "./pro-roster-casualties";

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
}
const mocked = prisma as unknown as MockedPrisma;
const mockedDecompress = vi.mocked(decompressEvents);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proLeagueMatch.update.mockResolvedValue({});
  mocked.proTeamRoster.update.mockResolvedValue({});
});

describe("rollCasualtyOutcome — sprint 1.E.4", () => {
  it("table de probabilités respectée", () => {
    expect(rollCasualtyOutcome(0)).toBe("niggling");
    expect(rollCasualtyOutcome(0.49)).toBe("niggling");
    expect(rollCasualtyOutcome(0.5)).toBe("ma_minus_1");
    expect(rollCasualtyOutcome(0.74)).toBe("ma_minus_1");
    expect(rollCasualtyOutcome(0.75)).toBe("st_minus_1");
    expect(rollCasualtyOutcome(0.86)).toBe("st_minus_1");
    expect(rollCasualtyOutcome(0.87)).toBe("av_minus_1");
    expect(rollCasualtyOutcome(0.94)).toBe("av_minus_1");
    expect(rollCasualtyOutcome(0.95)).toBe("dead");
    expect(rollCasualtyOutcome(0.99)).toBe("dead");
  });
});

describe("countCasualtiesPerSide — sprint 1.E.4", () => {
  it("compte par préfixe playerId", () => {
    const events = [
      { type: "CASUALTY", meta: { playerId: "home-LOS" } },
      { type: "CASUALTY", meta: { playerId: "away-LOS" } },
      { type: "CASUALTY", meta: { playerId: "home-NUFFLE-1-3" } },
      { type: "TD", meta: { team: "home" } },
      { type: "CASUALTY", meta: { playerId: "weird" } },
    ];
    expect(countCasualtiesPerSide(events)).toEqual({ home: 2, away: 1 });
  });

  it("ignore events non-CASUALTY ou sans meta valide", () => {
    expect(countCasualtiesPerSide([])).toEqual({ home: 0, away: 0 });
    expect(
      countCasualtiesPerSide([{ type: "CASUALTY" }, { type: "CASUALTY", meta: null }]),
    ).toEqual({ home: 0, away: 0 });
  });
});

describe("applyMatchCasualties — sprint 1.E.4", () => {
  async function expectCode(p: Promise<unknown>, code: string) {
    try {
      await p;
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(CasualtyApplicationError);
      expect((err as CasualtyApplicationError).code).toBe(code);
    }
  }

  it("MATCH_NOT_FOUND", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expectCode(applyMatchCasualties("m1"), "MATCH_NOT_FOUND");
  });

  it("MATCH_NOT_COMPLETED", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "scheduled",
      casualtiesAppliedAt: null,
      casualtyCount: 0,
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: null,
    });
    await expectCode(applyMatchCasualties("m1"), "MATCH_NOT_COMPLETED");
  });

  it("idempotent : skip si casualtiesAppliedAt non null", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "completed",
      casualtiesAppliedAt: new Date(),
      casualtyCount: 2,
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m1",
    });
    const out = await applyMatchCasualties("m1");
    expect(out.skipped).toBe(true);
    expect(out.skipReason).toBe("already_applied");
    expect(out.affected).toBe(0);
    expect(mocked.replay.findUnique).not.toHaveBeenCalled();
  });

  it("skip 'no_casualties' si casualtyCount=0 et marque applied", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "completed",
      casualtiesAppliedAt: null,
      casualtyCount: 0,
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m1",
    });
    const out = await applyMatchCasualties("m1");
    expect(out.skipReason).toBe("no_casualties");
    expect(mocked.proLeagueMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ casualtiesAppliedAt: expect.any(Date) }),
      }),
    );
  });

  it("REPLAY_NOT_FOUND si replay manquant", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "completed",
      casualtiesAppliedAt: null,
      casualtyCount: 2,
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m1",
    });
    mocked.replay.findUnique.mockResolvedValue(null);
    await expectCode(applyMatchCasualties("m1"), "REPLAY_NOT_FOUND");
  });

  it("no-op silencieux si roster vide (cas MVP courant)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m1",
      status: "completed",
      casualtiesAppliedAt: null,
      casualtyCount: 2,
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m1",
    });
    mocked.replay.findUnique.mockResolvedValue({
      payload: Buffer.from([]),
    });
    mockedDecompress.mockResolvedValue([
      { type: "CASUALTY", meta: { playerId: "home-LOS" } },
      { type: "CASUALTY", meta: { playerId: "away-LOS" } },
    ] as never);
    mocked.proTeamRoster.findMany.mockResolvedValue([]);
    const out = await applyMatchCasualties("m1");
    expect(out.skipped).toBe(false);
    expect(out.affected).toBe(0);
    expect(out.homeCasualties).toBe(1);
    expect(out.awayCasualties).toBe(1);
    expect(mocked.proLeagueMatch.update).toHaveBeenCalled();
  });

  it("applique outcomes aléatoires sur roster non vide (déterministe)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({
      id: "m_match_1",
      status: "completed",
      casualtiesAppliedAt: null,
      casualtyCount: 2,
      homeTeamId: "th",
      awayTeamId: "ta",
      replayId: "m_match_1",
    });
    mocked.replay.findUnique.mockResolvedValue({ payload: Buffer.from([]) });
    mockedDecompress.mockResolvedValue([
      { type: "CASUALTY", meta: { playerId: "home-LOS" } },
      { type: "CASUALTY", meta: { playerId: "away-LOS" } },
    ] as never);
    // 11 joueurs côté home et away
    const homeRoster = Array.from({ length: 11 }, (_, i) => ({
      id: `h${i}`,
      name: `H${i}`,
      niggling: 0,
      maReduction: 0,
      stReduction: 0,
      avReduction: 0,
    }));
    const awayRoster = Array.from({ length: 11 }, (_, i) => ({
      id: `a${i}`,
      name: `A${i}`,
      niggling: 0,
      maReduction: 0,
      stReduction: 0,
      avReduction: 0,
    }));
    mocked.proTeamRoster.findMany
      .mockResolvedValueOnce(homeRoster)
      .mockResolvedValueOnce(awayRoster);

    const out = await applyMatchCasualties("m_match_1");
    expect(out.skipped).toBe(false);
    expect(out.affected).toBe(2);
    expect(out.outcomes).toHaveLength(2);
    expect(out.outcomes[0].side).toBe("home");
    expect(out.outcomes[1].side).toBe("away");
    expect(mocked.proTeamRoster.update).toHaveBeenCalledTimes(2);
    expect(mocked.proLeagueMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          casualtiesAppliedAt: expect.any(Date),
        }),
      }),
    );
  });
});

describe("sweepMatchCasualties — sprint 1.E.4", () => {
  it("0/0/0 si rien", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    expect(await sweepMatchCasualties()).toEqual({
      inspected: 0,
      processed: 0,
      failed: 0,
    });
  });

  it("agrège processed + failed", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    mocked.proLeagueMatch.findUnique
      .mockResolvedValueOnce(null) // m1 → MATCH_NOT_FOUND → failed
      .mockResolvedValueOnce({
        id: "m2",
        status: "completed",
        casualtiesAppliedAt: null,
        casualtyCount: 0,
        homeTeamId: "th",
        awayTeamId: "ta",
        replayId: "m2",
      });
    const out = await sweepMatchCasualties();
    expect(out.inspected).toBe(2);
    expect(out.processed).toBe(1);
    expect(out.failed).toBe(1);
  });
});
