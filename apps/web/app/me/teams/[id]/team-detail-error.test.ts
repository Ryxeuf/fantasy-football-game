import { describe, it, expect } from "vitest";
import { shouldShowTeamLoadError } from "./team-detail-error";

describe("shouldShowTeamLoadError", () => {
  it("affiche l'erreur quand l'équipe est absente", () => {
    expect(shouldShowTeamLoadError("Introuvable", false)).toBe(true);
  });

  it("MASQUE l'erreur quand l'équipe est chargée (404 transitoire / race)", () => {
    // Régression : "Introuvable" ne doit plus s'afficher si l'équipe est là.
    expect(shouldShowTeamLoadError("Introuvable", true)).toBe(false);
  });

  it("rien à afficher sans erreur", () => {
    expect(shouldShowTeamLoadError(null, false)).toBe(false);
    expect(shouldShowTeamLoadError("", false)).toBe(false);
    expect(shouldShowTeamLoadError(undefined, true)).toBe(false);
  });
});
