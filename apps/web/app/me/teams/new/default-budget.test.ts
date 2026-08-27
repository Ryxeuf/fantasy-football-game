import { describe, it, expect } from "vitest";
import { getFormatConstraints } from "@bb/game-engine";
import { defaultBudgetK } from "./default-budget";

const BB11 = getFormatConstraints("bb11").startingBudget;
const SEVENS = getFormatConstraints("sevens").startingBudget;

describe("defaultBudgetK", () => {
  it("BB11 : le budget déclaré par le roster en base fait autorité", () => {
    expect(defaultBudgetK(1200, "bb11")).toBe(1200);
  });

  it("BB11 : repli sur le plafond du format sans valeur en base", () => {
    expect(defaultBudgetK(null, "bb11")).toBe(BB11);
    expect(defaultBudgetK(undefined, "bb11")).toBe(BB11);
    expect(defaultBudgetK(0, "bb11")).toBe(BB11);
  });

  it("Sevens : le plafond du FORMAT gouverne, pas le budget BB11 du roster", () => {
    // `Roster.budget` vaut 1 000 pour tous les rosters (c'est le budget BB11) :
    // le servir en Sevens donnerait 400 kpo de trop.
    expect(defaultBudgetK(1000, "sevens")).toBe(SEVENS);
    expect(SEVENS).toBeLessThan(BB11);
  });

  it("Sevens : une correction admin du budget BB11 ne fuit pas non plus", () => {
    expect(defaultBudgetK(1500, "sevens")).toBe(SEVENS);
  });
});
