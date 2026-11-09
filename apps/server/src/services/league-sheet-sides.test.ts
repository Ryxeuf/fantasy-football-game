import { describe, expect, it } from "vitest";
import {
  ownedSides,
  ownsSide,
  resolveActingSide,
  sameOwner,
  viewerSide,
} from "./league-sheet-sides";

const split = { homeOwnerId: "u-home", awayOwnerId: "u-away" };
const both = { homeOwnerId: "u-both", awayOwnerId: "u-both" };

describe("ownsSide / ownedSides", () => {
  it.each([
    [split, "u-home", "home", true],
    [split, "u-home", "away", false],
    [split, "u-away", "away", true],
    [both, "u-both", "home", true],
    [both, "u-both", "away", true],
    [both, "stranger", "away", false],
  ] as const)("%o — %s possède %s : %s", (ctx, user, side, expected) => {
    expect(ownsSide(ctx, user, side)).toBe(expected);
  });

  it("liste les côtés possédés, domicile d'abord", () => {
    expect(ownedSides(split, "u-away")).toEqual(["away"]);
    expect(ownedSides(both, "u-both")).toEqual(["home", "away"]);
    expect(ownedSides(split, "commish")).toEqual([]);
  });

  it("sameOwner", () => {
    expect(sameOwner(both)).toBe(true);
    expect(sameOwner(split)).toBe(false);
  });
});

describe("resolveActingSide", () => {
  it.each([
    [[], undefined, { ok: false, code: "not_a_participant" }],
    [["home"], undefined, { ok: true, side: "home" }],
    [["away"], "away", { ok: true, side: "away" }],
    [["home"], "away", { ok: false, code: "forbidden" }],
    [["home", "away"], undefined, { ok: false, code: "side_required" }],
    [["home", "away"], "away", { ok: true, side: "away" }],
  ] as const)("possède %o, demande %s", (owned, requested, expected) => {
    expect(resolveActingSide(owned, requested)).toEqual(expected);
  });
});

describe("viewerSide", () => {
  it("côté demandé s'il est possédé, sinon le premier", () => {
    expect(viewerSide(["home", "away"], "away")).toBe("away");
    expect(viewerSide(["home", "away"], undefined)).toBe("home");
    expect(viewerSide(["home"], "away")).toBe("home");
    expect(viewerSide([], "away")).toBeNull();
  });
});
