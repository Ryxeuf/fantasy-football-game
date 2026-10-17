import { describe, expect, it } from "vitest";
import { coachMatchesTracked } from "./coach";

describe("coachMatchesTracked", () => {
  it("compte aussi les rencontres de coupe des équipes du coach", () => {
    expect(
      coachMatchesTracked({
        id: "u1",
        _count: { matches: 3, createdLocalMatches: 1, cupMatchesPlayed: 4 },
      }),
    ).toBe(8);
  });

  it("tolère une API antérieure ou un compteur absent", () => {
    expect(coachMatchesTracked({ id: "u1", _count: { matches: 2 } })).toBe(2);
    expect(coachMatchesTracked({ id: "u1" })).toBe(0);
    expect(coachMatchesTracked({ id: "u1", _count: null })).toBe(0);
  });
});
