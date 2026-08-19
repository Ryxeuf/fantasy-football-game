/**
 * Lot G — paires obligatoires de Star Players.
 *
 * Non-régression du bug qui a motivé le lot : la table des paires vivait en
 * dur dans trois fichiers, et celle utilisée par `validateStarPlayerPairs`
 * ignorait Dribl & Drull. On pouvait donc composer une équipe avec Dribl seul.
 *
 * Ces tests tapent le vrai catalogue `@bb/game-engine` (aucun mock) : ils
 * verrouillent à la fois la relation et le prix de la paire.
 */

import { describe, it, expect } from "vitest";
import { getStarPlayerPair } from "@bb/game-engine";
import {
  validateStarPlayerPairs,
  requiresPair,
} from "./star-player-validation";

describe("paires obligatoires de Star Players (S3)", () => {
  it.each([
    ["grak", "crumbleberry", 250000],
    ["crumbleberry", "grak", 250000],
    ["dribl", "drull", 230000],
    ["drull", "dribl", 230000],
    ["lucien_swift", "valen_swift", 300000],
    ["valen_swift", "lucien_swift", 300000],
  ])("%s s'associe à %s pour %i po", (slug, partner, pairCost) => {
    const pair = getStarPlayerPair(slug, "season_3");
    expect(pair?.partnerSlug).toBe(partner);
    expect(pair?.pairCost).toBe(pairCost);
    expect(requiresPair(slug, "season_3")).toBe(partner);
  });

  it("un star player sans paire ne réclame pas de partenaire", () => {
    expect(getStarPlayerPair("mighty_zug", "season_3")).toBeNull();
    expect(requiresPair("mighty_zug", "season_3")).toBeNull();
  });

  it("Drull s'associe à Dribl, pas à Grak", () => {
    expect(getStarPlayerPair("drull", "season_3")?.partnerSlug).toBe("dribl");
  });

  it("rejette Dribl sans Drull (cas ignoré par la table câblée)", () => {
    const result = validateStarPlayerPairs(["dribl"], "season_3");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Drull");
  });

  it("accepte une paire complète", () => {
    expect(validateStarPlayerPairs(["dribl", "drull"], "season_3").valid).toBe(
      true,
    );
    expect(
      validateStarPlayerPairs(["grak", "crumbleberry"], "season_3").valid,
    ).toBe(true);
  });

  it("rejette un jumeau Swift seul", () => {
    expect(validateStarPlayerPairs(["valen_swift"], "season_3").valid).toBe(
      false,
    );
  });

  it("la relation reste connue en Saison 2 (prix S2 recalculé)", () => {
    const pair = getStarPlayerPair("crumbleberry", "season_2");
    expect(pair?.partnerSlug).toBe("grak");
    // S2 non touchée : le prix est la somme des coûts S2 (250 + 0).
    expect(pair?.pairCost).toBe(250000);
    expect(validateStarPlayerPairs(["grak"], "season_2").valid).toBe(false);
  });
});
