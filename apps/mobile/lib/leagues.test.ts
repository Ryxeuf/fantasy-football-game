import { describe, it, expect } from "vitest";
import {
  LEAGUE_STATUSES,
  LEAGUE_SEASON_STATUSES,
  filterLeaguesByStatus,
  formatLeagueStatusLabel,
  formatLeagueSeasonStatusLabel,
  formatLeagueRulesetLabel,
  isValidLeagueStatus,
  parseLeagueListResponse,
  parseLeagueDetailResponse,
  parseSeasonDetailResponse,
  parseStandingsResponse,
  type League,
} from "./leagues";

function makeLeague(overrides: Partial<League> = {}): League {
  return {
    id: "l1",
    name: "Ligue Test",
    description: null,
    creatorId: "u1",
    ruleset: "season_3",
    status: "open",
    isPublic: true,
    maxParticipants: 8,
    allowedRosters: null,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    forfeitPoints: -1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("LEAGUE_STATUSES", () => {
  it("lists the five league statuses in canonical order", () => {
    expect(LEAGUE_STATUSES).toEqual([
      "draft",
      "open",
      "in_progress",
      "completed",
      "archived",
    ]);
  });
});

describe("LEAGUE_SEASON_STATUSES", () => {
  it("lists the four season statuses", () => {
    expect(LEAGUE_SEASON_STATUSES).toEqual([
      "draft",
      "scheduled",
      "in_progress",
      "completed",
    ]);
  });
});

describe("isValidLeagueStatus", () => {
  it("accepts known statuses", () => {
    expect(isValidLeagueStatus("draft")).toBe(true);
    expect(isValidLeagueStatus("archived")).toBe(true);
  });

  it("rejects unknown or non-string values", () => {
    expect(isValidLeagueStatus("ouverte")).toBe(false);
    expect(isValidLeagueStatus(1)).toBe(false);
    expect(isValidLeagueStatus(null)).toBe(false);
  });
});

describe("formatLeagueStatusLabel", () => {
  it("returns French labels for each known status", () => {
    expect(formatLeagueStatusLabel("draft")).toBe("Brouillon");
    expect(formatLeagueStatusLabel("open")).toBe("Ouverte");
    expect(formatLeagueStatusLabel("in_progress")).toBe("En cours");
    expect(formatLeagueStatusLabel("completed")).toBe("Terminee");
    expect(formatLeagueStatusLabel("archived")).toBe("Archivee");
  });

  it("returns the raw value for unknown statuses", () => {
    expect(formatLeagueStatusLabel("pending")).toBe("pending");
  });
});

describe("formatLeagueSeasonStatusLabel", () => {
  it("returns French labels for each season status", () => {
    expect(formatLeagueSeasonStatusLabel("draft")).toBe("Brouillon");
    expect(formatLeagueSeasonStatusLabel("scheduled")).toBe("Planifiee");
    expect(formatLeagueSeasonStatusLabel("in_progress")).toBe("En cours");
    expect(formatLeagueSeasonStatusLabel("completed")).toBe("Terminee");
  });
});

describe("formatLeagueRulesetLabel", () => {
  it("maps season_2 and season_3 to human labels", () => {
    expect(formatLeagueRulesetLabel("season_2")).toBe("Saison 2");
    expect(formatLeagueRulesetLabel("season_3")).toBe("Saison 3");
  });

  it("echoes unknown rulesets", () => {
    expect(formatLeagueRulesetLabel("custom")).toBe("custom");
  });
});

describe("parseLeagueListResponse", () => {
  it("returns an empty list for empty input", () => {
    expect(parseLeagueListResponse(null)).toEqual([]);
    expect(parseLeagueListResponse({})).toEqual([]);
    expect(parseLeagueListResponse({ leagues: "not-array" })).toEqual([]);
  });

  it("parses a list of leagues with all fields", () => {
    const leagues = parseLeagueListResponse({
      leagues: [
        {
          id: "l1",
          name: "Ligue 1",
          description: "Ma ligue",
          creatorId: "u1",
          ruleset: "season_3",
          status: "open",
          isPublic: true,
          maxParticipants: 8,
          allowedRosters: ["skaven", "dwarves"],
          winPoints: 3,
          drawPoints: 1,
          lossPoints: 0,
          forfeitPoints: -1,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ],
    });
    expect(leagues).toHaveLength(1);
    expect(leagues[0].name).toBe("Ligue 1");
    expect(leagues[0].allowedRosters).toEqual(["skaven", "dwarves"]);
    expect(leagues[0].winPoints).toBe(3);
  });

  it("fills missing numeric fields with safe defaults", () => {
    const leagues = parseLeagueListResponse({
      leagues: [
        {
          id: "l1",
          name: "Ligue minimale",
          creatorId: "u1",
          ruleset: "season_3",
          status: "draft",
        },
      ],
    });
    expect(leagues[0].maxParticipants).toBe(0);
    expect(leagues[0].winPoints).toBe(0);
    expect(leagues[0].description).toBeNull();
    expect(leagues[0].allowedRosters).toBeNull();
  });

  it("drops invalid entries silently", () => {
    const leagues = parseLeagueListResponse({
      leagues: [
        null,
        { name: "Sans id" },
        {
          id: "ok",
          name: "Ligue OK",
          creatorId: "u1",
          ruleset: "season_3",
          status: "open",
        },
      ],
    });
    expect(leagues).toHaveLength(1);
    expect(leagues[0].id).toBe("ok");
  });
});

describe("filterLeaguesByStatus", () => {
  const leagues = [
    makeLeague({ id: "l1", status: "draft" }),
    makeLeague({ id: "l2", status: "open" }),
    makeLeague({ id: "l3", status: "in_progress" }),
    makeLeague({ id: "l4", status: "completed" }),
    makeLeague({ id: "l5", status: "archived" }),
  ];

  it("returns all leagues for 'all'", () => {
    expect(filterLeaguesByStatus(leagues, "all")).toHaveLength(5);
  });

  it("filters to a specific status", () => {
    expect(filterLeaguesByStatus(leagues, "in_progress").map((l) => l.id)).toEqual(
      ["l3"],
    );
  });

  it("returns empty when no league matches", () => {
    const filtered = filterLeaguesByStatus([], "open");
    expect(filtered).toEqual([]);
  });
});

describe("parseLeagueDetailResponse", () => {
  it("returns null when league is missing", () => {
    expect(parseLeagueDetailResponse(null)).toBeNull();
    expect(parseLeagueDetailResponse({})).toBeNull();
  });

  it("extracts league and seasons", () => {
    const detail = parseLeagueDetailResponse({
      league: {
        id: "l1",
        name: "Ligue",
        creatorId: "u1",
        creator: { id: "u1", coachName: "Alice", email: "alice@test" },
        ruleset: "season_3",
        status: "in_progress",
        isPublic: true,
        maxParticipants: 8,
        allowedRosters: null,
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        forfeitPoints: -1,
        description: null,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
        seasons: [
          {
            id: "s1",
            seasonNumber: 1,
            name: "Saison 1",
            status: "in_progress",
            startDate: null,
            endDate: null,
          },
        ],
      },
    });
    expect(detail?.id).toBe("l1");
    expect(detail?.seasons).toHaveLength(1);
    expect(detail?.seasons[0].seasonNumber).toBe(1);
  });

  it("defaults seasons to empty array when missing", () => {
    const detail = parseLeagueDetailResponse({
      league: {
        id: "l1",
        name: "Ligue sans saisons",
        creatorId: "u1",
        ruleset: "season_3",
        status: "draft",
      },
    });
    expect(detail?.seasons).toEqual([]);
  });
});

describe("parseSeasonDetailResponse", () => {
  it("returns null for empty input", () => {
    expect(parseSeasonDetailResponse(null)).toBeNull();
    expect(parseSeasonDetailResponse({})).toBeNull();
  });

  it("extracts rounds and participants with defaults", () => {
    const season = parseSeasonDetailResponse({
      season: {
        id: "s1",
        seasonNumber: 1,
        name: "Saison 1",
        status: "in_progress",
        startDate: null,
        endDate: null,
        leagueId: "l1",
        rounds: [
          { id: "r1", roundNumber: 1, name: null, status: "pending" },
        ],
        participants: [
          {
            id: "p1",
            seasonElo: 1500,
            status: "active",
            teamId: "t1",
            team: {
              id: "t1",
              name: "Team 1",
              roster: "skaven",
              owner: { id: "u1", coachName: "Alice" },
            },
          },
        ],
      },
    });
    expect(season?.rounds).toHaveLength(1);
    expect(season?.participants).toHaveLength(1);
    expect(season?.participants[0].team.name).toBe("Team 1");
  });

  it("defaults rounds and participants to empty arrays", () => {
    const season = parseSeasonDetailResponse({
      season: {
        id: "s1",
        seasonNumber: 1,
        name: "Saison 1",
        status: "draft",
        leagueId: "l1",
      },
    });
    expect(season?.rounds).toEqual([]);
    expect(season?.participants).toEqual([]);
  });
});

describe("parseStandingsResponse", () => {
  it("returns an empty list when input is empty", () => {
    expect(parseStandingsResponse(null)).toEqual([]);
    expect(parseStandingsResponse({})).toEqual([]);
  });

  it("extracts standings with numeric coercion and defaults", () => {
    const standings = parseStandingsResponse({
      seasonId: "s1",
      standings: [
        {
          teamId: "t1",
          points: 9,
          wins: 3,
          draws: 0,
          losses: 0,
          goalsFor: 12,
          goalsAgainst: 3,
        },
        { teamId: "t2", points: 1, wins: 0, draws: 1, losses: 2 },
      ],
    });
    expect(standings).toHaveLength(2);
    expect(standings[0].teamId).toBe("t1");
    expect(standings[0].points).toBe(9);
    expect(standings[1].goalsFor).toBe(0);
    expect(standings[1].goalsAgainst).toBe(0);
  });

  it("drops entries missing a teamId", () => {
    const standings = parseStandingsResponse({
      standings: [{ points: 3 }, { teamId: "ok", points: 1 }],
    });
    expect(standings).toHaveLength(1);
    expect(standings[0].teamId).toBe("ok");
  });
});
