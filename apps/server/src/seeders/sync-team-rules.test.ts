/**
 * Lot 6.5 — le seed des catalogues de règles est « create-if-missing ».
 *
 * Ces tables sont maintenant LUES en priorité : le déploiement doit les
 * peupler, mais une description corrigée en admin ne doit pas être écrasée au
 * déploiement suivant (`force` reste la sortie explicite).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    teamSpecialRule: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    regionalLeague: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../services/team-rules-catalogue", () => ({
  invalidateTeamRulesCatalogueCache: vi.fn(),
}));

import { prisma } from "../prisma";
import { invalidateTeamRulesCatalogueCache } from "../services/team-rules-catalogue";
import { syncTeamRules } from "./sync-team-rules";

const db = prisma as unknown as {
  teamSpecialRule: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  regionalLeague: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("syncTeamRules", () => {
  it("crée les lignes manquantes d'une édition", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue(null);
    db.regionalLeague.findUnique.mockResolvedValue(null);

    const res = await syncTeamRules({ write: true, ruleset: "season_3" });

    expect(res.specialRules.created).toBeGreaterThan(0);
    expect(res.regionalLeagues.created).toBeGreaterThan(0);
    expect(res.specialRules.skipped).toBe(0);
    expect(db.teamSpecialRule.create).toHaveBeenCalled();
    expect(invalidateTeamRulesCatalogueCache).toHaveBeenCalled();
  });

  it("n'écrase JAMAIS une ligne existante sans `force`", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue({ id: "r1" });
    db.regionalLeague.findUnique.mockResolvedValue({ id: "l1" });

    const res = await syncTeamRules({ write: true, ruleset: "season_3" });

    expect(res.specialRules.created).toBe(0);
    expect(res.specialRules.updated).toBe(0);
    expect(res.specialRules.skipped).toBeGreaterThan(0);
    expect(db.teamSpecialRule.create).not.toHaveBeenCalled();
    expect(db.teamSpecialRule.update).not.toHaveBeenCalled();
  });

  it("`force` réécrit les lignes existantes depuis le moteur", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue({ id: "r1" });
    db.regionalLeague.findUnique.mockResolvedValue({ id: "l1" });

    const res = await syncTeamRules({
      write: true,
      force: true,
      ruleset: "season_3",
    });

    expect(res.specialRules.updated).toBeGreaterThan(0);
    expect(db.teamSpecialRule.update).toHaveBeenCalled();
  });

  it("dry-run par défaut : aucune écriture", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue(null);
    db.regionalLeague.findUnique.mockResolvedValue(null);

    const res = await syncTeamRules({ ruleset: "season_3" });

    expect(res.write).toBe(false);
    expect(res.specialRules.created).toBeGreaterThan(0);
    expect(db.teamSpecialRule.create).not.toHaveBeenCalled();
    expect(invalidateTeamRulesCatalogueCache).not.toHaveBeenCalled();
  });

  it("couvre les deux éditions sans filtre", async () => {
    db.teamSpecialRule.findUnique.mockResolvedValue(null);
    db.regionalLeague.findUnique.mockResolvedValue(null);

    const oneEdition = await syncTeamRules({ ruleset: "season_3" });
    const allEditions = await syncTeamRules();

    expect(allEditions.specialRules.created).toBe(
      oneEdition.specialRules.created * 2,
    );
  });
});
