/**
 * `computeBuildBudget` — deux monnaies, un seul budget.
 *
 * Régression couverte : l'écran d'édition confrontait la VALEUR des joueurs
 * (embauches + surcoûts d'avancement) au budget d'or et annonçait « Budget
 * dépassé ! −240k » sur une équipe pourtant construite au budget EXACT.
 */
import { describe, it, expect } from "vitest";
import {
  advancementSurchargePo,
  computeBuildBudget,
  parseAdvancementsJson,
  type AdvancementSurcharges,
  type BudgetPlayer,
} from "./build-budget";

/** Barème Saison 3 : primaire +20k, secondaire +40k, Élite +10k. */
const SURCHARGES: AdvancementSurcharges = {
  byType: { primary: 20_000, secondary: 40_000, "random-primary": 20_000 },
  eliteExtra: 10_000,
  eliteSlugs: new Set(["guard", "block"]),
};

/** Tarifs du roster Ogre : Bloqueur 140k, Botte-nabots 145k, Gnoblar 15k. */
const OGRE_COSTS: Record<string, number> = {
  ogre_bloqueur: 140_000,
  ogre_botte_nabots: 145_000,
  ogre_trois_quart_gnoblar: 15_000,
};
const hireCostOf = (position: string): number => OGRE_COSTS[position] ?? 0;

function player(position: string, advancements: unknown[] = []): BudgetPlayer {
  return { position, advancements: JSON.stringify(advancements) };
}

describe("parseAdvancementsJson", () => {
  it("tolère chaîne JSON, tableau natif, null et JSON invalide", () => {
    expect(parseAdvancementsJson('[{"type":"primary"}]')).toHaveLength(1);
    expect(parseAdvancementsJson([{ type: "primary" }])).toHaveLength(1);
    expect(parseAdvancementsJson(null)).toEqual([]);
    expect(parseAdvancementsJson("pas du json")).toEqual([]);
    expect(parseAdvancementsJson('{"type":"primary"}')).toEqual([]);
  });
});

describe("advancementSurchargePo", () => {
  it("ajoute le surcoût Élite au surcoût de type", () => {
    expect(
      advancementSurchargePo(
        JSON.stringify([{ type: "primary", skillSlug: "guard" }]),
        SURCHARGES,
      ),
    ).toBe(30_000);
    expect(
      advancementSurchargePo(
        JSON.stringify([{ type: "primary", skillSlug: "brawler" }]),
        SURCHARGES,
      ),
    ).toBe(20_000);
  });

  it("ignore un type d'amélioration inconnu", () => {
    expect(
      advancementSurchargePo(JSON.stringify([{ type: "inconnu" }]), SURCHARGES),
    ).toBe(0);
  });
});

describe("computeBuildBudget", () => {
  /** L'équipe Ogre remontée : 995k d'embauches, 185k de staff, budget 1 180k. */
  function ogreTeam() {
    return {
      players: [
        player("ogre_bloqueur", [
          { type: "primary", skillSlug: "guard" },
          { type: "secondary", skillSlug: "block" },
        ]),
        ...Array.from({ length: 4 }, () =>
          player("ogre_bloqueur", [{ type: "primary", skillSlug: "guard" }]),
        ),
        player("ogre_botte_nabots", [
          { type: "primary", skillSlug: "brawler" },
        ]),
        player("ogre_trois_quart_gnoblar", [
          { type: "primary", skillSlug: "dirty-player" },
        ]),
        ...Array.from({ length: 9 }, () =>
          player("ogre_trois_quart_gnoblar"),
        ),
      ],
      hireCostOf,
      staffSpend: 185_000,
      starPlayersCost: 0,
      budgetPo: 1_180_000,
      surcharges: SURCHARGES,
    };
  }

  it("ne déclare PAS dépassé un budget tenu à l'or près", () => {
    const b = computeBuildBudget(ogreTeam());

    // 5 × 140k + 145k + 10 × 15k = 995k d'embauches.
    expect(b.playersHireCost).toBe(995_000);
    // 995k + 185k = 1 180k : le budget est tenu EXACTEMENT.
    expect(b.totalSpent).toBe(1_180_000);
    expect(b.remaining).toBe(0);
    expect(b.isOverBudget).toBe(false);
  });

  it("compte les augmentations dans la VALEUR, jamais dans le budget", () => {
    const b = computeBuildBudget(ogreTeam());

    // Garde Élite 30k ×5 + Blocage Élite secondaire 50k + Bagarreur 20k +
    // Joueur Déloyal 20k = 240k : le montant exact du « −240k » affiché.
    expect(b.advancementsCost).toBe(240_000);
    expect(b.playersCost).toBe(1_235_000);
    // …et pourtant l'or engagé n'a pas bougé.
    expect(b.totalSpent).toBe(1_180_000);
  });

  it("déclare dépassé un budget réellement dépassé par les embauches", () => {
    const b = computeBuildBudget({
      ...ogreTeam(),
      players: [...ogreTeam().players, player("ogre_bloqueur")],
      budgetPo: 1_180_000,
    });

    expect(b.playersHireCost).toBe(1_135_000);
    expect(b.remaining).toBe(-140_000);
    expect(b.isOverBudget).toBe(true);
  });

  it("compte le staff et les Star Players dans l'or engagé", () => {
    const b = computeBuildBudget({
      players: [player("ogre_bloqueur")],
      hireCostOf,
      staffSpend: 70_000,
      starPlayersCost: 250_000,
      budgetPo: 1_000_000,
      surcharges: SURCHARGES,
    });

    expect(b.totalSpent).toBe(140_000 + 70_000 + 250_000);
    expect(b.remaining).toBe(540_000);
  });

  it("tient l'invariant valeur = embauches + augmentations", () => {
    const b = computeBuildBudget(ogreTeam());
    expect(b.playersCost).toBe(b.playersHireCost + b.advancementsCost);
  });

  it("gère un roster vide", () => {
    const b = computeBuildBudget({
      players: [],
      hireCostOf,
      staffSpend: 0,
      starPlayersCost: 0,
      budgetPo: 1_000_000,
      surcharges: SURCHARGES,
    });

    expect(b).toEqual({
      playersHireCost: 0,
      advancementsCost: 0,
      playersCost: 0,
      totalSpent: 0,
      remaining: 1_000_000,
      isOverBudget: false,
    });
  });
});
