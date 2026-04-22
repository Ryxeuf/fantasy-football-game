import { describe, it, expect } from "vitest";
import {
  CUP_STATUSES,
  filterCupsByStatus,
  formatCupStatusLabel,
  isValidCupStatus,
  parseCupDetailResponse,
  parseCupListResponse,
  sortCupsByRecent,
  type Cup,
  type CupStatus,
} from "./cups";

function makeCup(overrides: Partial<Cup> = {}): Cup {
  return {
    id: "c1",
    name: "Coupe Test",
    ruleset: "season_3",
    status: "ouverte",
    isPublic: true,
    creatorId: "u1",
    creator: { id: "u1", coachName: "Alice", email: "alice@test" },
    participantCount: 2,
    participants: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    ...overrides,
  };
}

describe("CUP_STATUSES", () => {
  it("lists the four cup statuses in display order", () => {
    expect(CUP_STATUSES).toEqual([
      "ouverte",
      "en_cours",
      "terminee",
      "archivee",
    ]);
  });
});

describe("isValidCupStatus", () => {
  it("accepts the known statuses", () => {
    expect(isValidCupStatus("ouverte")).toBe(true);
    expect(isValidCupStatus("en_cours")).toBe(true);
    expect(isValidCupStatus("terminee")).toBe(true);
    expect(isValidCupStatus("archivee")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isValidCupStatus("draft")).toBe(false);
    expect(isValidCupStatus("")).toBe(false);
    expect(isValidCupStatus(42)).toBe(false);
    expect(isValidCupStatus(null)).toBe(false);
  });
});

describe("formatCupStatusLabel", () => {
  it("returns French labels for known statuses", () => {
    expect(formatCupStatusLabel("ouverte")).toBe("Ouverte");
    expect(formatCupStatusLabel("en_cours")).toBe("En cours");
    expect(formatCupStatusLabel("terminee")).toBe("Terminee");
    expect(formatCupStatusLabel("archivee")).toBe("Archivee");
  });

  it("echoes unknown status values as-is", () => {
    expect(formatCupStatusLabel("unknown")).toBe("unknown");
  });
});

describe("parseCupListResponse", () => {
  it("returns an empty list when cups is missing", () => {
    expect(parseCupListResponse({})).toEqual([]);
    expect(parseCupListResponse(null)).toEqual([]);
    expect(parseCupListResponse(undefined)).toEqual([]);
  });

  it("extracts the cups array from the response envelope", () => {
    const cups = parseCupListResponse({
      cups: [
        {
          id: "c1",
          name: "Coupe A",
          ruleset: "season_3",
          status: "ouverte",
          isPublic: true,
          creatorId: "u1",
          creator: { id: "u1", coachName: "Alice", email: "alice@test" },
          participantCount: 4,
          participants: [],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      ],
    });
    expect(cups).toHaveLength(1);
    expect(cups[0].name).toBe("Coupe A");
    expect(cups[0].participantCount).toBe(4);
  });

  it("fills missing optional fields with safe defaults", () => {
    const cups = parseCupListResponse({
      cups: [
        {
          id: "c1",
          name: "Partielle",
          ruleset: "season_2",
          status: "en_cours",
          creatorId: "u1",
        },
      ],
    });
    expect(cups).toHaveLength(1);
    expect(cups[0].isPublic).toBe(false);
    expect(cups[0].participantCount).toBe(0);
    expect(cups[0].participants).toEqual([]);
    expect(cups[0].creator).toEqual({
      id: "u1",
      coachName: "",
      email: "",
    });
  });

  it("filters out entries without an id", () => {
    const cups = parseCupListResponse({
      cups: [
        { name: "Sans id" },
        null,
        { id: "ok", name: "OK", ruleset: "season_3", status: "ouverte" },
      ],
    });
    expect(cups).toHaveLength(1);
    expect(cups[0].id).toBe("ok");
  });
});

describe("filterCupsByStatus", () => {
  const cups = [
    makeCup({ id: "c1", status: "ouverte" }),
    makeCup({ id: "c2", status: "en_cours" }),
    makeCup({ id: "c3", status: "terminee" }),
    makeCup({ id: "c4", status: "archivee" }),
  ];

  it("returns all cups when filter is 'all'", () => {
    expect(filterCupsByStatus(cups, "all")).toHaveLength(4);
  });

  it("filters to the requested status", () => {
    expect(filterCupsByStatus(cups, "en_cours").map((c) => c.id)).toEqual([
      "c2",
    ]);
  });

  it("returns an empty list when none match", () => {
    const noArchives = cups.filter((c) => c.status !== "archivee");
    expect(filterCupsByStatus(noArchives, "archivee")).toEqual([]);
  });
});

describe("sortCupsByRecent", () => {
  it("sorts cups by updatedAt descending", () => {
    const sorted = sortCupsByRecent([
      makeCup({ id: "old", updatedAt: "2026-01-01T00:00:00Z" }),
      makeCup({ id: "new", updatedAt: "2026-03-01T00:00:00Z" }),
      makeCup({ id: "mid", updatedAt: "2026-02-01T00:00:00Z" }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["new", "mid", "old"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      makeCup({ id: "a", updatedAt: "2026-01-01T00:00:00Z" }),
      makeCup({ id: "b", updatedAt: "2026-02-01T00:00:00Z" }),
    ];
    const originalOrder = input.map((c) => c.id);
    sortCupsByRecent(input);
    expect(input.map((c) => c.id)).toEqual(originalOrder);
  });

  it("handles cups with identical updatedAt values deterministically", () => {
    const same = "2026-01-01T00:00:00Z";
    const sorted = sortCupsByRecent([
      makeCup({ id: "a", updatedAt: same }),
      makeCup({ id: "b", updatedAt: same }),
    ]);
    expect(sorted).toHaveLength(2);
  });
});

describe("parseCupDetailResponse", () => {
  it("returns null for empty input", () => {
    expect(parseCupDetailResponse(null)).toBeNull();
    expect(parseCupDetailResponse({})).toBeNull();
  });

  it("parses a well-formed cup with standings and matches", () => {
    const detail = parseCupDetailResponse({
      id: "c1",
      name: "Coupe",
      ruleset: "season_3",
      status: "en_cours",
      isPublic: true,
      creatorId: "u1",
      creator: { id: "u1", coachName: "Alice", email: "alice@test" },
      participantCount: 2,
      participants: [
        {
          id: "t1",
          name: "Team 1",
          roster: "skaven",
          ruleset: "season_3",
          owner: { id: "u1", coachName: "Alice", email: "alice@test" },
        },
      ],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      standings: [
        { teamId: "t1", points: 3, wins: 1, draws: 0, losses: 0 },
        { teamId: "t2", points: 0, wins: 0, draws: 0, losses: 1 },
      ],
      matches: [
        { id: "m1", status: "completed" },
      ],
    });
    expect(detail).not.toBeNull();
    expect(detail?.name).toBe("Coupe");
    expect(detail?.participants).toHaveLength(1);
    expect(detail?.standings).toHaveLength(2);
    expect(detail?.matches).toHaveLength(1);
  });

  it("defaults missing standings and matches to empty arrays", () => {
    const detail = parseCupDetailResponse({
      id: "c1",
      name: "Coupe",
      ruleset: "season_3",
      status: "ouverte",
      creatorId: "u1",
    });
    expect(detail?.standings).toEqual([]);
    expect(detail?.matches).toEqual([]);
  });
});

describe("CupStatus type is exhaustive", () => {
  it("has formatCupStatusLabel covering every CUP_STATUSES entry", () => {
    for (const status of CUP_STATUSES) {
      const typed: CupStatus = status;
      expect(formatCupStatusLabel(typed)).not.toBe("");
    }
  });
});
