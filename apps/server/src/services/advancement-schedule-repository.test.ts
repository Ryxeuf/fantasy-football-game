/**
 * Lot 6.2 — le barème d'avancement vient de la base, PAR ÉDITION.
 *
 * Le bug corrigé : `utils/advancements.ts` décrit la Saison 3 et était
 * appliqué à toutes les équipes, Saison 2 comprise (coûts PSP ET surcoûts de
 * VE). Ce fichier verrouille la lecture DB-first, le repli, et le refus d'un
 * barème À TROUS — qui rendrait un avancement gratuit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    advancementCost: { findMany: vi.fn() },
    characteristicValue: { findMany: vi.fn() },
    rulesetConfig: { findUnique: vi.fn() },
    team: { findUnique: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}));

import {
  DEFAULT_ADVANCEMENT_SCHEDULE,
  getNextAdvancementPspCost,
  surchargeForAdvancement,
} from "@bb/game-engine";
import { prisma } from "../prisma";
import {
  buildSchedule,
  invalidateAdvancementScheduleCache,
  loadAdvancementSchedule,
  loadScheduleForTeam,
} from "./advancement-schedule-repository";

const db = prisma as unknown as {
  advancementCost: { findMany: ReturnType<typeof vi.fn> };
  characteristicValue: { findMany: ReturnType<typeof vi.fn> };
  rulesetConfig: { findUnique: ReturnType<typeof vi.fn> };
  team: { findUnique: ReturnType<typeof vi.fn> };
};

/** Grille complète (6 paliers) pour un type. */
function grid(kind: string, spp: readonly number[], surcharge = 20000) {
  return spp.map((sppCost, i) => ({
    kind,
    step: i + 1,
    sppCost,
    teamValueSurcharge: surcharge,
  }));
}

beforeEach(() => {
  vi.resetAllMocks();
  invalidateAdvancementScheduleCache();
  db.advancementCost.findMany.mockResolvedValue([]);
  db.characteristicValue.findMany.mockResolvedValue([]);
  db.rulesetConfig.findUnique.mockResolvedValue(null);
});

describe("loadAdvancementSchedule", () => {
  it("applique le barème Saison 2 à une équipe Saison 2", async () => {
    // Livre 2020 : secondaire choisie à 12 PSP (10 en Saison 3).
    db.advancementCost.findMany.mockResolvedValue(
      grid("secondary", [12, 14, 18, 22, 26, 40], 40000),
    );

    const schedule = await loadAdvancementSchedule("season_2");
    expect(getNextAdvancementPspCost(0, "secondary", schedule)).toBe(12);
    // Sans barème, l'ancien comportement : la valeur Saison 3.
    expect(getNextAdvancementPspCost(0, "secondary")).toBe(10);
  });

  it("sert le surcoût de VE de l'édition", async () => {
    db.advancementCost.findMany.mockResolvedValue(
      grid("primary", [6, 8, 12, 16, 20, 30], 25000),
    );
    db.characteristicValue.findMany.mockResolvedValue([
      { stat: "st", surcharge: 80000 },
    ]);

    const schedule = await loadAdvancementSchedule("season_2");
    expect(surchargeForAdvancement({ type: "primary" }, schedule)).toBe(25000);
    expect(
      surchargeForAdvancement({ type: "characteristic", stat: "st" }, schedule),
    ).toBe(80000);
  });

  it("sert la taxe Élite de l'édition", async () => {
    db.rulesetConfig.findUnique.mockResolvedValue({ eliteSkillSurcharge: 0 });

    const schedule = await loadAdvancementSchedule("season_2");
    expect(
      surchargeForAdvancement({ type: "primary", isElite: true }, schedule),
    ).toBe(20000);
  });

  it("retombe sur le barème compilé quand la table est vide", async () => {
    await expect(loadAdvancementSchedule("season_3")).resolves.toBe(
      DEFAULT_ADVANCEMENT_SCHEDULE,
    );
  });

  it("retombe sur le barème compilé quand la base est injoignable", async () => {
    db.advancementCost.findMany.mockRejectedValue(new Error("no db"));
    await expect(loadAdvancementSchedule("season_3")).resolves.toBe(
      DEFAULT_ADVANCEMENT_SCHEDULE,
    );
  });
});

describe("buildSchedule", () => {
  it("ignore un type à trous plutôt que de rendre un palier gratuit", () => {
    const partial = grid("secondary", [12, 14, 18, 22, 26, 40]).slice(0, 3);
    const schedule = buildSchedule(partial, [], null);

    // Palier 4 absent en base ⇒ le type entier retombe sur la table compilée.
    expect(getNextAdvancementPspCost(0, "secondary", schedule)).toBe(10);
  });

  it("traduit `random_primary` (base) en `random-primary` (moteur)", () => {
    const schedule = buildSchedule(
      grid("random_primary", [1, 2, 3, 4, 5, 6], 5000),
      [],
      null,
    );
    expect(getNextAdvancementPspCost(0, "random-primary", schedule)).toBe(1);
    expect(surchargeForAdvancement({ type: "random-primary" }, schedule)).toBe(
      5000,
    );
  });

  it("ignore une caractéristique inconnue ou négative", () => {
    const schedule = buildSchedule(
      [],
      [
        { stat: "pas_une_stat", surcharge: 1 },
        { stat: "st", surcharge: -5 },
      ],
      null,
    );
    expect(
      surchargeForAdvancement({ type: "characteristic", stat: "st" }, schedule),
    ).toBe(DEFAULT_ADVANCEMENT_SCHEDULE.characteristicSurcharge.st);
  });
});

describe("loadScheduleForTeam", () => {
  it("résout l'édition depuis l'équipe", async () => {
    db.team.findUnique.mockResolvedValue({ ruleset: "season_2" });
    db.advancementCost.findMany.mockResolvedValue(
      grid("secondary", [12, 14, 18, 22, 26, 40], 40000),
    );

    const schedule = await loadScheduleForTeam("team-1");
    expect(getNextAdvancementPspCost(0, "secondary", schedule)).toBe(12);
  });

  it("dégrade sans équipe", async () => {
    await expect(loadScheduleForTeam(null)).resolves.toBe(
      DEFAULT_ADVANCEMENT_SCHEDULE,
    );
  });
});
