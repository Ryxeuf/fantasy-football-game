/**
 * « Trois-quarts à vil prix » (Ogres, Snotlings) bout en bout côté serveur.
 *
 * Règle : quand une équipe ayant cette règle spéciale calcule sa Valeur
 * d'Équipe ACTUELLE, le Coût d'Embauche des Trois-quarts vaut 0 po ; toute
 * augmentation de valeur de ces joueurs est incluse normalement. La VE, elle,
 * reste au tarif plein.
 */

import { describe, it, expect, vi } from "vitest";
import { updateTeamValues } from "./team-values";

/** Un Trois-quart Gnoblar (0-16, 15k) et un Ogre (0-6, 140k). */
const OGRE_POSITIONS = [
  { slug: "ogre_trois_quart_gnoblar", cost: 15, max: 16 },
  { slug: "ogre_ogre", cost: 140, max: 6 },
];

interface FakePlayer {
  position: string;
  advancements: string;
  dead: boolean;
  firedAt: Date | null;
  missNextMatch: boolean;
}

function player(position: string, advancements = "[]"): FakePlayer {
  return {
    position,
    advancements,
    dead: false,
    firedAt: null,
    missNextMatch: false,
  };
}

function buildPrisma(players: FakePlayer[], specialRules: string | null) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    team: {
      findUnique: vi.fn().mockResolvedValue({
        id: "team-ogre",
        roster: "ogre",
        ruleset: "season_3",
        format: "bb11",
        players,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        dedicatedFans: 1,
      }),
      update,
    },
    skill: { findMany: vi.fn().mockResolvedValue([]) },
    roster: {
      findUnique: vi.fn().mockResolvedValue({ id: "r-ogre", specialRules }),
    },
    rosterStaffConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    position: { findMany: vi.fn().mockResolvedValue(OGRE_POSITIONS) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma: prisma as any, update };
}

describe("updateTeamValues — Trois-quarts à vil prix", () => {
  const roster = [
    player("ogre_trois_quart_gnoblar"),
    player("ogre_trois_quart_gnoblar"),
    player("ogre_ogre"),
  ];

  it("annule le coût d'embauche des Trois-quarts dans la VEA seulement", async () => {
    const { prisma } = buildPrisma(
      roster,
      "bagarreurs_brutaux,trois_quarts_a_vil_prix",
    );

    const out = await updateTeamValues(prisma, "team-ogre");

    // VE : 2×15k + 140k au tarif plein.
    expect(out.teamValue).toBe(170_000);
    // VEA : les 2 Trois-quarts comptent pour 0, l'Ogre reste à 140k.
    expect(out.currentValue).toBe(140_000);
  });

  it("garde les augmentations des Trois-quarts dans la VEA", async () => {
    const primary = JSON.stringify([{ type: "primary", skillSlug: "block" }]);
    const { prisma } = buildPrisma(
      [player("ogre_trois_quart_gnoblar", primary), player("ogre_ogre")],
      "trois_quarts_a_vil_prix",
    );

    const out = await updateTeamValues(prisma, "team-ogre");

    // VE : (15k + 20k) + 140k.
    expect(out.teamValue).toBe(175_000);
    // VEA : embauche annulée mais la primaire (20k) reste comptée.
    expect(out.currentValue).toBe(160_000);
  });

  it("VEA = VE pour un roster sans la règle spéciale", async () => {
    const { prisma } = buildPrisma(roster, "bagarreurs_brutaux");

    const out = await updateTeamValues(prisma, "team-ogre");

    expect(out.currentValue).toBe(out.teamValue);
    expect(out.teamValue).toBe(170_000);
  });
});
