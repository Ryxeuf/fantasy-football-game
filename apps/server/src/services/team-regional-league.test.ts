/**
 * Résolution de la Ligue régionale à la création d'une équipe.
 */

import { describe, it, expect } from "vitest";
import { getTournamentRuleset } from "@bb/game-engine";
import {
  RegionalLeagueError,
  resolveRegionalLeagueForCreation,
} from "./team-regional-league";

describe("resolveRegionalLeagueForCreation", () => {
  it("attribue d'office la Ligue unique d'un roster", () => {
    expect(
      resolveRegionalLeagueForCreation({ roster: "orc", ruleset: "season_3" }),
    ).toBe("badlands_brawl");
  });

  it("exige un choix quand le roster a plusieurs Ligues", () => {
    expect(() =>
      resolveRegionalLeagueForCreation({ roster: "norse", ruleset: "season_3" }),
    ).toThrowError(RegionalLeagueError);

    try {
      resolveRegionalLeagueForCreation({ roster: "norse", ruleset: "season_3" });
    } catch (e) {
      expect((e as RegionalLeagueError).code).toBe("choice_required");
      // Le message liste les options en clair pour l'UI.
      expect((e as RegionalLeagueError).message).toContain("Clash du Chaos");
      expect((e as RegionalLeagueError).message).toContain(
        "Classique du Vieux Monde",
      );
    }
  });

  it("accepte un choix valide", () => {
    expect(
      resolveRegionalLeagueForCreation({
        roster: "norse",
        ruleset: "season_3",
        requested: "chaos_clash",
      }),
    ).toBe("chaos_clash");
  });

  it("refuse une Ligue étrangère au roster", () => {
    try {
      resolveRegionalLeagueForCreation({
        roster: "norse",
        ruleset: "season_3",
        requested: "elven_kingdoms_league",
      });
      throw new Error("aurait dû lever");
    } catch (e) {
      expect(e).toBeInstanceOf(RegionalLeagueError);
      expect((e as RegionalLeagueError).code).toBe("invalid_choice");
    }
  });

  it("refuse aussi un choix étranger sur un roster mono-ligue", () => {
    expect(() =>
      resolveRegionalLeagueForCreation({
        roster: "orc",
        ruleset: "season_3",
        requested: "chaos_clash",
      }),
    ).toThrowError(RegionalLeagueError);
  });

  it("ignore une chaîne vide comme « non fourni »", () => {
    expect(
      resolveRegionalLeagueForCreation({
        roster: "orc",
        ruleset: "season_3",
        requested: "   ",
      }),
    ).toBe("badlands_brawl");
  });

  it("n'enregistre aucune Ligue si le règlement neutralise l'axe régional", () => {
    const pack = {
      ...getTournamentRuleset("naf_world_cup_2027")!,
      regionalLeagueChoice: false,
    };
    expect(
      resolveRegionalLeagueForCreation({
        roster: "norse",
        ruleset: "season_3",
        pack,
      }),
    ).toBeNull();
  });

  it("garde le choix sous un règlement qui ne dit rien", () => {
    const pack = getTournamentRuleset("naf_world_cup_2027");
    expect(() =>
      resolveRegionalLeagueForCreation({
        roster: "norse",
        ruleset: "season_3",
        pack,
      }),
    ).toThrowError(RegionalLeagueError);
  });
});
