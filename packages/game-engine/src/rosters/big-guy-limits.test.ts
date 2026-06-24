import { describe, it, expect } from "vitest";
import { bigGuyLimitForRoster } from "./big-guy-limits";

describe("A36 — bigGuyLimitForRoster", () => {
  it("plafonne old_world_alliance à 1 Gros Bras", () => {
    expect(bigGuyLimitForRoster("old_world_alliance")).toBe(1);
  });

  it("plafonne underworld à 1 Gros Bras", () => {
    expect(bigGuyLimitForRoster("underworld")).toBe(1);
  });

  it("plafonne chaos_chosen à 1 Gros Bras", () => {
    expect(bigGuyLimitForRoster("chaos_chosen")).toBe(1);
  });

  it("plafonne chaos_renegade à 3 Gros Bras", () => {
    expect(bigGuyLimitForRoster("chaos_renegade")).toBe(3);
  });

  it("renvoie null pour une équipe sans plafond combiné (ogre)", () => {
    expect(bigGuyLimitForRoster("ogre")).toBeNull();
  });

  it("renvoie null pour une équipe sans plafond combiné (human)", () => {
    expect(bigGuyLimitForRoster("human")).toBeNull();
  });

  it("renvoie null pour un roster inconnu", () => {
    expect(bigGuyLimitForRoster("not_a_team")).toBeNull();
  });

  it("résout les alias legacy vers le slug canonique (oldworldalliance → old_world_alliance)", () => {
    // resolveRosterSlugForReroll mappe "oldworldalliance" → "old_world_alliance"
    expect(bigGuyLimitForRoster("oldworldalliance")).toBe(1);
  });

  it("résout l'alias legacy chaosrenegades → chaos_renegade", () => {
    expect(bigGuyLimitForRoster("chaosrenegades")).toBe(3);
  });
});
