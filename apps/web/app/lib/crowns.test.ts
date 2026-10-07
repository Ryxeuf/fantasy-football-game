import { describe, expect, it } from "vitest";
import { REWARDS_TX_REF_PREFIX as SERVER_REWARDS_TX_REF_PREFIX } from "../../../server/src/services/crowns-rewards-rules";
import {
  REWARDS_TX_REF_PREFIX,
  describeCrownsTransaction,
  describeRewardPass,
  describeRewardPeriod,
  describeRewardSource,
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

  it("libelle un passage de récompenses avec son détail", () => {
    expect(
      describeCrownsTransaction({
        type: "REWARD",
        amount: 325,
        ref: "rewards:abc",
        rewards: { sheets: 2, achievements: 1, signup: true, capped: 0 },
      }),
    ).toBe("Récompenses : 2 feuilles de match, 1 succès, bonus de bienvenue");
    expect(
      describeRewardPass({ sheets: 1, achievements: 0, signup: false, capped: 1 }),
    ).toBe("Récompenses : 1 feuille de match — 1 feuille plafonnée");
    expect(
      describeRewardPass({ sheets: 0, achievements: 3, signup: false, capped: 2 }),
    ).toBe("Récompenses : 3 succès — 2 feuilles plafonnées");
  });

  it("un passage sans détail reste « Récompenses »", () => {
    expect(describeCrownsTransaction({ type: "REWARD", amount: 25, ref: "rewards:x" })).toBe("Récompenses");
    expect(describeRewardPass({ sheets: 0, achievements: 0, signup: false, capped: 0 })).toBe("Récompenses");
  });

  it("le bonus de bienvenue de la Pro League garde son libellé", () => {
    expect(describeCrownsTransaction({ type: "REWARD", amount: 1000, ref: "first_signup" })).toBe(
      "Bonus de bienvenue",
    );
    expect(describeCrownsTransaction({ type: "REWARD", amount: 1000, ref: null })).toBe("Bonus de bienvenue");
  });

  it("même préfixe de passage que le serveur", () => {
    expect(REWARDS_TX_REF_PREFIX).toBe(SERVER_REWARDS_TX_REF_PREFIX);
  });

  it("libelle la source et la période d'une récompense du registre", () => {
    expect(describeRewardSource("sheet", "sheet:abc:home")).toBe("Feuille de match (domicile)");
    expect(describeRewardSource("sheet", "sheet:abc:away")).toBe("Feuille de match (extérieur)");
    expect(describeRewardSource("achievement", "achievement:u1:first-friend")).toBe("Succès « first-friend »");
    expect(describeRewardSource("signup", "signup:u1")).toBe("Bonus de bienvenue");
    expect(describeRewardSource("other", "x:y")).toBe("x:y");
    expect(describeRewardPeriod("season:s1")).toBe("Saison de ligue");
    expect(describeRewardPeriod("cup:c1")).toBe("Coupe");
    expect(describeRewardPeriod(null)).toBe("—");
  });
});
