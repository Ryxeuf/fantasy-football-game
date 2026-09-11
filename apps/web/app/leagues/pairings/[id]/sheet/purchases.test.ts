/**
 * Relecture des achats d'après-match stockés sur la feuille.
 *
 * Le parse ramenait tout type inconnu à « Joueur » et perdait
 * `journeymanId` : un recrutement de journalier relu après rechargement
 * redevenait un achat de joueur sans poste, et le prochain enregistrement de
 * la fin de match l'écrasait ainsi. Même exigence pour le mort relevé.
 */
import { describe, it, expect } from "vitest";
import { parsePurchases } from "./purchases";

describe("parsePurchases", () => {
  it("conserve le type de chaque achat, dont journalier et mort relevé", () => {
    const out = parsePurchases([
      { kind: "player", name: "Grok", cost: 90_000, position: "orc_blitzer" },
      { kind: "reroll", name: "Relance", cost: 120_000 },
      { kind: "staff", name: "Apo", cost: 50_000, staff: "apothecary" },
      { kind: "other", name: "Ajustement", cost: 1_000 },
      {
        kind: "journeyman",
        name: "Journalier 1",
        cost: 50_000,
        journeymanId: "journeyman-home-1",
      },
      {
        kind: "raised_dead",
        name: "Grommit",
        cost: 0,
        position: "undead_trois_quart_zombie",
      },
    ]);
    expect(out.map((p) => p.kind)).toEqual([
      "player",
      "reroll",
      "staff",
      "other",
      "journeyman",
      "raised_dead",
    ]);
    expect(out[4]).toMatchObject({
      kind: "journeyman",
      journeymanId: "journeyman-home-1",
      cost: 50_000,
    });
    expect(out[5]).toMatchObject({
      kind: "raised_dead",
      name: "Grommit",
      cost: 0,
      position: "undead_trois_quart_zombie",
    });
    expect(out[2].staff).toBe("apothecary");
  });

  it("parse la chaîne JSON (miroir sqlite) et ramène un type inconnu à « Joueur »", () => {
    const out = parsePurchases(
      JSON.stringify([{ kind: "wizard", name: "x", cost: 5 }]),
    );
    expect(out).toEqual([
      {
        kind: "player",
        name: "x",
        cost: 5,
        position: undefined,
        staff: undefined,
        journeymanId: undefined,
      },
    ]);
  });

  it("tolère null, JSON cassé, entrées illisibles", () => {
    expect(parsePurchases(null)).toEqual([]);
    expect(parsePurchases("{pas du json")).toEqual([]);
    expect(parsePurchases([42, null, "x"])).toEqual([]);
    expect(parsePurchases({ kind: "player" })).toEqual([]);
  });
});
