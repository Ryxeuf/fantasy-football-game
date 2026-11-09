import { describe, expect, it } from "vitest";
import {
  budgetDetailLabel,
  effectiveSideBudget,
  mergeServerValue,
} from "./inducement-budget";

const gold = (n: number) => `${n}`;

describe("effectiveSideBudget", () => {
  it("outsider : remplace la dépense adverse stockée par celle affichée", () => {
    const view = effectiveSideBudget(
      {
        ctv: 1_000_000,
        treasury: 300_000,
        pettyCash: 230_000,
        maxBudget: 280_000,
        ctvGap: 150_000,
        opponentSpent: 80_000,
        treasuryAllowance: 50_000,
      },
      { ctv: 1_150_000 },
      { opponentSpent: 120_000, cup: false },
    );
    expect(view).toEqual({
      role: "underdog",
      ctvGap: 150_000,
      opponentSpent: 120_000,
      treasuryAllowance: 50_000,
      pettyCash: 270_000,
      maxBudget: 320_000,
    });
    expect(budgetDetailLabel(view, gold)).toBe(
      "Écart de VEA 150000 + dépense adverse 120000 (Petite Monnaie) + trésorerie (max 50000) 50000 = 320000",
    );
  });

  it("serveur antérieur (sans détail) : reconstruit la composition", () => {
    const view = effectiveSideBudget(
      { ctv: 1_000_000, treasury: 50_000, pettyCash: 150_000, maxBudget: 200_000 },
      { ctv: 1_150_000 },
      { opponentSpent: 30_000, cup: false },
    );
    expect(view.maxBudget).toBe(230_000);
    expect(view.treasuryAllowance).toBe(50_000);
  });

  it("favori : sa trésorerie, la dépense adverse ne compte pas", () => {
    const view = effectiveSideBudget(
      { ctv: 1_150_000, treasury: 90_000, pettyCash: 0, maxBudget: 90_000 },
      { ctv: 1_000_000 },
      { opponentSpent: 999_000, cup: false },
    );
    expect(view.role).toBe("favorite");
    expect(view.maxBudget).toBe(90_000);
    expect(budgetDetailLabel(view, gold)).toMatch(/^Trésorerie 90000 = 90000/);
  });

  it("VEA égales et coupe", () => {
    expect(
      effectiveSideBudget(
        { ctv: 1, treasury: 9, pettyCash: 0, maxBudget: 0 },
        { ctv: 1 },
        { opponentSpent: 5, cup: false },
      ).role,
    ).toBe("equal");
    const cup = effectiveSideBudget(
      { ctv: 1_000, treasury: 0, pettyCash: 200, maxBudget: 200 },
      { ctv: 1_200 },
      { opponentSpent: 500, cup: true },
    );
    expect(cup).toMatchObject({ role: "cup", maxBudget: 200, opponentSpent: 0 });
    expect(budgetDetailLabel(cup, gold)).toMatch(/pas de trésorerie en coupe/);
  });
});

describe("mergeServerValue", () => {
  it("suit le serveur quand la valeur locale n'a pas bougé", () => {
    expect(mergeServerValue([], [], [{ cost: 1 }])).toEqual([{ cost: 1 }]);
    expect(mergeServerValue("", "", "Beau temps")).toBe("Beau temps");
  });
  it("garde une saisie locale non enregistrée", () => {
    expect(mergeServerValue([{ cost: 2 }], [], [{ cost: 1 }])).toEqual([
      { cost: 2 },
    ]);
  });
});
