/**
 * Valeur d'un joueur dans la composition : le serveur fait foi, le repli
 * local ne sert qu'à un serveur pré-correctif.
 *
 * Régression couverte : la colonne « Coût » affichait le tarif d'EMBAUCHE
 * du poste. Un Bloqueur Ogre recruté 140k et augmenté de deux compétences y
 * restait à 140k, alors qu'il pesait 230k dans la VE affichée au-dessus.
 */
import { describe, it, expect } from "vitest";
import {
  advancementSurchargeFallbackPo,
  makePlayerValueResolver,
} from "./roster-player-value";

/** Barème Saison 3 (miroir de `SURCHARGE_PER_ADVANCEMENT`). */
const BY_TYPE = {
  primary: 20_000,
  secondary: 40_000,
  "random-primary": 20_000,
};

const HIRE: Record<string, number> = {
  ogre_bloqueur: 140_000,
  ogre_trois_quart_gnoblar: 15_000,
};
const hireCostOf = (position: string): number => HIRE[position] ?? 0;

describe("advancementSurchargeFallbackPo", () => {
  it("somme les surcoûts par type", () => {
    expect(
      advancementSurchargeFallbackPo(
        JSON.stringify([{ type: "primary" }, { type: "secondary" }]),
        BY_TYPE,
      ),
    ).toBe(60_000);
  });

  it("tolère chaîne JSON, tableau natif, null et JSON invalide", () => {
    expect(advancementSurchargeFallbackPo([{ type: "primary" }], BY_TYPE)).toBe(
      20_000,
    );
    expect(advancementSurchargeFallbackPo(null, BY_TYPE)).toBe(0);
    expect(advancementSurchargeFallbackPo("pas du json", BY_TYPE)).toBe(0);
    expect(advancementSurchargeFallbackPo('{"type":"primary"}', BY_TYPE)).toBe(0);
  });

  it("ignore un type inconnu et une entrée non-objet", () => {
    expect(
      advancementSurchargeFallbackPo(
        JSON.stringify([{ type: "inconnu" }, null, 42, { pas: "de type" }]),
        BY_TYPE,
      ),
    ).toBe(0);
  });
});

describe("makePlayerValueResolver", () => {
  const player = {
    id: "p1",
    position: "ogre_bloqueur",
    advancements: JSON.stringify([
      { type: "primary", skillSlug: "guard" },
      { type: "secondary", skillSlug: "block" },
    ]),
  };

  it("préfère la valeur servie par le serveur (surcoût Élite compris)", () => {
    const resolve = makePlayerValueResolver({
      // 140k + Garde Élite 30k + Blocage Élite secondaire 50k = 220k :
      // un chiffre que le repli local ne sait PAS reconstituer.
      served: { p1: { hireCost: 140_000, advancementsCost: 80_000, value: 220_000 } },
      hireCostOf,
      surchargeByType: BY_TYPE,
    });

    expect(resolve(player)).toBe(220_000);
  });

  it("retombe sur « embauche + surcoûts standards » sans donnée serveur", () => {
    const resolve = makePlayerValueResolver({
      served: undefined,
      hireCostOf,
      surchargeByType: BY_TYPE,
    });

    // 140k + 20k + 40k = 200k : sans le catalogue Élite, le repli
    // sous-estime, mais il ne montre plus le tarif de recrue.
    expect(resolve(player)).toBe(200_000);
    // Et surtout : ce n'est plus 140k.
    expect(resolve(player)).not.toBe(140_000);
  });

  it("retombe sur le repli pour un joueur absent de la réponse serveur", () => {
    const resolve = makePlayerValueResolver({
      served: { autre: { hireCost: 1, advancementsCost: 0, value: 1 } },
      hireCostOf,
      surchargeByType: BY_TYPE,
    });

    expect(resolve(player)).toBe(200_000);
  });

  it("rend son tarif d'embauche à un joueur sans amélioration", () => {
    const resolve = makePlayerValueResolver({
      served: {},
      hireCostOf,
      surchargeByType: BY_TYPE,
    });

    expect(
      resolve({ id: "p9", position: "ogre_trois_quart_gnoblar", advancements: "[]" }),
    ).toBe(15_000);
  });

  it("gère un joueur sans id (brouillon non encore persisté)", () => {
    const resolve = makePlayerValueResolver({
      served: { p1: { hireCost: 0, advancementsCost: 0, value: 999_000 } },
      hireCostOf,
      surchargeByType: BY_TYPE,
    });

    expect(resolve({ position: "ogre_bloqueur", advancements: "[]" })).toBe(
      140_000,
    );
  });
});
