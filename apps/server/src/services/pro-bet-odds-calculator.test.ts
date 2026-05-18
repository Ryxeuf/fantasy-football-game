import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findUnique: vi.fn() },
    proBetMarket: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@bb/sim-engine", async () => {
  const actual = await vi.importActual<typeof import("@bb/sim-engine")>(
    "@bb/sim-engine",
  );
  return {
    ...actual,
    simulateMatch: vi.fn(),
  };
});

import { prisma } from "../prisma";
import * as simEngine from "@bb/sim-engine";

import {
  ProMatchNotReadyForOddsError,
  computeMarketsForMatch,
  createOrRefreshMarketsForMatch,
} from "./pro-bet-odds-calculator";

interface MockedPrisma {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  proBetMarket: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

const mocked = prisma as unknown as MockedPrisma;

const MATCH_ID = "m_1";

const FAKE_MATCH = {
  id: MATCH_ID,
  scheduledAt: new Date("2026-09-15T21:00:00Z"),
  status: "scheduled",
  homeTeam: { slug: "pit-smashers", name: "Smashers" },
  awayTeam: { slug: "kc-soaring-hawks", name: "Soaring Hawks" },
};

function buildSimResult(overrides: {
  outcome: "home" | "away" | "draw";
  td?: number;
  cas?: number;
  nuffle?: number;
}): unknown {
  return {
    result: overrides.outcome,
    events: [],
    summary: {
      outcome: overrides.outcome,
      score: { home: 0, away: 0 },
      turnoverCount: 0,
      touchdownCount: overrides.td ?? 2,
      nuffleCount: overrides.nuffle ?? 0,
      underdogBoostCount: 0,
      durationMs: 1000,
      momentum: [],
    },
    casualties: Array(overrides.cas ?? 0).fill({
      playerId: "x",
      team: "A",
      outcome: "badly_hurt",
    }),
    engineVer: "0.13.0",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proLeagueMatch.findUnique.mockResolvedValue(FAKE_MATCH);
});

describe("computeMarketsForMatch — sprint 1.D.3", () => {
  it("rejette runs <= 0", async () => {
    await expect(
      computeMarketsForMatch(MATCH_ID, { runs: 0 }),
    ).rejects.toThrow(/runs/);
    await expect(
      computeMarketsForMatch(MATCH_ID, { runs: -5 }),
    ).rejects.toThrow(/runs/);
  });

  it("erreur si match introuvable", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expect(computeMarketsForMatch(MATCH_ID)).rejects.toThrow(
      ProMatchNotReadyForOddsError,
    );
  });

  it("calcule 4 markets : 1X2 + OU TD + CAS + NUFFLE", async () => {
    // Deterministic sim : 60% home win, 20% draw, 20% away win
    let i = 0;
    vi.spyOn(simEngine, "simulateMatch").mockImplementation(() => {
      i += 1;
      const o: "home" | "away" | "draw" =
        i <= 60 ? "home" : i <= 80 ? "draw" : "away";
      return buildSimResult({
        outcome: o,
        td: 3, // > 2.5 → over
        cas: 1, // > 0.5 → over
        nuffle: 1, // ≥1 → yes
      }) as ReturnType<typeof simEngine.simulateMatch>;
    });

    const out = await computeMarketsForMatch(MATCH_ID, {
      runs: 100,
      houseMargin: 0,
    });

    expect(out).toHaveLength(4);
    expect(out[0].type).toBe("ONE_X_TWO");
    expect(out[1].type).toBe("OVER_UNDER_TD");
    expect(out[2].type).toBe("CAS_COUNT");
    expect(out[3].type).toBe("NUFFLE_OCCURS");

    // Avec marge 0 et p_home=0.6 → cote home ≈ 1/0.6 = 1.667
    const oneXTwo = out[0].config as {
      homeOdds: number;
      drawOdds: number;
      awayOdds: number;
    };
    expect(oneXTwo.homeOdds).toBeCloseTo(1.67, 1);
    expect(oneXTwo.drawOdds).toBeCloseTo(5, 0);
    expect(oneXTwo.awayOdds).toBeCloseTo(5, 0);

    // 100% over (td=3 > 2.5 partout) → odds over = MIN_DECIMAL_ODDS (1.05)
    const ou = out[1].config as { line: number; overOdds: number; underOdds: number };
    expect(ou.line).toBe(2.5);
    expect(ou.overOdds).toBe(1.05);

    // 100% nuffle yes
    const nuffle = out[3].config as { yesOdds: number; noOdds: number };
    expect(nuffle.yesOdds).toBe(1.05);
  });

  it("respecte les options tdLine + casLine + houseMargin", async () => {
    vi.spyOn(simEngine, "simulateMatch").mockImplementation(
      () =>
        buildSimResult({
          outcome: "home",
          td: 1, // sous 0.5 et sous 1.5
          cas: 0,
          nuffle: 0,
        }) as ReturnType<typeof simEngine.simulateMatch>,
    );

    const out = await computeMarketsForMatch(MATCH_ID, {
      runs: 50,
      tdLine: 0.5,
      casLine: 0.5,
    });

    const ou = out[1].config as { line: number };
    expect(ou.line).toBe(0.5);
    const cas = out[2].config as { line: number };
    expect(cas.line).toBe(0.5);
  });

  describe("audit round 4 — driverKind + roster", () => {
    it("hybrid (default) : ne charge pas les rosters et passe driverKind='hybrid'", async () => {
      const simSpy = vi
        .spyOn(simEngine, "simulateMatch")
        .mockReturnValue(
          buildSimResult({ outcome: "home", td: 2, cas: 0, nuffle: 0 }) as ReturnType<
            typeof simEngine.simulateMatch
          >,
        );
      mocked.proLeagueMatch.findUnique.mockResolvedValue({
        ...FAKE_MATCH,
        driverKindOverride: null,
        homeTeam: { id: "ht1", slug: "pit-smashers", name: "Smashers" },
        awayTeam: { id: "at1", slug: "kc-soaring-hawks", name: "Soaring Hawks" },
        season: { driverKind: "hybrid" },
      });

      await computeMarketsForMatch(MATCH_ID, { runs: 1, houseMargin: 0 });

      expect(simSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          home: expect.objectContaining({ roster: undefined }),
          away: expect.objectContaining({ roster: undefined }),
        }),
        { driverKind: "hybrid" },
      );
    });

    it("full driver : charge les rosters des 2 teams et passe driverKind='full'", async () => {
      const simSpy = vi
        .spyOn(simEngine, "simulateMatch")
        .mockReturnValue(
          buildSimResult({ outcome: "home", td: 2, cas: 0, nuffle: 0 }) as ReturnType<
            typeof simEngine.simulateMatch
          >,
        );
      mocked.proLeagueMatch.findUnique.mockResolvedValue({
        ...FAKE_MATCH,
        driverKindOverride: null,
        homeTeam: { id: "ht1", slug: "pit-smashers", name: "Smashers" },
        awayTeam: { id: "at1", slug: "kc-soaring-hawks", name: "Soaring Hawks" },
        season: { driverKind: "full" },
      });
      // Le test n'a pas mock proTeamRoster.findMany dans la fixture
      // de test top-level — on l'ajoute en ad-hoc via le mocked.
      const rosterRow = {
        id: "p1",
        name: "Player 1",
        position: "Lineman",
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).proTeamRoster = {
        findMany: vi.fn().mockResolvedValue([rosterRow]),
      };

      await computeMarketsForMatch(MATCH_ID, { runs: 1, houseMargin: 0 });

      expect(simSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          home: expect.objectContaining({
            roster: expect.arrayContaining([
              expect.objectContaining({ id: "p1", name: "Player 1" }),
            ]),
          }),
          away: expect.objectContaining({
            roster: expect.arrayContaining([
              expect.objectContaining({ id: "p1" }),
            ]),
          }),
        }),
        { driverKind: "full" },
      );
    });

    it("match.driverKindOverride='full' a precedence sur season.driverKind='hybrid'", async () => {
      const simSpy = vi
        .spyOn(simEngine, "simulateMatch")
        .mockReturnValue(
          buildSimResult({ outcome: "home", td: 2, cas: 0, nuffle: 0 }) as ReturnType<
            typeof simEngine.simulateMatch
          >,
        );
      mocked.proLeagueMatch.findUnique.mockResolvedValue({
        ...FAKE_MATCH,
        driverKindOverride: "full",
        homeTeam: { id: "ht1", slug: "pit-smashers", name: "Smashers" },
        awayTeam: { id: "at1", slug: "kc-soaring-hawks", name: "Soaring Hawks" },
        season: { driverKind: "hybrid" },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (prisma as any).proTeamRoster = {
        findMany: vi.fn().mockResolvedValue([]),
      };

      await computeMarketsForMatch(MATCH_ID, { runs: 1, houseMargin: 0 });

      expect(simSpy).toHaveBeenCalledWith(
        expect.anything(),
        { driverKind: "full" },
      );
    });
  });
});

describe("createOrRefreshMarketsForMatch — sprint 1.D.3", () => {
  beforeEach(() => {
    vi.spyOn(simEngine, "simulateMatch").mockImplementation(
      () =>
        buildSimResult({
          outcome: "home",
          td: 2,
          cas: 1,
          nuffle: 0,
        }) as ReturnType<typeof simEngine.simulateMatch>,
    );
  });

  it("erreur si match completed", async () => {
    mocked.proLeagueMatch.findUnique
      .mockResolvedValueOnce({ ...FAKE_MATCH, status: "completed" });
    await expect(
      createOrRefreshMarketsForMatch(MATCH_ID),
    ).rejects.toThrow(/status/);
  });

  it("crée 4 markets si rien n'existe", async () => {
    mocked.proBetMarket.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.create.mockResolvedValue({});

    const out = await createOrRefreshMarketsForMatch(MATCH_ID, { runs: 5 });
    expect(out.created).toBe(4);
    expect(out.updated).toBe(0);
    expect(mocked.proBetMarket.create).toHaveBeenCalledTimes(4);
  });

  it("update les markets existants", async () => {
    mocked.proBetMarket.findUnique.mockResolvedValue({
      id: "existing",
      status: "open",
    });
    mocked.proBetMarket.update.mockResolvedValue({});

    const out = await createOrRefreshMarketsForMatch(MATCH_ID, { runs: 5 });
    expect(out.created).toBe(0);
    expect(out.updated).toBe(4);
  });

  it("skip les markets settled (audit immutable)", async () => {
    mocked.proBetMarket.findUnique.mockResolvedValue({
      id: "settled1",
      status: "settled",
    });
    mocked.proBetMarket.update.mockResolvedValue({});
    mocked.proBetMarket.create.mockResolvedValue({});

    const out = await createOrRefreshMarketsForMatch(MATCH_ID, { runs: 5 });
    expect(out.created).toBe(0);
    expect(out.updated).toBe(0);
    expect(mocked.proBetMarket.update).not.toHaveBeenCalled();
    expect(mocked.proBetMarket.create).not.toHaveBeenCalled();
  });

  it("closesAt = scheduledAt du match", async () => {
    mocked.proBetMarket.findUnique.mockResolvedValue(null);
    mocked.proBetMarket.create.mockResolvedValue({});

    await createOrRefreshMarketsForMatch(MATCH_ID, { runs: 5 });

    const call = mocked.proBetMarket.create.mock.calls[0][0];
    expect(call.data.closesAt).toEqual(FAKE_MATCH.scheduledAt);
    expect(call.data.matchId).toBe(MATCH_ID);
    expect(call.data.status).toBe("open");
  });
});
