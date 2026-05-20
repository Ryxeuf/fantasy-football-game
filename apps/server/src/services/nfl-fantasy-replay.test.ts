import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflSeason: { findUnique: vi.fn() },
    nflFantasyEntry: { create: vi.fn(), findMany: vi.fn() },
    nflGameStat: { findMany: vi.fn() },
  },
}));

vi.mock("./nfl-fantasy-league", () => ({
  createLeague: vi.fn(),
}));

vi.mock("./nfl-fantasy-draft", () => ({
  autoFillRosters: vi.fn(),
  finalizeLeague: vi.fn(),
}));

vi.mock("./nfl-fantasy-roster", () => ({
  getRosterWithPlayers: vi.fn(),
}));

vi.mock("./nfl-fantasy-lineup", () => ({
  setLineup: vi.fn(),
  lockLineups: vi.fn(),
}));

vi.mock("./nfl-fantasy-scoring", () => ({
  generateMatchups: vi.fn(),
  settleNflFantasyWeek: vi.fn(),
}));

import { prisma } from "../prisma";
import { createLeague } from "./nfl-fantasy-league";
import { autoFillRosters, finalizeLeague } from "./nfl-fantasy-draft";
import { getRosterWithPlayers } from "./nfl-fantasy-roster";
import { lockLineups, setLineup } from "./nfl-fantasy-lineup";
import {
  generateMatchups,
  settleNflFantasyWeek,
} from "./nfl-fantasy-scoring";
import {
  NflFantasyReplayError,
  replaySeason,
} from "./nfl-fantasy-replay";

beforeEach(() => {
  vi.resetAllMocks();
});

function setupHappyPath(): void {
  vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({
    id: "2024",
  } as never);
  vi.mocked(createLeague).mockResolvedValue({
    id: "league-replay-1",
    entries: [{ id: "E1", userId: "owner", teamName: "owner" }],
  } as never);
  vi.mocked(prisma.nflFantasyEntry.create).mockResolvedValue({} as never);
  vi.mocked(autoFillRosters).mockResolvedValue({
    leagueId: "league-replay-1",
    entriesFilled: 2,
    playersAssigned: 30,
    playersPerEntry: 15,
  } as never);
  vi.mocked(finalizeLeague).mockResolvedValue({
    leagueId: "league-replay-1",
  } as never);
  vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
    { id: "E1", userId: "owner", joinedAt: new Date(2024, 0, 1) },
    { id: "E2", userId: "team1", joinedAt: new Date(2024, 0, 2) },
  ] as never);
  vi.mocked(getRosterWithPlayers).mockResolvedValue(
    Array.from({ length: 15 }, (_, i) => ({
      player: { id: `P${i}`, bbPosition: "Lineman" },
    })) as never,
  );
  vi.mocked(setLineup).mockResolvedValue({} as never);
  vi.mocked(generateMatchups).mockResolvedValue({} as never);
  vi.mocked(lockLineups).mockResolvedValue({ locked: 2 } as never);
  vi.mocked(settleNflFantasyWeek).mockResolvedValue({} as never);
}

describe("replaySeason - validation", () => {
  it("throw INVALID_TEAM_COUNT pour teamCount < 2", async () => {
    await expect(
      replaySeason({ seasonId: "2024", teamCount: 1 }),
    ).rejects.toMatchObject({ code: "INVALID_TEAM_COUNT" });
  });

  it("throw INVALID_TEAM_COUNT pour teamCount > 16", async () => {
    await expect(
      replaySeason({ seasonId: "2024", teamCount: 99 }),
    ).rejects.toMatchObject({ code: "INVALID_TEAM_COUNT" });
  });

  it("throw INVALID_WEEK_RANGE pour from > to", async () => {
    await expect(
      replaySeason({ seasonId: "2024", fromWeek: 10, toWeek: 5 }),
    ).rejects.toMatchObject({ code: "INVALID_WEEK_RANGE" });
  });

  it("throw INVALID_WEEK_RANGE pour week > 22", async () => {
    await expect(
      replaySeason({ seasonId: "2024", toWeek: 25 }),
    ).rejects.toMatchObject({ code: "INVALID_WEEK_RANGE" });
  });

  it("throw SEASON_NOT_FOUND si saison absente", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValueOnce(
      null as never,
    );
    await expect(replaySeason({ seasonId: "9999" })).rejects.toBeInstanceOf(
      NflFantasyReplayError,
    );
  });
});

describe("replaySeason - happy path", () => {
  it("orchestre createLeague + autoFill + finalize + boucle weeks", async () => {
    setupHappyPath();

    const out = await replaySeason({
      seasonId: "2024",
      teamCount: 2,
      fromWeek: 1,
      toWeek: 3,
    });

    expect(out.leagueId).toBe("league-replay-1");
    expect(out.weeksSettled).toBe(3);
    expect(out.weeksFailed).toBe(0);
    expect(out.errors).toEqual([]);

    // Verifie le flow : createLeague + 1 entry create (teamCount=2 → 1
    // additionnelle) + autoFill + finalize + 3 settle
    expect(createLeague).toHaveBeenCalledOnce();
    expect(prisma.nflFantasyEntry.create).toHaveBeenCalledTimes(1);
    expect(autoFillRosters).toHaveBeenCalledOnce();
    expect(finalizeLeague).toHaveBeenCalledOnce();
    expect(settleNflFantasyWeek).toHaveBeenCalledTimes(3);
    expect(lockLineups).toHaveBeenCalledTimes(3);
  });

  it("creé teamCount-1 entries additionnelles", async () => {
    setupHappyPath();
    await replaySeason({ seasonId: "2024", teamCount: 8, toWeek: 1 });
    expect(prisma.nflFantasyEntry.create).toHaveBeenCalledTimes(7);
  });

  it("collecte les erreurs par week sans arreter la boucle", async () => {
    setupHappyPath();
    vi.mocked(settleNflFantasyWeek)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("settle failed W2"))
      .mockResolvedValueOnce({} as never);

    const out = await replaySeason({
      seasonId: "2024",
      teamCount: 2,
      fromWeek: 1,
      toWeek: 3,
    });

    expect(out.weeksSettled).toBe(2);
    expect(out.weeksFailed).toBe(1);
    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]?.weekNumber).toBe(2);
  });

  it("throw si roster < 11 joueurs", async () => {
    setupHappyPath();
    vi.mocked(getRosterWithPlayers).mockResolvedValueOnce([
      { player: { id: "P0", bbPosition: "Lineman" } },
    ] as never);

    const out = await replaySeason({
      seasonId: "2024",
      teamCount: 2,
      fromWeek: 1,
      toWeek: 1,
    });
    expect(out.weeksFailed).toBe(1);
    expect(out.errors[0]?.error).toMatch(/seulement 1 joueurs/);
  });

  it("appelle onProgress pour chaque week", async () => {
    setupHappyPath();
    const events: Array<{ w: number; s: string }> = [];
    await replaySeason({
      seasonId: "2024",
      teamCount: 2,
      fromWeek: 1,
      toWeek: 2,
      onProgress: (w, status) => events.push({ w, s: status }),
    });
    expect(events).toEqual([
      { w: 1, s: "settled" },
      { w: 2, s: "settled" },
    ]);
  });
});

describe("replaySeason - lineupMode optimal", () => {
  it("pick les 11 top SPP earners du roster pour chaque week", async () => {
    setupHappyPath();
    // Roster de 15 joueurs P0..P14. Mock NflGameStat pour que les
    // joueurs IMPAIRS aient SPP=100 et les PAIRS SPP=10. On attend
    // que setLineup recoive les impairs en priorite.
    vi.mocked(getRosterWithPlayers).mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        player: { id: `P${i}`, bbPosition: "Lineman" },
      })) as never,
    );
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        playerId: `P${i}`,
        computedSpp: i % 2 === 1 ? 100 : 10,
      })) as never,
    );

    await replaySeason({
      seasonId: "2024",
      teamCount: 2,
      fromWeek: 1,
      toWeek: 1,
      lineupMode: "optimal",
    });

    // 2 entries × 1 week = 2 calls
    expect(setLineup).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(setLineup).mock.calls[0]![0];
    const starters = firstCall.starters as Array<{
      playerId: string;
      bbPosition: string;
    }>;
    expect(starters).toHaveLength(11);
    // Les 7 impairs (P1,P3,P5,P7,P9,P11,P13) doivent etre dans les 11
    // premiers (rang 1-7), puis suivis de 4 pairs.
    const oddCount = starters.filter((s) =>
      Number(s.playerId.slice(1)) % 2 === 1,
    ).length;
    expect(oddCount).toBe(7);
    // Captain = top earner = un impair
    expect(Number(firstCall.captainId!.slice(1)) % 2).toBe(1);
  });

  it("default = first11 (ordre roster preserve)", async () => {
    setupHappyPath();
    await replaySeason({
      seasonId: "2024",
      teamCount: 2,
      fromWeek: 1,
      toWeek: 1,
    });
    expect(setLineup).toHaveBeenCalledTimes(2);
    const firstCall = vi.mocked(setLineup).mock.calls[0]![0];
    const starters = firstCall.starters as Array<{
      playerId: string;
      bbPosition: string;
    }>;
    // Ordre roster = P0..P10
    expect(starters.map((s) => s.playerId)).toEqual(
      Array.from({ length: 11 }, (_, i) => `P${i}`),
    );
    // Pas de query NflGameStat en mode first11
    expect(prisma.nflGameStat.findMany).not.toHaveBeenCalled();
  });

  it("expose lineupMode dans le resultat", async () => {
    setupHappyPath();
    vi.mocked(prisma.nflGameStat.findMany).mockResolvedValue([] as never);
    const out = await replaySeason({
      seasonId: "2024",
      teamCount: 2,
      toWeek: 1,
      lineupMode: "optimal",
    });
    expect(out.lineupMode).toBe("optimal");
  });
});
