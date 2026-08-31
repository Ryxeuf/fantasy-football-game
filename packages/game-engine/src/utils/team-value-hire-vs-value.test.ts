/**
 * Séparation « coût d'EMBAUCHE » (or) / « VALEUR » (VE), et lisibilité de
 * l'écart VE → VEA.
 *
 * Régression couverte (cas prod, équipe Ogre sous NAF World Cup 2027) :
 *  - une équipe construite au budget EXACT s'affichait « Budget dépassé »
 *    à hauteur de ses compétences, parce que les surcoûts d'avancement —
 *    payés en PSP — étaient comptés au budget d'or ;
 *  - sa VEA était inférieure à sa VE sans qu'aucun poste ne l'explique,
 *    alors que « Trois-quarts à vil prix » en donnait la raison exacte.
 */

import { describe, it, expect } from "vitest";
import {
  calculateTeamValueBreakdown,
  CHEAP_LINEMEN_RULE,
  type TeamValueData,
  type TeamValuePlayer,
} from "./team-value-calculator";

/** Un Trois-quart Gnoblar (15k) avec `surcharge` po d'augmentations. */
function gnoblar(surcharge = 0, available = true): TeamValuePlayer {
  return { cost: 15_000 + surcharge, hireCost: 15_000, lineman: true, available };
}

/** Un Bloqueur Ogre (140k) avec `surcharge` po d'augmentations. */
function ogre(surcharge = 0, available = true): TeamValuePlayer {
  return { cost: 140_000 + surcharge, hireCost: 140_000, lineman: false, available };
}

function data(overrides: Partial<TeamValueData> = {}): TeamValueData {
  return {
    players: [],
    rerolls: 0,
    cheerleaders: 0,
    assistants: 0,
    apothecary: false,
    roster: "ogre",
    staffConfig: {
      rerollCost: 70_000,
      cheerleaderCost: 10_000,
      assistantCost: 10_000,
      apothecaryCost: 50_000,
    },
    ...overrides,
  };
}

describe("calculateTeamValueBreakdown — embauche vs valeur", () => {
  it("sépare le coût d'embauche des surcoûts d'avancement", () => {
    const b = calculateTeamValueBreakdown(
      data({ players: [ogre(90_000), gnoblar(20_000), gnoblar()] }),
    );

    expect(b.playersHireCost).toBe(140_000 + 15_000 + 15_000);
    expect(b.advancementsCost).toBe(90_000 + 20_000);
    expect(b.playersCost).toBe(b.playersHireCost + b.advancementsCost);
  });

  it("reproduit l'équipe Ogre remontée : 995k d'embauches, 1 415k de VE, 1 265k de VEA", () => {
    // Effectif : 5 Bloqueurs Ogres (140k) + 1 Botte-nabots (145k) +
    // 10 Trois-quarts Gnoblars (15k) = 995k d'EMBAUCHES, soit exactement le
    // budget de 1 180k une fois les 185k de staff et de fans ajoutés.
    // Par-dessus, 240k d'augmentations achetées sur le pool de PSP : elles
    // montent la VE à 1 415k sans toucher un po du budget.
    const players: TeamValuePlayer[] = [
      ogre(90_000),
      ...Array.from({ length: 4 }, () => ogre(30_000)),
      { cost: 165_000, hireCost: 145_000, lineman: false, available: true },
      gnoblar(10_000),
      ...Array.from({ length: 9 }, () => gnoblar()),
    ];
    const b = calculateTeamValueBreakdown(
      data({
        players,
        rerolls: 2,
        cheerleaders: 2,
        assistants: 2,
        specialRules: [CHEAP_LINEMEN_RULE],
      }),
    );

    expect(b.playersHireCost).toBe(995_000);
    expect(b.advancementsCost).toBe(240_000);
    expect(b.playersCost).toBe(1_235_000);
    // Staff + relances : 2 × 70k de relances + 20k + 20k. Les fans dévoués
    // (5k) sont payés en or mais n'entrent pas dans la VE.
    expect(b.staffCost + b.rerollsCost).toBe(180_000);
    expect(b.teamValue).toBe(1_415_000);
    // VEA = VE − les 10 embauches de Trois-quarts (150k), et RIEN d'autre :
    // c'est toute l'explication de l'écart constaté sur une équipe qui n'a
    // joué aucun match.
    expect(b.cheapLinemenWaived).toBe(150_000);
    expect(b.unavailablePlayersCost).toBe(0);
    expect(b.currentValue).toBe(1_265_000);
  });

  it("hireCost absent vaut « aucune augmentation »", () => {
    const b = calculateTeamValueBreakdown(
      data({ players: [{ cost: 50_000, available: true }] }),
    );

    expect(b.playersHireCost).toBe(50_000);
    expect(b.advancementsCost).toBe(0);
  });

  it("ne compte pas un hireCost incohérent au-delà de la valeur du joueur", () => {
    // Donnée aberrante (poste renchéri en admin après l'embauche) : le
    // surcoût d'avancement ne doit jamais devenir négatif.
    const b = calculateTeamValueBreakdown(
      data({ players: [{ cost: 50_000, hireCost: 90_000, available: true }] }),
    );

    expect(b.playersHireCost).toBe(50_000);
    expect(b.advancementsCost).toBe(0);
  });
});

describe("calculateTeamValueBreakdown — écart VE → VEA lisible", () => {
  it("chiffre l'exonération « Trois-quarts à vil prix »", () => {
    const players = [ogre(), gnoblar(20_000), gnoblar()];
    const b = calculateTeamValueBreakdown(
      data({ players, specialRules: [CHEAP_LINEMEN_RULE] }),
    );

    // Deux Trois-quarts embauchés 15k chacun.
    expect(b.cheapLinemenWaived).toBe(30_000);
    // Les augmentations des Trois-quarts restent comptées.
    expect(b.currentValue).toBe(b.teamValue - 30_000);
  });

  it("chiffre les joueurs indisponibles au prochain match", () => {
    const b = calculateTeamValueBreakdown(
      data({ players: [ogre(), ogre(30_000, false)] }),
    );

    expect(b.unavailablePlayersCost).toBe(170_000);
    expect(b.cheapLinemenWaived).toBe(0);
    expect(b.currentValue).toBe(b.teamValue - 170_000);
  });

  it("n'exonère pas un Trois-quart déjà exclu de la VEA (pas de double compte)", () => {
    const b = calculateTeamValueBreakdown(
      data({
        players: [gnoblar(0, false), gnoblar()],
        specialRules: [CHEAP_LINEMEN_RULE],
      }),
    );

    // Seul le Trois-quart DISPONIBLE est exonéré.
    expect(b.unavailablePlayersCost).toBe(15_000);
    expect(b.cheapLinemenWaived).toBe(15_000);
    expect(b.currentValue).toBe(
      b.teamValue - b.unavailablePlayersCost - b.cheapLinemenWaived,
    );
  });

  it("tient l'invariant VEA = VE − indisponibles − exonération", () => {
    const cases: ReadonlyArray<TeamValueData> = [
      data({ players: [ogre(90_000), gnoblar(20_000)], rerolls: 2 }),
      data({
        players: [ogre(), gnoblar(20_000, false), gnoblar()],
        specialRules: [CHEAP_LINEMEN_RULE],
        rerolls: 1,
        cheerleaders: 3,
        apothecary: true,
      }),
      data({ players: [], rerolls: 4 }),
    ];

    for (const d of cases) {
      const b = calculateTeamValueBreakdown(d);
      expect(b.currentValue).toBe(
        b.teamValue - b.unavailablePlayersCost - b.cheapLinemenWaived,
      );
      expect(b.playersCost).toBe(b.playersHireCost + b.advancementsCost);
    }
  });

  it("laisse VEA = VE quand rien ne les sépare", () => {
    const b = calculateTeamValueBreakdown(
      data({ players: [ogre(90_000), gnoblar(20_000)], rerolls: 2 }),
    );

    expect(b.unavailablePlayersCost).toBe(0);
    expect(b.cheapLinemenWaived).toBe(0);
    expect(b.currentValue).toBe(b.teamValue);
  });
});
