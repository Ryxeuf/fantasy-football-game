import { describe, it, expect } from "vitest";
import {
  generateRandomRound,
  seedToInt,
  shuffleWithSeed,
} from "./random-pairing";

const EMPTY = { playedPairs: [], byes: [] } as const;
const TEAMS = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("shuffleWithSeed", () => {
  it("est déterministe à graine donnée", () => {
    expect(shuffleWithSeed(TEAMS, "cup-1:2")).toEqual(
      shuffleWithSeed(TEAMS, "cup-1:2"),
    );
  });

  it("change d'ordre quand la graine change", () => {
    const a = shuffleWithSeed(TEAMS, "cup-1:1");
    const b = shuffleWithSeed(TEAMS, "cup-1:2");
    expect(a).not.toEqual(b);
  });

  it("conserve exactement les mêmes éléments et ne mute pas l'entrée", () => {
    const input = [...TEAMS];
    const out = shuffleWithSeed(input, "s");
    expect([...out].sort()).toEqual([...TEAMS].sort());
    expect(input).toEqual(TEAMS);
  });

  it("mélange réellement (au moins une graine bouge l'ordre)", () => {
    const moved = ["s1", "s2", "s3", "s4", "s5"].some(
      (s) => shuffleWithSeed(TEAMS, s).join() !== TEAMS.join(),
    );
    expect(moved).toBe(true);
  });

  it("supporte 0 et 1 élément", () => {
    expect(shuffleWithSeed([], "s")).toEqual([]);
    expect(shuffleWithSeed(["only"], "s")).toEqual(["only"]);
  });

  it("hache la graine de façon stable", () => {
    expect(seedToInt("cup-1:3")).toBe(seedToInt("cup-1:3"));
    expect(seedToInt("cup-1:3")).not.toBe(seedToInt("cup-1:4"));
  });
});

describe("generateRandomRound", () => {
  it("apparie toutes les équipes sans doublon (nombre pair)", () => {
    const out = generateRandomRound(TEAMS, EMPTY, "cup-1:1");
    expect(out.pairings).toHaveLength(4);
    expect(out.bye).toBeNull();
    const seen = out.pairings.flatMap((p) => [p.home, p.away]);
    expect([...seen].sort()).toEqual([...TEAMS].sort());
  });

  it("exempte une équipe en nombre impair", () => {
    const out = generateRandomRound(TEAMS.slice(0, 5), EMPTY, "cup-1:1");
    expect(out.pairings).toHaveLength(2);
    expect(out.bye).not.toBeNull();
  });

  it("est déterministe à graine donnée", () => {
    expect(generateRandomRound(TEAMS, EMPTY, "cup-1:1")).toEqual(
      generateRandomRound(TEAMS, EMPTY, "cup-1:1"),
    );
  });

  it("hérite du « zéro rematch » du moteur suisse", () => {
    // a-b et c-d déjà joués : le tirage doit trouver un autre appariement.
    const history = {
      playedPairs: [
        ["a", "b"],
        ["c", "d"],
      ] as ReadonlyArray<readonly [string, string]>,
      byes: [],
    };
    const out = generateRandomRound(["a", "b", "c", "d"], history, "cup-1:2");
    expect(out.rematchForced).toBe(false);
    for (const p of out.pairings) {
      const key = [p.home, p.away].sort().join("|");
      expect(["a|b", "c|d"]).not.toContain(key);
    }
  });

  it("hérite de l'exempt tournant", () => {
    const out = generateRandomRound(["a", "b", "c"], { playedPairs: [], byes: ["a", "b"] }, "s");
    expect(out.bye).toBe("c");
  });
});
