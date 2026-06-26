/**
 * FR3 — non-régression : extraction des seeds courants du 1er tour du
 * bracket pour préremplir l'éditeur de participants des playoffs.
 */
import { describe, it, expect } from "vitest";
import { currentSeedsFromRounds } from "./PlayoffBracketView";

function round(slot: string, roundNumber: number, home: string, away: string) {
  return {
    id: `r-${slot}`,
    roundNumber,
    bracketSlot: slot,
    status: "scheduled",
    pairings: [
      {
        id: `p-${slot}`,
        status: "scheduled",
        homeParticipant: { id: home, team: { id: home, name: home, roster: "x", owner: { id: "o", coachName: null } } },
        awayParticipant: { id: away, team: { id: away, name: away, roster: "x", owner: { id: "o", coachName: null } } },
        match: null,
      },
    ],
  };
}

describe("currentSeedsFromRounds", () => {
  it("aplati les 4 quarts en 8 seeds (taille 8)", () => {
    const rounds = [
      round("qf1", 1, "a", "b"),
      round("qf2", 2, "c", "d"),
      round("qf3", 3, "e", "f"),
      round("qf4", 4, "g", "h"),
      // demi-finales avec placeholders (ignorées car slot sf*).
      round("sf1", 5, "a", "a"),
    ] as unknown as Parameters<typeof currentSeedsFromRounds>[0];
    expect(currentSeedsFromRounds(rounds, 8)).toEqual([
      "a", "b", "c", "d", "e", "f", "g", "h",
    ]);
  });

  it("ignore les placeholders (home === away)", () => {
    const rounds = [round("final", 1, "x", "x")] as unknown as Parameters<
      typeof currentSeedsFromRounds
    >[0];
    expect(currentSeedsFromRounds(rounds, 2)).toEqual(["x"]);
  });

  it("taille 4 = 2 demi-finales", () => {
    const rounds = [
      round("sf1", 1, "a", "b"),
      round("sf2", 2, "c", "d"),
    ] as unknown as Parameters<typeof currentSeedsFromRounds>[0];
    expect(currentSeedsFromRounds(rounds, 4)).toEqual(["a", "b", "c", "d"]);
  });
});
