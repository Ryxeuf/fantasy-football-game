/**
 * `calculateTeamValueBreakdown` — le détail ligne à ligne consommé par le
 * « Résumé du budget » de la fiche d'équipe.
 *
 * L'invariant testé ici est ce qui permet au web d'arrêter de re-dériver le
 * coût des joueurs : VE = joueurs + staff + relances, à l'unité près.
 */

import { describe, it, expect } from "vitest";
import {
  calculateCurrentValue,
  calculateTeamValue,
  calculateTeamValueBreakdown,
  type TeamValueData,
} from "./team-value-calculator";

function data(overrides: Partial<TeamValueData> = {}): TeamValueData {
  return {
    players: [
      { cost: 100_000, available: true },
      { cost: 50_000, available: true },
      { cost: 70_000, available: false },
    ],
    rerolls: 2,
    cheerleaders: 1,
    assistants: 3,
    apothecary: true,
    roster: "human",
    staffConfig: {
      rerollCost: 50_000,
      cheerleaderCost: 10_000,
      assistantCost: 10_000,
      apothecaryCost: 50_000,
    },
    ...overrides,
  };
}

describe("calculateTeamValueBreakdown", () => {
  it("détaille joueurs / staff / relances", () => {
    const b = calculateTeamValueBreakdown(data());

    expect(b.playersCost).toBe(220_000);
    expect(b.availablePlayersCost).toBe(150_000);
    // 1 cheerleader + 3 assistants + apothicaire (les relances sont à part)
    expect(b.staffCost).toBe(10_000 + 30_000 + 50_000);
    expect(b.rerollsCost).toBe(100_000);
  });

  it("respecte VE = joueurs + staff + relances", () => {
    const b = calculateTeamValueBreakdown(data());

    expect(b.teamValue).toBe(b.playersCost + b.staffCost + b.rerollsCost);
    expect(b.currentValue).toBe(
      b.availablePlayersCost + b.staffCost + b.rerollsCost,
    );
  });

  it("reste la source unique de calculateTeamValue / calculateCurrentValue", () => {
    const d = data();
    const b = calculateTeamValueBreakdown(d);

    expect(calculateTeamValue(d)).toBe(b.teamValue);
    expect(calculateCurrentValue(d)).toBe(b.currentValue);
  });

  it("tolère un roster vide", () => {
    const b = calculateTeamValueBreakdown(
      data({ players: [], rerolls: 0, cheerleaders: 0, assistants: 0, apothecary: false }),
    );

    expect(b).toEqual({
      playersCost: 0,
      availablePlayersCost: 0,
      staffCost: 0,
      rerollsCost: 0,
      teamValue: 0,
      currentValue: 0,
    });
  });
});
