import { describe, expect, it } from "vitest";
import {
  ownsBothSides,
  parseSideParam,
  pickMySide,
  searchWithSide,
} from "./side-selection";

describe("side-selection", () => {
  it("parseSideParam ne retient que home / away", () => {
    expect(parseSideParam("?side=away")).toBe("away");
    expect(parseSideParam("?tab=x&side=home")).toBe("home");
    expect(parseSideParam("?side=both")).toBeNull();
    expect(parseSideParam("")).toBeNull();
  });

  it("searchWithSide conserve les autres paramètres", () => {
    expect(searchWithSide("?tab=after", "away")).toBe("?tab=after&side=away");
    expect(searchWithSide("?side=home", "away")).toBe("?side=away");
  });

  it("pickMySide : choix possédé, sinon repli", () => {
    expect(pickMySide(["home", "away"], "away", "home")).toBe("away");
    expect(pickMySide(["home"], "away", "home")).toBe("home");
    expect(pickMySide(undefined, "away", null)).toBeNull();
  });

  it("ownsBothSides", () => {
    expect(ownsBothSides(["home", "away"])).toBe(true);
    expect(ownsBothSides(["home"])).toBe(false);
    expect(ownsBothSides(undefined)).toBe(false);
  });
});
