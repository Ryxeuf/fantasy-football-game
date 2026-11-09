import { describe, expect, it } from "vitest";
import {
  inducementListChanged,
  inducementOrderState,
} from "./league-sheet-inducement-order";

const base = {
  doneHomeAt: null,
  doneAwayAt: null,
  validated: false,
};

describe("inducementOrderState", () => {
  it("favori non confirmé : l'outsider attend, budget provisoire", () => {
    expect(
      inducementOrderState({ ...base, favorite: "away", favoriteMaxBudget: 120_000 }),
    ).toEqual({
      favorite: "away",
      favoriteDone: false,
      waitingFor: "away",
      provisionalSide: "home",
    });
  });

  it("favori confirmé : plus d'attente", () => {
    expect(
      inducementOrderState({
        ...base,
        favorite: "home",
        favoriteMaxBudget: 50_000,
        doneHomeAt: new Date("2026-11-09T10:00:00Z"),
      }),
    ).toEqual({
      favorite: "home",
      favoriteDone: true,
      waitingFor: null,
      provisionalSide: null,
    });
  });

  it("la confirmation de l'OUTSIDER ne compte pas", () => {
    const s = inducementOrderState({
      ...base,
      favorite: "home",
      favoriteMaxBudget: 50_000,
      doneAwayAt: "2026-11-09T10:00:00Z",
    });
    expect(s.waitingFor).toBe("home");
  });

  it("VEA égales : pas de favori, rien à attendre", () => {
    expect(
      inducementOrderState({ ...base, favorite: null, favoriteMaxBudget: 0 }),
    ).toMatchObject({ favorite: null, waitingFor: null, provisionalSide: null });
  });

  it("favori sans rien à dépenser (coupe, trésorerie vide) : rien à attendre", () => {
    expect(
      inducementOrderState({ ...base, favorite: "away", favoriteMaxBudget: 0 }),
    ).toMatchObject({ favorite: null, waitingFor: null });
  });

  it("feuille validée : l'avant-match est clos", () => {
    expect(
      inducementOrderState({
        ...base,
        favorite: "away",
        favoriteMaxBudget: 100_000,
        validated: true,
      }),
    ).toMatchObject({ favorite: "away", waitingFor: null, provisionalSide: null });
  });
});

describe("inducementListChanged", () => {
  it("même liste (PG ou SQLite) : inchangée ; null vaut liste vide", () => {
    const list = [{ slug: "bribe", cost: 100_000, qty: 1 }];
    expect(inducementListChanged(JSON.stringify(list), list)).toBe(false);
    expect(inducementListChanged(null, [])).toBe(false);
  });
  it("ajout, retrait ou quantité modifiée : changée", () => {
    const list = [{ slug: "bribe", cost: 100_000, qty: 1 }];
    expect(inducementListChanged(list, [])).toBe(true);
    expect(inducementListChanged(list, [{ ...list[0], qty: 2 }])).toBe(true);
  });
});
