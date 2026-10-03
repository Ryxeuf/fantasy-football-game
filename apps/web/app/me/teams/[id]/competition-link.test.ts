import { describe, it, expect } from "vitest";
import { competitionLink } from "./competition-link";

describe("competitionLink", () => {
  it("pointe vers la fiche de la coupe", () => {
    expect(
      competitionLink({ kind: "cup", name: "Coupe d'hiver", competitionId: "cup-9" }),
    ).toEqual({ href: "/cups/cup-9", kind: "cup", name: "Coupe d'hiver" });
  });

  it("pointe vers la fiche de la ligue (pas de la saison)", () => {
    expect(
      competitionLink({
        kind: "league",
        name: "Ligue du Vieux Monde — Saison 2",
        competitionId: "league-7",
        seasonId: "season-2",
      }),
    ).toEqual({
      href: "/leagues/league-7",
      kind: "league",
      name: "Ligue du Vieux Monde — Saison 2",
    });
  });

  it("aucun lien sans engagement", () => {
    expect(competitionLink(null)).toBeNull();
    expect(competitionLink(undefined)).toBeNull();
  });

  it("aucun lien quand l'API ne sert pas encore l'id (rétro-compat)", () => {
    expect(competitionLink({ kind: "cup", name: "Coupe X" })).toBeNull();
  });

  it("encode l'id dans l'URL", () => {
    expect(
      competitionLink({ kind: "cup", name: "X", competitionId: "a/b" })?.href,
    ).toBe("/cups/a%2Fb");
  });
});
