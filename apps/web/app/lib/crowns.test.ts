import { describe, expect, it } from "vitest";
import {
  describeCrownsTransaction,
  diceThemeIdFromRef,
  formatCrowns,
  formatCrownsDelta,
} from "./crowns";

describe("crowns (helpers d'affichage)", () => {
  it("formate un solde et un montant signé", () => {
    expect(formatCrowns(1250).replace(/\s/g, " ")).toBe("1 250");
    expect(formatCrowns(1250, "en")).toBe("1,250");
    expect(formatCrownsDelta(-400)).toBe("−400");
    expect(formatCrownsDelta(250)).toBe("+250");
  });

  it("lit l'id de thème d'une référence d'achat", () => {
    expect(diceThemeIdFromRef("dice-theme:orques")).toBe("orques");
    expect(diceThemeIdFromRef("dice-theme:")).toBeNull();
    expect(diceThemeIdFromRef("first_signup")).toBeNull();
    expect(diceThemeIdFromRef(null)).toBeNull();
  });

  it("décrit achats, remboursements et ajustements", () => {
    const name = (id: string) => (id === "orques" ? "Orques" : undefined);
    expect(describeCrownsTransaction({ type: "SINK", amount: -400, ref: "dice-theme:orques" }, name)).toBe(
      "Achat du thème de dés « Orques »",
    );
    expect(describeCrownsTransaction({ type: "ADMIN_REFUND", amount: 400, ref: "dice-theme:ghost" }, name)).toBe(
      "Remboursement du thème de dés « ghost »",
    );
    expect(describeCrownsTransaction({ type: "ADMIN_ADJUST", amount: 100, ref: "Tournoi gagné" })).toBe(
      "Ajustement de l'équipe Nuffle Arena — Tournoi gagné",
    );
    expect(describeCrownsTransaction({ type: "SINK", amount: -500, ref: "hof-dedicate:x" })).toBe("Dépense");
    expect(describeCrownsTransaction({ type: "DAILY", amount: 50, ref: null })).toBe("Bonus quotidien");
    expect(describeCrownsTransaction({ type: "MYSTERY", amount: 1, ref: null })).toBe("MYSTERY");
  });
});
