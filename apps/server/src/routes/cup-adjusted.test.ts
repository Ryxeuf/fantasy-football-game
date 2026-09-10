import { describe, it, expect, vi } from "vitest";

// La route importe tout le monde ; seul `isCupAdjusted` (pur) est testé ici.
vi.mock("../prisma", () => ({ prisma: {} }));

import { isCupAdjusted } from "./cup";

describe("isCupAdjusted", () => {
  it("une coupe sans aucune contrainte accepte une équipe telle quelle", () => {
    expect(isCupAdjusted({})).toBe(false);
  });

  it("un règlement de tournoi EST un ajustement de composition", () => {
    // Régression : une coupe NAF World Cup sans budget par tier proposait
    // « Inscrire tel quel », et l'inscription répondait
    // `tournament_ruleset_mismatch` — un bouton qui ne pouvait qu'échouer.
    expect(isCupAdjusted({ tournamentRuleset: "naf_world_cup_2027" })).toBe(
      true,
    );
    expect(isCupAdjusted({ tournamentRuleset: null })).toBe(false);
    expect(isCupAdjusted({ tournamentRuleset: "" })).toBe(false);
  });

  it("un budget ou un pool de PSP par tier/roster reste un ajustement", () => {
    expect(isCupAdjusted({ tierBudgets: { I: 1100 } })).toBe(true);
    expect(isCupAdjusted({ rosterBudgetOverrides: { skaven: 1200 } })).toBe(true);
    expect(isCupAdjusted({ tierStartingPsp: { II: 6 } })).toBe(true);
    expect(isCupAdjusted({ rosterStartingPspOverrides: { orc: 8 } })).toBe(true);
  });

  it("le mode résurrection seul n'est PAS un ajustement de composition", () => {
    expect(isCupAdjusted({ resurrectionMode: true })).toBe(false);
  });

  it("lit aussi les maps sérialisées (miroir SQLite)", () => {
    expect(isCupAdjusted({ tierBudgets: '{"I":1100}' })).toBe(true);
    expect(isCupAdjusted({ tierBudgets: "{}" })).toBe(false);
  });
});
