/**
 * Lot 6.5 — `TeamSpecialRule` et `RegionalLeague` sont enfin LUES.
 *
 * Les deux tables existaient depuis la transcription Saison 3 mais aucun
 * chemin de code ne les consultait : corriger une description en base
 * n'avait aucun effet visible. Ce fichier verrouille les trois chemins : la
 * base prime, un slug absent de la base reste servi par le moteur, et toute
 * lecture en échec dégrade au lieu de faire tomber la fiche.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    teamSpecialRule: { findMany: vi.fn() },
    regionalLeague: { findMany: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import { prisma } from "../prisma";
import {
  ENGINE_TEAM_RULES_CATALOGUE,
  invalidateTeamRulesCatalogueCache,
  loadTeamRulesCatalogue,
} from "./team-rules-catalogue";

const db = prisma as unknown as {
  teamSpecialRule: { findMany: ReturnType<typeof vi.fn> };
  regionalLeague: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.resetAllMocks();
  invalidateTeamRulesCatalogueCache();
  db.teamSpecialRule.findMany.mockResolvedValue([]);
  db.regionalLeague.findMany.mockResolvedValue([]);
});

describe("loadTeamRulesCatalogue", () => {
  it("sert la description corrigée en base plutôt que celle du moteur", async () => {
    db.teamSpecialRule.findMany.mockResolvedValue([
      {
        slug: "chantage_et_corruption",
        nameFr: "Chantage et Corruption (corrigé)",
        nameEn: "Bribery and Corruption",
        description: "Description éditée en admin.",
        descriptionEn: null,
      },
    ]);

    const catalogue = await loadTeamRulesCatalogue("season_3");
    const rule = catalogue.specialRule("chantage_et_corruption");

    expect(rule?.nameFr).toBe("Chantage et Corruption (corrigé)");
    expect(rule?.description).toBe("Description éditée en admin.");
    expect(
      ENGINE_TEAM_RULES_CATALOGUE.specialRule("chantage_et_corruption")?.nameFr,
    ).toBe("Chantage et Corruption");
  });

  it("garde les slugs du moteur absents de la base", async () => {
    db.teamSpecialRule.findMany.mockResolvedValue([
      {
        slug: "chantage_et_corruption",
        nameFr: "Édité",
        nameEn: "Edited",
        description: "…",
        descriptionEn: null,
      },
    ]);

    const catalogue = await loadTeamRulesCatalogue("season_3");
    expect(catalogue.specialRule("bagarreurs_brutaux")?.nameFr).toBe(
      "Bagarreurs Brutaux",
    );
  });

  it("expose une Ligue créée en admin, inconnue du catalogue compilé", async () => {
    db.regionalLeague.findMany.mockResolvedValue([
      {
        slug: "ligue_maison",
        nameFr: "Ligue Maison",
        nameEn: "House League",
        description: "Ligue ajoutée par le commissaire.",
        descriptionEn: "Added by the commissioner.",
      },
    ]);

    const catalogue = await loadTeamRulesCatalogue("season_3");
    expect(catalogue.regionalLeague("ligue_maison")?.nameEn).toBe(
      "House League",
    );
    // Le catalogue compilé reste servi pour les Ligues officielles.
    expect(catalogue.regionalLeague("chaos_clash")?.nameFr).toBe(
      "Clash du Chaos",
    );
  });

  it("retombe sur le catalogue compilé quand les tables sont vides", async () => {
    const catalogue = await loadTeamRulesCatalogue("season_3");
    expect(catalogue.specialRule("favori_de")?.nameFr).toBe("Favori de...");
    expect(catalogue.listRegionalLeagues().length).toBeGreaterThan(0);
  });

  it("retombe sur le catalogue compilé quand la base est injoignable", async () => {
    db.teamSpecialRule.findMany.mockRejectedValue(new Error("no db"));

    const catalogue = await loadTeamRulesCatalogue("season_3");
    expect(catalogue.specialRule("capitaine")?.nameFr).toBe("Capitaine");
  });

  it("renvoie null pour un slug inconnu partout", async () => {
    const catalogue = await loadTeamRulesCatalogue("season_3");
    expect(catalogue.specialRule("pas_une_regle")).toBeNull();
    expect(catalogue.regionalLeague("pas_une_ligue")).toBeNull();
  });
});
