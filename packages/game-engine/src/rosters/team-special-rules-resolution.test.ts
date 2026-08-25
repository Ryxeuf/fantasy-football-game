/**
 * Règles spéciales effectives = règles du roster + alignement apporté par la
 * Ligue régionale retenue. Régression : une équipe Nordique inscrite au
 * Clash du Chaos n'affichait « Aucune » règle spéciale alors qu'elle est
 * Favorite de Khorne.
 */

import { describe, expect, it } from "vitest";
import {
  favouredOfLabel,
  isFavouredOfSlug,
  resolveTeamSpecialRules,
} from "./team-special-rules-resolution";

describe("resolveTeamSpecialRules", () => {
  it("Nordiques + Clash du Chaos ⇒ Favori de Khorne", () => {
    expect(
      resolveTeamSpecialRules({
        rosterSlug: "norse",
        ruleset: "season_3",
        regionalLeague: "chaos_clash",
      }),
    ).toEqual([{ slug: "favori_de", alignment: "favoured_of_khorne" }]);
  });

  it("Nordiques + Classique du Vieux Monde ⇒ aucun alignement", () => {
    expect(
      resolveTeamSpecialRules({
        rosterSlug: "norse",
        ruleset: "season_3",
        regionalLeague: "old_world_classic",
      }),
    ).toEqual([]);
  });

  it("sans Ligue enregistrée, garde l'union historique du roster", () => {
    // Repli identique à celui du recrutement de Star Players : on ne retire
    // pas rétroactivement un alignement aux équipes créées avant la règle.
    expect(
      resolveTeamSpecialRules({
        rosterSlug: "norse",
        ruleset: "season_3",
        regionalLeague: null,
      }),
    ).toEqual([{ slug: "favori_de", alignment: "favoured_of_khorne" }]);
  });

  it("conserve les règles déclarées par le roster et ignore les slugs inconnus", () => {
    expect(
      resolveTeamSpecialRules({
        rosterSlug: "norse",
        ruleset: "season_3",
        regionalLeague: "chaos_clash",
        rosterSpecialRules: "bagarreurs_brutaux, NONE",
      }),
    ).toEqual([
      { slug: "bagarreurs_brutaux" },
      { slug: "favori_de", alignment: "favoured_of_khorne" },
    ]);
  });

  it("n'ajoute pas deux fois Favori de… quand le roster la déclare déjà", () => {
    const rules = resolveTeamSpecialRules({
      rosterSlug: "khorne",
      ruleset: "season_3",
      regionalLeague: "chaos_clash",
      rosterSpecialRules: ["favori_de"],
    });
    expect(rules).toEqual([
      { slug: "favori_de", alignment: "favoured_of_khorne" },
    ]);
  });

  it("une équipe sans alignement ni Ligue chaotique garde ses règles", () => {
    expect(
      resolveTeamSpecialRules({
        rosterSlug: "human",
        ruleset: "season_3",
        regionalLeague: "old_world_classic",
        rosterSpecialRules: "chantage_et_corruption",
      }),
    ).toEqual([{ slug: "chantage_et_corruption" }]);
  });
});

describe("favouredOfLabel / isFavouredOfSlug", () => {
  it("reconnaît les alignements", () => {
    expect(isFavouredOfSlug("favoured_of_khorne")).toBe(true);
    expect(isFavouredOfSlug("favoured_of")).toBe(true);
    expect(isFavouredOfSlug("chaos_clash")).toBe(false);
  });

  it("libelle les alignements connus dans les deux langues", () => {
    expect(favouredOfLabel("favoured_of_khorne")).toBe("Favori de Khorne");
    expect(favouredOfLabel("favoured_of_khorne", true)).toBe(
      "Favoured of Khorne",
    );
    expect(favouredOfLabel("favoured_of")).toBe("Favori de Chaos Universel");
  });
});
