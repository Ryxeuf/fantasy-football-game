/**
 * Tests de `league-offline-purchase-baseline` (pur) — l'état de RÉFÉRENCE
 * des joueurs créés par les achats d'un match, contre lequel le garde-fou
 * `purchase-consumed` compare l'état courant.
 *
 * Retour testeur (2026-09-19) : un mort relevé recruté portait déjà 1 match,
 * ses PSP et son évolution DU MATCH ; comparé à zéro, il passait pour
 * « consommé » et la feuille ne pouvait plus être invalidée. Idem pour un
 * journalier.
 */

import { describe, it, expect } from "vitest";
import {
  advancementsCount,
  baselineForPurchase,
  deriveCreatedPlayerBaselines,
  purchaseCreatesPlayer,
  purchaseIsSheetPlayerHire,
  purchasedPlayerConsumed,
  resolveCreatedPlayerBaselines,
  ZERO_COUNTERS,
} from "./league-offline-purchase-baseline";
import type { OfflinePurchaseInput } from "./league-offline-purchases";

const ONE_ADVANCEMENT = JSON.stringify([
  { skillSlug: "block", type: "primary", isRandom: false, at: 0 },
]);

const raisedDead: OfflinePurchaseInput = {
  kind: "raised_dead",
  name: "Lakrakzette",
  cost: 0,
  position: "undead_trois_quart_zombie",
  spp: 0,
  advancements: ONE_ADVANCEMENT,
};
const journeyman: OfflinePurchaseInput = {
  kind: "journeyman",
  name: "Journalier 1",
  cost: 60_000,
  position: "orc_trois_quart_gobelin",
  journeymanId: "journeyman-home-1",
  spp: 2,
};
const player: OfflinePurchaseInput = {
  kind: "player",
  name: "Grok",
  cost: 90_000,
  position: "blitzer",
};

describe("advancementsCount", () => {
  it("compte un array natif (PG), une chaîne JSON (sqlite), rien sinon", () => {
    expect(advancementsCount([{}, {}])).toBe(2);
    expect(advancementsCount(ONE_ADVANCEMENT)).toBe(1);
    expect(advancementsCount("[]")).toBe(0);
    expect(advancementsCount("{broken")).toBe(0);
    expect(advancementsCount(null)).toBe(0);
    expect(advancementsCount(undefined)).toBe(0);
    expect(advancementsCount('{"a":1}')).toBe(0);
  });
});

describe("baselineForPurchase", () => {
  it("un joueur acheté part de zéro", () => {
    expect(baselineForPurchase(player)).toEqual(ZERO_COUNTERS);
    expect(purchaseCreatesPlayer("player")).toBe(true);
    expect(purchaseIsSheetPlayerHire("player")).toBe(false);
  });

  it("un mort relevé recruté arrive avec 1 match joué, ses PSP et son évolution", () => {
    expect(baselineForPurchase(raisedDead)).toEqual({
      spp: 0,
      matchesPlayed: 1,
      advancements: 1,
    });
    expect(purchaseIsSheetPlayerHire("raised_dead")).toBe(true);
  });

  it("un journalier recruté sans évolution : ses PSP restants, 0 avancement", () => {
    expect(baselineForPurchase(journeyman)).toEqual({
      spp: 2,
      matchesPlayed: 1,
      advancements: 0,
    });
    // PSP absents ou négatifs (défensif) => 0.
    expect(baselineForPurchase({ ...journeyman, spp: null }).spp).toBe(0);
    expect(baselineForPurchase({ ...journeyman, spp: -3 }).spp).toBe(0);
  });

  it("relances, staff et dépenses diverses ne créent pas de joueur", () => {
    for (const kind of ["reroll", "staff", "other"] as const) {
      expect(purchaseCreatesPlayer(kind)).toBe(false);
      expect(purchaseIsSheetPlayerHire(kind)).toBe(false);
    }
  });
});

describe("purchasedPlayerConsumed", () => {
  const hire = { spp: 0, matchesPlayed: 1, advancements: 1 };

  it("un recrutement intact (1 match, son évolution) N'EST PAS consommé", () => {
    expect(purchasedPlayerConsumed({ ...hire, dead: false }, hire)).toBe(false);
  });

  it("… mais l'est dès qu'il a rejoué, gagné des PSP, progressé ou est mort", () => {
    expect(
      purchasedPlayerConsumed({ ...hire, matchesPlayed: 2, dead: false }, hire),
    ).toBe(true);
    expect(
      purchasedPlayerConsumed({ ...hire, spp: 3, dead: false }, hire),
    ).toBe(true);
    expect(
      purchasedPlayerConsumed({ ...hire, advancements: 2, dead: false }, hire),
    ).toBe(true);
    expect(purchasedPlayerConsumed({ ...hire, dead: true }, hire)).toBe(true);
  });

  it("des PSP DÉPENSÉS (inférieurs à la référence) ne comptent pas seuls — l'avancement qui les explique, si", () => {
    const withSpp = { spp: 6, matchesPlayed: 1, advancements: 0 };
    expect(
      purchasedPlayerConsumed(
        { spp: 0, matchesPlayed: 1, advancements: 0, dead: false },
        withSpp,
      ),
    ).toBe(false);
    expect(
      purchasedPlayerConsumed(
        { spp: 0, matchesPlayed: 1, advancements: 1, dead: false },
        withSpp,
      ),
    ).toBe(true);
  });

  it("sans référence : zéro (comportement historique) — un joueur acheté qui a joué est consommé", () => {
    expect(
      purchasedPlayerConsumed({
        spp: 0,
        matchesPlayed: 1,
        advancements: 0,
        dead: false,
      }),
    ).toBe(true);
    expect(
      purchasedPlayerConsumed({
        spp: 0,
        matchesPlayed: 0,
        advancements: 0,
        dead: false,
      }),
    ).toBe(false);
  });
});

describe("deriveCreatedPlayerBaselines (feuilles antérieures à la trace)", () => {
  const rows = new Map([
    ["np-1", { name: "Lakrakzette", position: "undead_trois_quart_zombie" }],
    ["np-2", { name: "Grok", position: "blitzer" }],
  ]);

  it("aligne chaque joueur créé sur son achat, dans l'ordre de la saisie", () => {
    const out = deriveCreatedPlayerBaselines(
      ["np-1", "np-2"],
      [{ kind: "reroll", name: "Relance", cost: 70_000 }, raisedDead, player],
      rows,
    );
    expect(out.get("np-1")).toEqual({
      spp: 0,
      matchesPlayed: 1,
      advancements: 1,
    });
    expect(out.get("np-2")).toEqual(ZERO_COUNTERS);
  });

  it("un achat sans poste ni nom (« auto ») est compatible avec la ligne créée", () => {
    const out = deriveCreatedPlayerBaselines(
      ["np-2"],
      [{ kind: "player", name: "", cost: 90_000 }],
      rows,
    );
    expect(out.get("np-2")).toEqual(ZERO_COUNTERS);
  });

  it("le nom est comparé tel qu'il est écrit sur la ligne (trim, 120 caractères)", () => {
    const out = deriveCreatedPlayerBaselines(
      ["np-1"],
      [{ ...raisedDead, name: "  Lakrakzette  " }],
      rows,
    );
    expect(out.get("np-1")).toEqual({
      spp: 0,
      matchesPlayed: 1,
      advancements: 1,
    });
  });

  it("refuse de deviner quand un achat a été sauté (compte différent) : aucune référence", () => {
    // Deux achats créateurs, un seul joueur créé (liste à 16, poste
    // irrésoluble…) : l'alignement n'est plus certain.
    const out = deriveCreatedPlayerBaselines(
      ["np-1"],
      [raisedDead, player],
      rows,
    );
    expect(out.size).toBe(0);
  });

  it("refuse une paire incohérente (poste ou nom différent) sans toucher aux autres", () => {
    const out = deriveCreatedPlayerBaselines(
      ["np-1", "np-2"],
      [{ ...raisedDead, position: "undead_trois_quart_squelette" }, player],
      rows,
    );
    expect(out.has("np-1")).toBe(false);
    expect(out.get("np-2")).toEqual(ZERO_COUNTERS);

    const byName = deriveCreatedPlayerBaselines(
      ["np-2"],
      [{ ...player, name: "Autre" }],
      rows,
    );
    expect(byName.size).toBe(0);
  });

  it("ignore un joueur créé dont la ligne a disparu", () => {
    const out = deriveCreatedPlayerBaselines(["gone"], [player], rows);
    expect(out.size).toBe(0);
  });
});

describe("resolveCreatedPlayerBaselines", () => {
  const rows = new Map([
    ["np-1", { name: "Lakrakzette", position: "undead_trois_quart_zombie" }],
  ]);

  it("la trace stockée l'emporte, sans lire les achats", () => {
    const out = resolveCreatedPlayerBaselines({
      createdPlayerIds: ["np-1"],
      createdPlayers: [
        { id: "np-1", spp: 4, matchesPlayed: 1, advancements: 0 },
      ],
      // Achats contradictoires : ignorés, la trace fait foi.
      purchases: [raisedDead],
      rowsById: rows,
    });
    expect(out.get("np-1")).toEqual({
      spp: 4,
      matchesPlayed: 1,
      advancements: 0,
    });
  });

  it("sans trace (feuille antérieure), redérive depuis les achats du snapshot", () => {
    const out = resolveCreatedPlayerBaselines({
      createdPlayerIds: ["np-1"],
      purchases: [raisedDead],
      rowsById: rows,
    });
    expect(out.get("np-1")).toEqual({
      spp: 0,
      matchesPlayed: 1,
      advancements: 1,
    });
  });

  it("sans trace ni achats lisibles : aucune référence (le garde-fou retombe sur zéro)", () => {
    const out = resolveCreatedPlayerBaselines({
      createdPlayerIds: ["np-1"],
      purchases: [],
      rowsById: rows,
    });
    expect(out.size).toBe(0);
  });

  it("complète une trace partielle par la redérivation", () => {
    const twoRows = new Map([
      ...rows,
      ["np-2", { name: "Grok", position: "blitzer" }],
    ]);
    const out = resolveCreatedPlayerBaselines({
      createdPlayerIds: ["np-1", "np-2"],
      createdPlayers: [
        { id: "np-2", spp: 0, matchesPlayed: 0, advancements: 0 },
      ],
      purchases: [raisedDead, player],
      rowsById: twoRows,
    });
    expect(out.get("np-1")).toEqual({
      spp: 0,
      matchesPlayed: 1,
      advancements: 1,
    });
    expect(out.get("np-2")).toEqual(ZERO_COUNTERS);
  });
});
