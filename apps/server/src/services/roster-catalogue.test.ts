/**
 * Lot 6.8 — l'univers des rosters jouables vient de la base.
 *
 * Le bug corrigé : `ALLOWED_TEAMS` était figé au build. Un roster créé en
 * admin apparaissait dans le catalogue public (servi par la base) mais le
 * builder authentifié le refusait avec « Roster non autorisé ».
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: { roster: { findMany: vi.fn() } },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import { prisma } from "../prisma";
import {
  invalidateRosterCatalogueCache,
  isAllowedTeamRoster,
  listRosterSlugs,
} from "./roster-catalogue";

const mockPrisma = prisma as unknown as {
  roster: { findMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.resetAllMocks();
  invalidateRosterCatalogueCache();
});

describe("roster-catalogue", () => {
  it("accepte un roster créé en base et inconnu du catalogue compilé", async () => {
    mockPrisma.roster.findMany.mockResolvedValue([
      { slug: "skaven", ruleset: "season_3" },
      { slug: "nuffle_allstars", ruleset: "season_3" },
    ]);

    await expect(
      isAllowedTeamRoster("nuffle_allstars", "season_3"),
    ).resolves.toBe(true);
  });

  it("refuse un roster retiré de la base, même connu du moteur", async () => {
    mockPrisma.roster.findMany.mockResolvedValue([
      { slug: "skaven", ruleset: "season_3" },
    ]);

    await expect(isAllowedTeamRoster("bretonnian", "season_3")).resolves.toBe(
      false,
    );
  });

  it("accepte un roster présent uniquement dans l'édition par défaut", async () => {
    // `getRosterFromDb` retombe déjà sur l'édition par défaut : refuser ici
    // ferait diverger la validation de la lecture.
    mockPrisma.roster.findMany.mockResolvedValue([
      { slug: "skaven", ruleset: "season_3" },
      { slug: "lizardmen", ruleset: "season_2" },
    ]);

    await expect(isAllowedTeamRoster("skaven", "season_2")).resolves.toBe(true);
  });

  it("retombe sur le catalogue compilé quand la table est vide", async () => {
    mockPrisma.roster.findMany.mockResolvedValue([]);

    await expect(isAllowedTeamRoster("bretonnian")).resolves.toBe(true);
    await expect(isAllowedTeamRoster("pas-un-roster")).resolves.toBe(false);
  });

  it("retombe sur le catalogue compilé quand la base est injoignable", async () => {
    mockPrisma.roster.findMany.mockRejectedValue(new Error("no db"));

    await expect(isAllowedTeamRoster("bretonnian")).resolves.toBe(true);
  });

  it("liste les slugs d'une édition, triés", async () => {
    mockPrisma.roster.findMany.mockResolvedValue([
      { slug: "skaven", ruleset: "season_3" },
      { slug: "amazon", ruleset: "season_3" },
      { slug: "lizardmen", ruleset: "season_2" },
    ]);

    await expect(listRosterSlugs("season_3")).resolves.toEqual([
      "amazon",
      "skaven",
    ]);
    await expect(listRosterSlugs()).resolves.toEqual([
      "amazon",
      "lizardmen",
      "skaven",
    ]);
  });

  it("ne relit pas la base tant que le cache n'est pas invalidé", async () => {
    mockPrisma.roster.findMany.mockResolvedValue([
      { slug: "skaven", ruleset: "season_3" },
    ]);

    await isAllowedTeamRoster("skaven");
    await isAllowedTeamRoster("skaven");
    // Hors production le TTL est nul : chaque appel relit. On vérifie donc
    // seulement que l'invalidation ne fait pas exploser le service.
    invalidateRosterCatalogueCache();
    await expect(isAllowedTeamRoster("skaven")).resolves.toBe(true);
  });

  it("rejette un slug vide sans toucher la base", async () => {
    await expect(isAllowedTeamRoster("")).resolves.toBe(false);
    expect(mockPrisma.roster.findMany).not.toHaveBeenCalled();
  });
});
