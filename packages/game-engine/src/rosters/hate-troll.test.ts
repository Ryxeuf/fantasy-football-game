import { describe, it, expect } from "vitest";
import { SKILLS_DEFINITIONS } from "../skills/index";
import { SEASON_THREE_ROSTERS } from "./season3-rosters";

// A20 — Le Tueur de Trolls doit afficher « Haine (Troll) » et non le
// générique « Haine (X) ».
describe("A20 — Haine (Troll) pour le Tueur de Trolls", () => {
  it("le skill hate-troll existe avec le bon nom FR (season3Only)", () => {
    const def = SKILLS_DEFINITIONS.find((s) => s.slug === "hate-troll");
    expect(def?.nameFr).toBe("Haine (Troll)");
    expect(def?.nameEn).toBe("Hate (Troll)");
    expect(def?.season3Only).toBe(true);
  });

  it("les Tueurs de Trolls utilisent hate-troll, plus le hate générique", () => {
    let trollSlayers = 0;
    for (const roster of Object.values(SEASON_THREE_ROSTERS)) {
      for (const pos of roster.positions) {
        const skills =
          typeof pos.skills === "string"
            ? pos.skills.split(",").map((s) => s.trim())
            : pos.skills;
        if (/tueur de troll/i.test(pos.displayName)) {
          trollSlayers++;
          expect(skills).toContain("hate-troll");
          expect(skills).not.toContain("hate");
        }
      }
    }
    expect(trollSlayers).toBeGreaterThanOrEqual(1);
  });
});
