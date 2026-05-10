/**
 * Tests pour les pools S/A/P/M par position (Lot 4.D.2).
 */

import { describe, expect, it } from "vitest";

import {
  getEligiblePoolFor,
  POSITION_SKILL_ACCESS,
  SKILL_CATEGORY,
  SKILLS_BY_CATEGORY,
  skillSourceForPlayer,
} from "./pro-position-skill-access";

describe("SKILLS_BY_CATEGORY — Lot 4.D.2", () => {
  it("contient les 5 categories BB officielles", () => {
    expect(Object.keys(SKILLS_BY_CATEGORY).sort()).toEqual([
      "A",
      "G",
      "M",
      "P",
      "S",
    ]);
  });

  it("G contient block / tackle / frenzy (skills General canoniques)", () => {
    expect(SKILLS_BY_CATEGORY.G).toContain("block");
    expect(SKILLS_BY_CATEGORY.G).toContain("tackle");
    expect(SKILLS_BY_CATEGORY.G).toContain("frenzy");
  });

  it("A contient dodge / catch (Agility canoniques)", () => {
    expect(SKILLS_BY_CATEGORY.A).toContain("dodge");
    expect(SKILLS_BY_CATEGORY.A).toContain("catch");
  });

  it("S contient guard / mighty_blow (Strength canoniques)", () => {
    expect(SKILLS_BY_CATEGORY.S).toContain("guard");
    expect(SKILLS_BY_CATEGORY.S).toContain("mighty_blow");
  });

  it("P contient pass / accurate (Passing canoniques)", () => {
    expect(SKILLS_BY_CATEGORY.P).toContain("pass");
    expect(SKILLS_BY_CATEGORY.P).toContain("accurate");
  });

  it("M contient claws / horns (Mutation canoniques)", () => {
    expect(SKILLS_BY_CATEGORY.M).toContain("claws");
    expect(SKILLS_BY_CATEGORY.M).toContain("horns");
  });
});

describe("SKILL_CATEGORY (reverse lookup) — Lot 4.D.2", () => {
  it("block est categorie G", () => {
    expect(SKILL_CATEGORY.block).toBe("G");
  });

  it("dodge est categorie A", () => {
    expect(SKILL_CATEGORY.dodge).toBe("A");
  });

  it("claws est categorie M", () => {
    expect(SKILL_CATEGORY.claws).toBe("M");
  });

  it("slug inconnu retourne undefined", () => {
    expect(SKILL_CATEGORY.unknown_skill).toBeUndefined();
  });
});

describe("POSITION_SKILL_ACCESS — Lot 4.D.2", () => {
  it("Lineman a G primary + A/S/P secondary", () => {
    expect(POSITION_SKILL_ACCESS.Lineman.primary).toEqual(["G"]);
    expect(POSITION_SKILL_ACCESS.Lineman.secondary).toEqual(["A", "S", "P"]);
  });

  it("Catcher a G/A primary (catch + esquive)", () => {
    expect(POSITION_SKILL_ACCESS.Catcher.primary).toEqual(["G", "A"]);
  });

  it("Big Guy a S primary + G secondary (focus brutal)", () => {
    expect(POSITION_SKILL_ACCESS["Big Guy"].primary).toEqual(["S"]);
    expect(POSITION_SKILL_ACCESS["Big Guy"].secondary).toEqual(["G"]);
  });
});

describe("skillSourceForPlayer — Lot 4.D.2", () => {
  it("Lineman + block (G) -> primary", () => {
    expect(skillSourceForPlayer("Lineman", "block")).toBe("primary");
  });

  it("Lineman + dodge (A) -> secondary", () => {
    expect(skillSourceForPlayer("Lineman", "dodge")).toBe("secondary");
  });

  it("Lineman + claws (M) -> unavailable (M pas dans Lineman access)", () => {
    expect(skillSourceForPlayer("Lineman", "claws")).toBe("unavailable");
  });

  it("Big Guy + block (G) -> secondary (G secondary pour BG)", () => {
    expect(skillSourceForPlayer("Big Guy", "block")).toBe("secondary");
  });

  it("Big Guy + guard (S) -> primary", () => {
    expect(skillSourceForPlayer("Big Guy", "guard")).toBe("primary");
  });

  it("position inconnue -> fallback Lineman access", () => {
    expect(skillSourceForPlayer("MysteryRole", "block")).toBe("primary");
    expect(skillSourceForPlayer("MysteryRole", "dodge")).toBe("secondary");
  });

  it("slug inconnu -> unavailable", () => {
    expect(skillSourceForPlayer("Lineman", "fake_skill")).toBe("unavailable");
  });
});

describe("getEligiblePoolFor — Lot 4.D.2", () => {
  it("Lineman primary = pool G", () => {
    const pool = getEligiblePoolFor("Lineman", "primary");
    expect(pool).toContain("block");
    expect(pool).not.toContain("dodge");
  });

  it("Lineman secondary = union A + S + P", () => {
    const pool = getEligiblePoolFor("Lineman", "secondary");
    expect(pool).toContain("dodge");
    expect(pool).toContain("guard");
    expect(pool).toContain("pass");
    expect(pool).not.toContain("block"); // block est primary
  });

  it("Big Guy primary = pool S uniquement", () => {
    const pool = getEligiblePoolFor("Big Guy", "primary");
    expect(pool).toContain("guard");
    expect(pool).not.toContain("block"); // block secondary pour BG
  });

  it("Catcher primary = union G + A (large pool)", () => {
    const pool = getEligiblePoolFor("Catcher", "primary");
    expect(pool).toContain("block");
    expect(pool).toContain("dodge");
  });

  it("position inconnue tombe sur Lineman fallback", () => {
    const pool = getEligiblePoolFor("MysteryRole", "primary");
    expect(pool).toContain("block");
  });
});
