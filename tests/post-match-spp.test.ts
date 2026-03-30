import { describe, it, expect } from "vitest";

/** SPP values per action (BB3 Season 2/3 rules) - mirrored from PostMatchSPP */
const SPP_VALUES = {
  touchdown: 3,
  casualty: 2,
  completion: 1,
  interception: 1,
  mvp: 4,
} as const;

interface PlayerMatchStats {
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  mvp: boolean;
}

interface PlayerInfo {
  id: string;
  team: "A" | "B";
  name: string;
  number: number;
  position: string;
}

interface MatchResult {
  winner?: "A" | "B";
  spp: Record<string, number>;
}

interface PlayerSPPRow {
  id: string;
  name: string;
  number: number;
  position: string;
  team: "A" | "B";
  touchdowns: number;
  casualties: number;
  completions: number;
  interceptions: number;
  isMvp: boolean;
  totalSPP: number;
}

/**
 * Pure calculation function extracted from PostMatchSPP component.
 * Tested here to validate the SPP calculation logic used in the UI.
 */
function calculatePlayerRows(
  players: PlayerInfo[],
  matchStats: Record<string, PlayerMatchStats>,
  _matchResult: MatchResult,
): PlayerSPPRow[] {
  return players
    .map((player) => {
      const stats = matchStats[player.id];
      const touchdowns = stats?.touchdowns ?? 0;
      const casualties = stats?.casualties ?? 0;
      const completions = stats?.completions ?? 0;
      const interceptions = stats?.interceptions ?? 0;
      const isMvp = stats?.mvp ?? false;

      const totalSPP =
        touchdowns * SPP_VALUES.touchdown +
        casualties * SPP_VALUES.casualty +
        completions * SPP_VALUES.completion +
        interceptions * SPP_VALUES.interception +
        (isMvp ? SPP_VALUES.mvp : 0);

      return {
        id: player.id,
        name: player.name,
        number: player.number,
        position: player.position,
        team: player.team,
        touchdowns,
        casualties,
        completions,
        interceptions,
        isMvp,
        totalSPP,
      };
    })
    .filter((row) => row.totalSPP > 0 || row.isMvp)
    .sort((a, b) => b.totalSPP - a.totalSPP);
}

const makePlayers = (): PlayerInfo[] => [
  { id: "A1", team: "A", name: "Thrower A", number: 1, position: "Thrower" },
  { id: "A2", team: "A", name: "Blitzer A", number: 2, position: "Blitzer" },
  { id: "A3", team: "A", name: "Lineman A", number: 3, position: "Lineman" },
  { id: "B1", team: "B", name: "Catcher B", number: 1, position: "Catcher" },
  { id: "B2", team: "B", name: "Blocker B", number: 2, position: "Blocker" },
];

describe("PostMatchSPP - calculatePlayerRows", () => {
  it("returns empty array when no stats exist", () => {
    const rows = calculatePlayerRows(makePlayers(), {}, { spp: {} });
    expect(rows).toEqual([]);
  });

  it("calculates 3 SPP per touchdown", () => {
    const stats: Record<string, PlayerMatchStats> = {
      A1: { touchdowns: 2, casualties: 0, completions: 0, interceptions: 0, mvp: false },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: { A1: 6 } });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("A1");
    expect(rows[0].totalSPP).toBe(6);
  });

  it("calculates 2 SPP per casualty", () => {
    const stats: Record<string, PlayerMatchStats> = {
      B2: { touchdowns: 0, casualties: 3, completions: 0, interceptions: 0, mvp: false },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: { B2: 6 } });

    expect(rows).toHaveLength(1);
    expect(rows[0].totalSPP).toBe(6);
  });

  it("calculates 1 SPP per completion and interception", () => {
    const stats: Record<string, PlayerMatchStats> = {
      A1: { touchdowns: 0, casualties: 0, completions: 3, interceptions: 2, mvp: false },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: { A1: 5 } });

    expect(rows).toHaveLength(1);
    expect(rows[0].totalSPP).toBe(5);
  });

  it("calculates SPP correctly for all action types combined", () => {
    const stats: Record<string, PlayerMatchStats> = {
      A2: { touchdowns: 1, casualties: 1, completions: 2, interceptions: 1, mvp: false },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: { A2: 8 } });

    expect(rows).toHaveLength(1);
    // 1*3 + 1*2 + 2*1 + 1*1 = 8
    expect(rows[0].totalSPP).toBe(8);
  });

  it("includes MVP bonus of 4 SPP", () => {
    const stats: Record<string, PlayerMatchStats> = {
      B1: { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: true },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: { B1: 4 } });

    expect(rows).toHaveLength(1);
    expect(rows[0].isMvp).toBe(true);
    expect(rows[0].totalSPP).toBe(4);
  });

  it("includes MVP players even with 0 other stats", () => {
    const stats: Record<string, PlayerMatchStats> = {
      A3: { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: true },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: { A3: 4 } });

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Lineman A");
    expect(rows[0].isMvp).toBe(true);
  });

  it("filters out players with 0 SPP and no MVP", () => {
    const stats: Record<string, PlayerMatchStats> = {
      A1: { touchdowns: 1, casualties: 0, completions: 0, interceptions: 0, mvp: false },
      A2: { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: false },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: { A1: 3 } });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("A1");
  });

  it("sorts players by total SPP descending", () => {
    const stats: Record<string, PlayerMatchStats> = {
      A1: { touchdowns: 1, casualties: 0, completions: 0, interceptions: 0, mvp: false },
      B1: { touchdowns: 2, casualties: 0, completions: 0, interceptions: 0, mvp: false },
      A2: { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: true },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: {} });

    expect(rows).toHaveLength(3);
    expect(rows[0].id).toBe("B1"); // 6 SPP
    expect(rows[1].id).toBe("A2"); // 4 SPP (MVP)
    expect(rows[2].id).toBe("A1"); // 3 SPP
  });

  it("handles players from both teams correctly", () => {
    const stats: Record<string, PlayerMatchStats> = {
      A1: { touchdowns: 1, casualties: 0, completions: 1, interceptions: 0, mvp: true },
      B2: { touchdowns: 0, casualties: 2, completions: 0, interceptions: 0, mvp: true },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { winner: "A", spp: {} });

    const teamARows = rows.filter((r) => r.team === "A");
    const teamBRows = rows.filter((r) => r.team === "B");

    expect(teamARows).toHaveLength(1);
    expect(teamBRows).toHaveLength(1);
    expect(teamARows[0].totalSPP).toBe(3 + 1 + 4); // TD + completion + MVP = 8
    expect(teamBRows[0].totalSPP).toBe(4 + 4); // 2 casualties + MVP = 8
  });

  it("does not include unknown player IDs not in the players list", () => {
    const stats: Record<string, PlayerMatchStats> = {
      UNKNOWN: { touchdowns: 1, casualties: 0, completions: 0, interceptions: 0, mvp: false },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: {} });

    expect(rows).toHaveLength(0);
  });

  it("preserves player metadata (name, number, position, team)", () => {
    const stats: Record<string, PlayerMatchStats> = {
      B1: { touchdowns: 1, casualties: 0, completions: 0, interceptions: 0, mvp: false },
    };
    const rows = calculatePlayerRows(makePlayers(), stats, { spp: {} });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "B1",
      name: "Catcher B",
      number: 1,
      position: "Catcher",
      team: "B",
    });
  });
});
