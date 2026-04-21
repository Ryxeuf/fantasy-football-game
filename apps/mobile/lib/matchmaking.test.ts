import { describe, it, expect } from "vitest";
import {
  formatElapsed,
  formatTVShort,
  formatTVRange,
  TV_RANGE_PO,
  canStartSearch,
  reduceQueueTransition,
  getMatchmakingStatusLabel,
  type QueueStatusResponse,
  type TeamOption,
} from "./matchmaking";

describe("formatElapsed", () => {
  it("formats zero seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
  });

  it("pads seconds below 10", () => {
    expect(formatElapsed(5)).toBe("0:05");
  });

  it("formats seconds and minutes", () => {
    expect(formatElapsed(65)).toBe("1:05");
  });

  it("handles multiple minutes", () => {
    expect(formatElapsed(125)).toBe("2:05");
  });

  it("never returns a negative value for negative input", () => {
    expect(formatElapsed(-10)).toBe("0:00");
  });

  it("truncates non-integer inputs", () => {
    expect(formatElapsed(59.9)).toBe("0:59");
  });
});

describe("formatTVShort", () => {
  it("formats round thousand values as integer k", () => {
    expect(formatTVShort(1_000_000)).toBe("1000k");
  });

  it("formats values below 1k", () => {
    expect(formatTVShort(0)).toBe("0k");
  });

  it("floors values", () => {
    expect(formatTVShort(1_499_000)).toBe("1499k");
  });
});

describe("formatTVRange", () => {
  it("returns min-max of +/-150k range around the team value", () => {
    expect(formatTVRange(1_000_000)).toBe("850k - 1150k");
  });

  it("clamps min to 0k when negative", () => {
    expect(formatTVRange(100_000)).toBe("0k - 250k");
  });

  it("uses the TV_RANGE_PO constant", () => {
    expect(TV_RANGE_PO).toBe(150_000);
  });
});

describe("canStartSearch", () => {
  it("rejects empty team id", () => {
    expect(canStartSearch("")).toEqual({
      valid: false,
      error: "Selectionnez une equipe",
    });
  });

  it("rejects whitespace-only team id", () => {
    expect(canStartSearch("   ")).toEqual({
      valid: false,
      error: "Selectionnez une equipe",
    });
  });

  it("accepts a non-empty team id", () => {
    expect(canStartSearch("team-abc")).toEqual({ valid: true });
  });
});

describe("reduceQueueTransition", () => {
  it("returns 'idle' when the server says inQueue=false", () => {
    const status: QueueStatusResponse = { inQueue: false };
    expect(reduceQueueTransition(status)).toEqual({ kind: "idle" });
  });

  it("returns 'searching' when status=searching", () => {
    const status: QueueStatusResponse = {
      inQueue: true,
      status: "searching",
      teamId: "team-1",
      teamValue: 1_000_000,
    };
    expect(reduceQueueTransition(status)).toEqual({
      kind: "searching",
      teamId: "team-1",
      teamValue: 1_000_000,
    });
  });

  it("returns 'matched' with matchId when status=matched and matchId present", () => {
    const status: QueueStatusResponse = {
      inQueue: true,
      status: "matched",
      matchId: "match-xyz",
    };
    expect(reduceQueueTransition(status)).toEqual({
      kind: "matched",
      matchId: "match-xyz",
    });
  });

  it("treats matched without matchId as stale (idle)", () => {
    const status: QueueStatusResponse = {
      inQueue: true,
      status: "matched",
      matchId: null,
    };
    expect(reduceQueueTransition(status)).toEqual({ kind: "idle" });
  });

  it("treats unknown status as idle", () => {
    const status: QueueStatusResponse = {
      inQueue: true,
      status: "mystery",
    };
    expect(reduceQueueTransition(status)).toEqual({ kind: "idle" });
  });
});

describe("getMatchmakingStatusLabel", () => {
  it("returns human-readable labels for each status", () => {
    expect(getMatchmakingStatusLabel("searching")).toMatch(/recherche/i);
    expect(getMatchmakingStatusLabel("matched")).toMatch(/trouv/i);
    expect(getMatchmakingStatusLabel("cancelled")).toMatch(/annul/i);
  });

  it("falls back to the raw status when unknown", () => {
    expect(getMatchmakingStatusLabel("unknown-x")).toBe("unknown-x");
  });
});

describe("TeamOption typing", () => {
  it("accepts well-formed team options (type check via usage)", () => {
    const team: TeamOption = {
      id: "t1",
      name: "Reikland Reavers",
      roster: "human",
      currentValue: 1_000_000,
    };
    expect(team.id).toBe("t1");
  });
});
