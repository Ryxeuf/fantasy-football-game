/**
 * Régression « les 150K inexpliqués » — équipe Ogre à 16 joueurs.
 *
 * Signalé en prod sur la page publique de partage : VE 1 415K mais VEA
 * 1 265K, alors qu'aucun joueur n'est indisponible et que la trésorerie est
 * à 0. L'écart est en réalité « Trois-quarts à vil prix » (règle du roster
 * Ogre) : les 10 Trois-Quarts Gnoblar valent 15K de Coût d'Embauche chacun,
 * annulés dans la VEA seulement.
 *
 * Ce test FIGE les trois chiffres affichés (coût de l'effectif, VE, VEA) sur
 * ce roster précis, ainsi que la DÉCOMPOSITION de l'écart : sans elle, un
 * futur changement pourrait déplacer les 150K d'un poste à l'autre sans que
 * rien n'échoue.
 *
 * Le second cas rend un Bloqueur indisponible pour couvrir la sémantique
 * ordinaire de la VEA (VE moins la valeur des joueurs qui ratent le
 * prochain match), que la règle spéciale ne remplace pas : elle s'y ajoute.
 */

import { describe, it, expect, vi } from "vitest";
import { computeTeamValueBreakdownFor, updateTeamValues } from "./team-values";

/** Postes Ogre au tarif du catalogue (kpo, comme la colonne `Position.cost`). */
const OGRE_POSITIONS = [
  { slug: "ogre_trois_quart_gnoblar", cost: 15, max: 16 },
  { slug: "ogre_bloqueur_ogre", cost: 140, max: 5 },
  { slug: "ogre_botte_nabots_ogre", cost: 145, max: 1 },
];

/** Compétences Élite de la Saison 3 (+10 000 po de surcoût VE chacune). */
const ELITE_SKILLS = [
  { slug: "block" },
  { slug: "dodge" },
  { slug: "guard" },
  { slug: "mighty-blow-1" },
];

/**
 * Le surcoût VE d'un avancement est dicté par le `type` PERSISTÉ, jamais
 * re-dérivé de la catégorie de la compétence : on encode donc ici les types
 * qui reproduisent les valeurs réellement affichées pour cette équipe.
 */
const adv = (
  entries: ReadonlyArray<{ type: string; skillSlug: string }>,
): string => JSON.stringify(entries);

interface FakePlayer {
  position: string;
  advancements: string;
  dead: boolean;
  firedAt: Date | null;
  missNextMatch: boolean;
}

function player(
  position: string,
  advancements = "[]",
  missNextMatch = false,
): FakePlayer {
  return {
    position,
    advancements,
    dead: false,
    firedAt: null,
    missNextMatch,
  };
}

/** L'effectif exact des « Cerfs violents » : 16 joueurs, 1 235K de valeur. */
function cerfsViolents(): FakePlayer[] {
  return [
    // Botte-nabots + Bagarreur (Force, principale, non Élite) : 145 + 20.
    player(
      "ogre_botte_nabots_ogre",
      adv([{ type: "primary", skillSlug: "brawler" }]),
    ),
    // Bloqueur + Garde (principale Élite : 30) + Blocage (secondaire Élite : 50).
    player(
      "ogre_bloqueur_ogre",
      adv([
        { type: "primary", skillSlug: "guard" },
        { type: "secondary", skillSlug: "block" },
      ]),
    ),
    // 4 Bloqueurs + Garde : 140 + 30 = 170 chacun.
    ...Array.from({ length: 4 }, () =>
      player(
        "ogre_bloqueur_ogre",
        adv([{ type: "primary", skillSlug: "guard" }]),
      ),
    ),
    // Gnoblar + Joueur Déloyal (non Élite) : 15 + 20 = 35.
    player(
      "ogre_trois_quart_gnoblar",
      adv([{ type: "primary", skillSlug: "dirty-player-1" }]),
    ),
    // 9 Gnoblars de base à 15K.
    ...Array.from({ length: 9 }, () => player("ogre_trois_quart_gnoblar")),
  ];
}

/** Staff des « Cerfs violents » : 2 relances, 2 pom-pom, 2 assistants. */
const TEAM = {
  id: "team-cerfs-violents",
  name: "Cerfs violents",
  roster: "ogre",
  ruleset: "season_3",
  format: "bb11",
  rerolls: 2,
  cheerleaders: 2,
  assistants: 2,
  apothecary: false,
  dedicatedFans: 2,
  treasury: 0,
} as const;

function buildPrisma(players: FakePlayer[]) {
  const update = vi.fn().mockResolvedValue({});
  const prisma = {
    team: {
      findUnique: vi.fn().mockResolvedValue({ ...TEAM, players }),
      update,
    },
    skill: { findMany: vi.fn().mockResolvedValue(ELITE_SKILLS) },
    roster: {
      findUnique: vi.fn().mockResolvedValue({
        id: "r-ogre",
        specialRules: "bagarreurs_brutaux,trois_quarts_a_vil_prix",
      }),
    },
    rosterStaffConfig: { findUnique: vi.fn().mockResolvedValue(null) },
    position: { findMany: vi.fn().mockResolvedValue(OGRE_POSITIONS) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { prisma: prisma as any, update };
}

describe("VE/VEA — Ogres « Cerfs violents » (16 joueurs)", () => {
  it("fige les trois chiffres affichés et la décomposition de l'écart", async () => {
    const players = cerfsViolents();
    const { prisma } = buildPrisma(players);

    const b = await computeTeamValueBreakdownFor(prisma, TEAM, players);

    expect(players).toHaveLength(16);
    // « Coût de l'effectif » : 165 + 220 + 4×170 + 35 + 9×15.
    expect(b.playersCost).toBe(1_235_000);
    // Part payée en OR : 145 + 140 + 4×140 + 10×15.
    expect(b.playersHireCost).toBe(995_000);
    expect(b.advancementsCost).toBe(240_000);
    // Staff : 2 relances à 70K + 2 pom-pom et 2 assistants à 10K.
    expect(b.rerollsCost).toBe(140_000);
    expect(b.staffCost).toBe(40_000);
    // « Valeur d'équipe » — les fans dévoués n'y entrent pas.
    expect(b.teamValue).toBe(1_415_000);
    // « VE actuelle ».
    expect(b.currentValue).toBe(1_265_000);

    // L'écart de 150K : aucun joueur indisponible, tout vient de la règle
    // spéciale — 10 Gnoblars × 15K de Coût d'Embauche.
    expect(b.teamValue - b.currentValue).toBe(150_000);
    expect(b.unavailablePlayersCost).toBe(0);
    expect(b.cheapLinemenWaived).toBe(150_000);
  });

  it("persiste ces mêmes valeurs sur la ligne `Team`", async () => {
    const { prisma, update } = buildPrisma(cerfsViolents());

    const out = await updateTeamValues(prisma, TEAM.id);

    expect(out).toEqual({ teamValue: 1_415_000, currentValue: 1_265_000 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEAM.id },
        data: { teamValue: 1_415_000, currentValue: 1_265_000 },
      }),
    );
  });

  it("retranche EN PLUS la valeur d'un joueur indisponible", async () => {
    // Un Bloqueur + Garde (170K) rate le prochain match : c'est le 3e
    // joueur de l'effectif (0 = Botte-nabots, 1 = Bloqueur à deux
    // compétences, 2..5 = les quatre Bloqueurs + Garde).
    const players = cerfsViolents();
    players[2] = { ...players[2], missNextMatch: true };
    const { prisma } = buildPrisma(players);

    const b = await computeTeamValueBreakdownFor(prisma, TEAM, players);

    // La VE ne bouge pas : un joueur indisponible reste au roster.
    expect(b.teamValue).toBe(1_415_000);
    expect(b.unavailablePlayersCost).toBe(170_000);
    // La règle spéciale s'ajoute à l'exclusion, elle ne la remplace pas.
    expect(b.cheapLinemenWaived).toBe(150_000);
    expect(b.currentValue).toBe(1_415_000 - 170_000 - 150_000);
  });

  it("sans « Trois-quarts à vil prix », la VEA rejoint la VE", async () => {
    const players = cerfsViolents();
    const { prisma } = buildPrisma(players);
    prisma.roster.findUnique.mockResolvedValue({
      id: "r-ogre",
      specialRules: "bagarreurs_brutaux",
    });

    const b = await computeTeamValueBreakdownFor(prisma, TEAM, players);

    expect(b.cheapLinemenWaived).toBe(0);
    expect(b.currentValue).toBe(1_415_000);
  });
});
