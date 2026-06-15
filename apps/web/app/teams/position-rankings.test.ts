import { describe, it, expect } from "vitest";
import {
  LEADERBOARDS,
  rankPositions,
  parsePositionIds,
  bestStatValue,
  type ListedPosition,
} from "./position-rankings";

function pos(over: Partial<ListedPosition>): ListedPosition {
  return {
    slug: "skaven_lineman",
    displayName: "Lineman",
    rosterSlug: "skaven",
    rosterName: "Skavens",
    cost: 50,
    min: 0,
    max: 16,
    ma: 7,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: "",
    ...over,
  };
}

const SAMPLE: ListedPosition[] = [
  pos({
    slug: "a",
    displayName: "Gutter Runner",
    ma: 9,
    ag: 2,
    pa: 4,
    cost: 85,
  }),
  pos({ slug: "b", displayName: "Lineman", ma: 7, ag: 3, pa: 4, cost: 50 }),
  pos({
    slug: "c",
    displayName: "Rat Ogre",
    ma: 6,
    st: 5,
    ag: 4,
    pa: 0,
    av: 9,
    cost: 150,
  }),
];

describe("rankPositions", () => {
  it("classe par stat décroissante (plus rapides)", () => {
    const board = LEADERBOARDS.find((b) => b.id === "fastest")!;
    const top = rankPositions(SAMPLE, board, 3).map((p) => p.slug);
    expect(top).toEqual(["a", "b", "c"]);
  });

  it("classe par stat croissante (plus agiles = AG bas)", () => {
    const board = LEADERBOARDS.find((b) => b.id === "agile")!;
    const top = rankPositions(SAMPLE, board, 3).map((p) => p.slug);
    expect(top[0]).toBe("a"); // AG 2+ meilleur
  });

  it("exclut les positions inéligibles (passeurs : pa > 0)", () => {
    const board = LEADERBOARDS.find((b) => b.id === "passers")!;
    const slugs = rankPositions(SAMPLE, board, 5).map((p) => p.slug);
    expect(slugs).not.toContain("c"); // pa = 0 → exclu
  });

  it("départage à stat égale par coût puis nom (stable)", () => {
    const board = LEADERBOARDS.find((b) => b.id === "strongest")!;
    const tie = [
      pos({ slug: "x", displayName: "Zeta", st: 3, cost: 60 }),
      pos({ slug: "y", displayName: "Alpha", st: 3, cost: 60 }),
      pos({ slug: "z", displayName: "Beta", st: 3, cost: 40 }),
    ];
    const order = rankPositions(tie, board, 3).map((p) => p.slug);
    expect(order).toEqual(["z", "y", "x"]); // cost 40 d'abord, puis Alpha<Zeta
  });

  it("ne mute pas le tableau source", () => {
    const board = LEADERBOARDS.find((b) => b.id === "cheapest")!;
    const before = SAMPLE.map((p) => p.slug);
    rankPositions(SAMPLE, board, 2);
    expect(SAMPLE.map((p) => p.slug)).toEqual(before);
  });
});

describe("parsePositionIds", () => {
  it("parse, nettoie et cappe", () => {
    expect(parsePositionIds("a, b ,,c,d", 3)).toEqual(["a", "b", "c"]);
    expect(parsePositionIds(undefined, 4)).toEqual([]);
  });
});

describe("bestStatValue", () => {
  it("retourne le max (desc) et le min (asc)", () => {
    expect(bestStatValue(SAMPLE, "ma", "desc")).toBe(9);
    expect(bestStatValue(SAMPLE, "ag", "asc")).toBe(2);
    expect(bestStatValue([], "ma", "desc")).toBeNull();
  });
});
