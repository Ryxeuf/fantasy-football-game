import { describe, it, expect } from "vitest";
import { SEASON_THREE_ROSTERS } from "./season3-rosters";

// Régression : confusion Minus (stunty) / Microbe (titchy).
// Dans les règles BB 2025, un joueur « Microbe » est TOUJOURS aussi
// « Minus » (les positions listent « Minus » seul, ou « Minus, Microbe »
// — jamais « Microbe » seul). Un mauvais slug faisait passer des joueurs
// (gobelins, gnomes, halflings, skinks…) en « Microbe » sans « Minus »
// après synchronisation. Voir docs/roster-bb-2025/ecarts-db-2026-06-26.md.
describe("Trait Minus (stunty) / Microbe (titchy) — season 3", () => {
  it("toute position 'titchy' (Microbe) porte aussi 'stunty' (Minus)", () => {
    const offenders: string[] = [];
    for (const [rosterSlug, roster] of Object.entries(SEASON_THREE_ROSTERS)) {
      for (const pos of roster.positions) {
        const skills = pos.skills.split(",").map((s) => s.trim());
        if (skills.includes("titchy") && !skills.includes("stunty")) {
          offenders.push(`${rosterSlug}/${pos.slug}`);
        }
      }
    }
    expect(offenders, "Microbe sans Minus").toEqual([]);
  });

  it("les positions gobelines 'Minus' portent stunty et jamais titchy", () => {
    const goblin = SEASON_THREE_ROSTERS.goblin;
    expect(goblin).toBeTruthy();
    for (const pos of goblin.positions) {
      const skills = pos.skills.split(",").map((s) => s.trim());
      expect(skills, `${pos.slug} ne doit pas avoir titchy`).not.toContain(
        "titchy",
      );
    }
    // Toutes les positions gobelines sauf le Troll entraîné ont Minus.
    const withoutStunty = goblin.positions
      .filter((p) => !/troll/i.test(p.slug))
      .filter(
        (p) => !p.skills.split(",").map((s) => s.trim()).includes("stunty"),
      )
      .map((p) => p.slug);
    expect(withoutStunty).toEqual([]);
  });
});
