/**
 * Barème et contraintes imposés par un RÈGLEMENT DE TOURNOI aux compétences
 * achetées à la création. Miroir exact de la validation serveur
 * (`tournamentSkillCost` / `validateTournamentSkillPlan`) : si l'UI et le
 * serveur ne comptent pas pareil, le build est refusé après coup.
 */

import { describe, expect, it } from "vitest";
import { NAF_WORLD_CUP_2027, getTournamentRosterRules } from "@bb/game-engine";
import {
  hasPackEliteSurcharge,
  packEliteSurcharge,
  planSppTotal,
  skillSppCost,
  stackingUsage,
  type BuildAdvancement,
} from "./build-advancement-rules";

const PACK = {
  ...NAF_WORLD_CUP_2027,
  eliteSkills: ["block"],
  skillCosts: { ...NAF_WORLD_CUP_2027.skillCosts, eliteSurcharge: 2 },
};

describe("barème du règlement de tournoi", () => {
  it("applique les coûts du pack au lieu du barème BB2025", () => {
    const pack = NAF_WORLD_CUP_2027;
    expect(skillSppCost(0, "primary", "tackle", { pack })).toBe(
      pack.skillCosts.firstPrimary,
    );
    expect(skillSppCost(1, "secondary", "tackle", { pack })).toBe(
      pack.skillCosts.secondSecondary,
    );
  });

  it("ajoute le surcoût Élite du règlement, et lui seul", () => {
    expect(skillSppCost(0, "primary", "block", { pack: PACK })).toBe(8);
    expect(skillSppCost(0, "primary", "tackle", { pack: PACK })).toBe(6);
    expect(skillSppCost(1, "secondary", "block", { pack: PACK })).toBe(14);

    expect(hasPackEliteSurcharge("block", { pack: PACK })).toBe(true);
    expect(hasPackEliteSurcharge("tackle", { pack: PACK })).toBe(false);
    // Hors règlement, l'Élite se paie en Valeur d'Équipe, pas en PSP.
    expect(hasPackEliteSurcharge("block")).toBe(false);
    expect(packEliteSurcharge()).toBe(0);
    expect(packEliteSurcharge({ pack: PACK })).toBe(2);
  });

  it("totalise un plan au barème du règlement", () => {
    const plan: BuildAdvancement[] = [
      { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "block" },
      { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "tackle" },
    ];
    // 1re : 6 + 2 (Élite) ; 2e : 8.
    expect(planSppTotal(plan, { pack: PACK })).toBe(16);
    // Sans règlement : 6 + 8.
    expect(planSppTotal(plan)).toBe(14);
  });
});

describe("quota de cumul du règlement", () => {
  const plan: BuildAdvancement[] = [
    { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "block" },
    { positionSlug: "a", ordinal: 0, type: "primary", skillSlug: "tackle" },
  ];

  it("illimité hors règlement", () => {
    expect(stackingUsage(plan)).toEqual({
      used: 1,
      max: Number.POSITIVE_INFINITY,
    });
  });

  it("suit le cumul autorisé au roster", () => {
    // Orques : cumul « none » ⇒ aucun joueur à 2 compétences.
    expect(
      stackingUsage(plan, {
        pack: NAF_WORLD_CUP_2027,
        packRules: getTournamentRosterRules(NAF_WORLD_CUP_2027, "orc"),
      }),
    ).toEqual({ used: 1, max: 0 });

    // Nordiques : cumul « two_players ».
    expect(
      stackingUsage(plan, {
        pack: NAF_WORLD_CUP_2027,
        packRules: getTournamentRosterRules(NAF_WORLD_CUP_2027, "norse"),
      }).max,
    ).toBe(2);

    // Morts-vivants : cumul « one_player ».
    expect(
      stackingUsage(plan, {
        pack: NAF_WORLD_CUP_2027,
        packRules: getTournamentRosterRules(NAF_WORLD_CUP_2027, "undead"),
      }).max,
    ).toBe(1);
  });
});
