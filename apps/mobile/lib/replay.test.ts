import { describe, it, expect } from "vitest";
import {
  REPLAY_SPEED_OPTIONS,
  REPLAY_DEFAULT_SPEED_MS,
  clampFrameIndex,
  nextFrameIndex,
  prevFrameIndex,
  getMoveLabel,
  formatTeamsTitle,
  parseReplayResponse,
  formatMatchDate,
  type ReplayResponse,
  type ReplayTeamMeta,
} from "./replay";

function makeTeam(overrides: Partial<ReplayTeamMeta> = {}): ReplayTeamMeta {
  return {
    coachName: "Coach",
    teamName: "Team",
    roster: "Human",
    ...overrides,
  };
}

describe("clampFrameIndex", () => {
  it("returns 0 when the list is empty", () => {
    expect(clampFrameIndex(5, 0)).toBe(0);
    expect(clampFrameIndex(-1, 0)).toBe(0);
  });

  it("clamps to the valid [0, length-1] range", () => {
    expect(clampFrameIndex(-3, 5)).toBe(0);
    expect(clampFrameIndex(0, 5)).toBe(0);
    expect(clampFrameIndex(4, 5)).toBe(4);
    expect(clampFrameIndex(99, 5)).toBe(4);
  });
});

describe("nextFrameIndex", () => {
  it("advances by one frame", () => {
    expect(nextFrameIndex(0, 5)).toBe(1);
    expect(nextFrameIndex(3, 5)).toBe(4);
  });

  it("does not go past the last frame", () => {
    expect(nextFrameIndex(4, 5)).toBe(4);
    expect(nextFrameIndex(0, 0)).toBe(0);
    expect(nextFrameIndex(0, 1)).toBe(0);
  });
});

describe("prevFrameIndex", () => {
  it("steps back by one frame", () => {
    expect(prevFrameIndex(2)).toBe(1);
    expect(prevFrameIndex(1)).toBe(0);
  });

  it("does not go below 0", () => {
    expect(prevFrameIndex(0)).toBe(0);
    expect(prevFrameIndex(-3)).toBe(0);
  });
});

describe("REPLAY_SPEED_OPTIONS", () => {
  it("exposes a list of speed presets with positive ms values", () => {
    expect(REPLAY_SPEED_OPTIONS.length).toBeGreaterThan(1);
    for (const opt of REPLAY_SPEED_OPTIONS) {
      expect(typeof opt.label).toBe("string");
      expect(opt.label.length).toBeGreaterThan(0);
      expect(opt.ms).toBeGreaterThan(0);
    }
  });

  it("includes the default speed value", () => {
    const defaultOpt = REPLAY_SPEED_OPTIONS.find(
      (o) => o.ms === REPLAY_DEFAULT_SPEED_MS,
    );
    expect(defaultOpt).toBeDefined();
  });
});

describe("getMoveLabel", () => {
  it("maps known move types to French labels", () => {
    expect(getMoveLabel("move")).toBe("Deplacement");
    expect(getMoveLabel("block")).toBe("Blocage");
    expect(getMoveLabel("blitz")).toBe("Blitz");
    expect(getMoveLabel("pass")).toBe("Passe");
    expect(getMoveLabel("handoff")).toBe("Transmission");
    expect(getMoveLabel("foul")).toBe("Agression");
    expect(getMoveLabel("end-turn")).toBe("Fin de tour");
  });

  it("returns a fallback label when type is unknown or missing", () => {
    expect(getMoveLabel(undefined)).toBe("Action");
    expect(getMoveLabel("")).toBe("Action");
    expect(getMoveLabel("some-unknown")).toBe("some-unknown");
  });
});

describe("formatTeamsTitle", () => {
  it("formats both teams when present", () => {
    const title = formatTeamsTitle({
      teamA: makeTeam({ teamName: "Skavens", coachName: "Rat" }),
      teamB: makeTeam({ teamName: "Dwarves", coachName: "Hammer" }),
    });
    expect(title).toBe("Skavens (Rat) vs Dwarves (Hammer)");
  });

  it("uses placeholders when a team is missing", () => {
    const title = formatTeamsTitle({
      teamA: null,
      teamB: makeTeam({ teamName: "Dwarves", coachName: "Hammer" }),
    });
    expect(title).toBe("Equipe A vs Dwarves (Hammer)");
  });

  it("omits coach in parentheses when empty", () => {
    const title = formatTeamsTitle({
      teamA: makeTeam({ teamName: "Lizards", coachName: "" }),
      teamB: makeTeam({ teamName: "Gnomes", coachName: "" }),
    });
    expect(title).toBe("Lizards vs Gnomes");
  });
});

describe("parseReplayResponse", () => {
  it("extracts turns and teams for a well-formed response", () => {
    const response = {
      matchId: "m1",
      status: "ended",
      turns: [
        {
          type: "gameplay-move",
          gameState: { turn: 1 },
          move: { type: "move" },
          timestamp: "2026-01-01T00:00:00.000Z",
        },
        {
          type: "gameplay-move",
          gameState: { turn: 2 },
          move: { type: "block" },
          timestamp: "2026-01-01T00:00:01.000Z",
        },
      ],
      teams: {
        teamA: { coachName: "A", teamName: "TeamA", roster: "Skaven" },
        teamB: { coachName: "B", teamName: "TeamB", roster: "Dwarf" },
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const parsed = parseReplayResponse(response);
    expect(parsed.matchId).toBe("m1");
    expect(parsed.status).toBe("ended");
    expect(parsed.turns).toHaveLength(2);
    expect(parsed.turns[0]).toMatchObject({ type: "gameplay-move" });
    expect(parsed.teams.teamA?.teamName).toBe("TeamA");
    expect(parsed.teams.teamB?.teamName).toBe("TeamB");
  });

  it("returns empty turns when the field is missing or not an array", () => {
    expect(parseReplayResponse({ matchId: "m1", teams: {} }).turns).toEqual([]);
    expect(
      parseReplayResponse({ matchId: "m1", turns: "bad", teams: {} }).turns,
    ).toEqual([]);
  });

  it("treats null/invalid team metadata as null", () => {
    const parsed = parseReplayResponse({
      matchId: "m1",
      turns: [],
      teams: {
        teamA: null,
        teamB: { coachName: "B", teamName: "T", roster: "R" },
      },
    });
    expect(parsed.teams.teamA).toBeNull();
    expect(parsed.teams.teamB).toEqual({
      coachName: "B",
      teamName: "T",
      roster: "R",
    });
  });

  it("returns safe defaults for an empty response", () => {
    const parsed = parseReplayResponse({});
    expect(parsed.matchId).toBe("");
    expect(parsed.status).toBe("");
    expect(parsed.turns).toEqual([]);
    expect(parsed.teams).toEqual({ teamA: null, teamB: null });
  });

  it("throws a clear error when input is null", () => {
    expect(() => parseReplayResponse(null)).toThrow();
  });

  it("filters out turns that are not objects", () => {
    const response: Partial<ReplayResponse> & { turns: unknown[] } = {
      matchId: "m1",
      turns: [
        { type: "gameplay-move", gameState: { turn: 1 } },
        null,
        "bad",
        42,
        { type: "gameplay-move", gameState: { turn: 2 } },
      ],
      teams: { teamA: null, teamB: null },
    };
    const parsed = parseReplayResponse(response);
    expect(parsed.turns).toHaveLength(2);
  });
});

describe("formatMatchDate", () => {
  it("returns empty string for invalid input", () => {
    expect(formatMatchDate(null)).toBe("");
    expect(formatMatchDate(undefined)).toBe("");
    expect(formatMatchDate("not a date")).toBe("");
  });

  it("formats a valid ISO date into a human-readable string", () => {
    const out = formatMatchDate("2026-04-22T10:30:00.000Z");
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });
});
