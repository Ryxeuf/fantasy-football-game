import { describe, it, expect } from "vitest";
import {
  dedicatedFansPurchaseCost,
  includedFreeDedicatedFans,
  minDedicatedFans,
  paidDedicatedFans,
  parseLeagueFreeFanGrant,
  planLeagueFreeFanGrant,
  planLeagueFreeFanRevoke,
} from "./dedicated-fans";

describe("dedicated-fans — le fan offert est une règle de ligue", () => {
  describe("fans offerts compris dans le compte", () => {
    it.each([
      [null, 1],
      [undefined, 1],
      [true, 1],
      [false, 0],
    ] as const)("marqueur %s ⇒ %i fan offert compté", (marker, expected) => {
      expect(includedFreeDedicatedFans(marker)).toBe(expected);
      expect(minDedicatedFans(marker)).toBe(expected);
    });
  });

  describe("fans payés et coût d'achat", () => {
    it("équipe historique : le premier fan reste offert", () => {
      expect(paidDedicatedFans(3, null)).toBe(2);
      expect(dedicatedFansPurchaseCost(3, 5000, null)).toBe(10_000);
    });

    it("équipe de ligue (fan accordé) : le premier fan est offert", () => {
      expect(dedicatedFansPurchaseCost(3, 5000, true)).toBe(10_000);
    });

    it("équipe hors ligue : chaque fan se paie", () => {
      expect(paidDedicatedFans(3, false)).toBe(3);
      expect(dedicatedFansPurchaseCost(3, 5000, false)).toBe(15_000);
    });

    it("zéro fan ne coûte rien, jamais de coût négatif", () => {
      expect(dedicatedFansPurchaseCost(0, 5000, false)).toBe(0);
      expect(dedicatedFansPurchaseCost(0, 5000, null)).toBe(0);
    });
  });

  describe("octroi à l'inscription en ligue", () => {
    const base = { maxFans: 6, unitCost: 5000 };

    it("équipe sans fan offert : +1 fan", () => {
      expect(planLeagueFreeFanGrant({ ...base, fans: 2, marker: false })).toEqual({
        kind: "fan",
      });
      expect(planLeagueFreeFanGrant({ ...base, fans: 0, marker: false })).toEqual({
        kind: "fan",
      });
    });

    it("équipe au plafond : le prix d'un fan en trésorerie", () => {
      expect(planLeagueFreeFanGrant({ ...base, fans: 6, marker: false })).toEqual({
        kind: "refund",
        amount: 5000,
      });
    });

    it.each([null, undefined, true] as const)(
      "marqueur %s : rien à accorder",
      (marker) => {
        expect(planLeagueFreeFanGrant({ ...base, fans: 2, marker })).toEqual({
          kind: "none",
        });
      },
    );
  });

  describe("reprise quand l'équipe quitte la ligue", () => {
    it("fan accordé : −1 fan", () => {
      expect(
        planLeagueFreeFanRevoke({ grant: "fan", refund: null, fans: 3, treasury: 0 }),
      ).toEqual({ kind: "fan" });
    });

    it("fan accordé mais plus aucun fan : rien", () => {
      expect(
        planLeagueFreeFanRevoke({ grant: "fan", refund: null, fans: 0, treasury: 50_000 }),
      ).toEqual({ kind: "none" });
    });

    it("remboursement couvert par la trésorerie : on reprend le montant", () => {
      expect(
        planLeagueFreeFanRevoke({ grant: "refund", refund: 5000, fans: 6, treasury: 8000 }),
      ).toEqual({ kind: "treasury", amount: 5000 });
    });

    it("remboursement déjà dépensé : −1 fan (même valeur)", () => {
      expect(
        planLeagueFreeFanRevoke({ grant: "refund", refund: 5000, fans: 6, treasury: 2000 }),
      ).toEqual({ kind: "fan" });
    });

    it("remboursement dépensé et plus aucun fan : rien, jamais négatif", () => {
      expect(
        planLeagueFreeFanRevoke({ grant: "refund", refund: 5000, fans: 0, treasury: 2000 }),
      ).toEqual({ kind: "none" });
    });

    it("inscription qui n'a rien accordé : rien", () => {
      expect(
        planLeagueFreeFanRevoke({ grant: null, refund: null, fans: 3, treasury: 9000 }),
      ).toEqual({ kind: "none" });
    });
  });

  describe("lecture de la colonne freeFanGrant", () => {
    it("ne garde que les deux valeurs connues", () => {
      expect(parseLeagueFreeFanGrant("fan")).toBe("fan");
      expect(parseLeagueFreeFanGrant("refund")).toBe("refund");
      expect(parseLeagueFreeFanGrant(null)).toBeNull();
      expect(parseLeagueFreeFanGrant("autre")).toBeNull();
    });
  });
});
