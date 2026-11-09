import { describe, expect, it } from "vitest";
import {
  computeInducementBudget,
  restrictInducementPayload,
  sheetInducementSpend,
  sumGoldEntries,
  writableInducementSides,
} from "./league-sheet-inducement-budget";

const base = {
  treasuryHome: 0,
  treasuryAway: 0,
  spentHome: 0,
  spentAway: 0,
  isCup: false,
  sellsInducements: true,
};

describe("computeInducementBudget", () => {
  it("favori : sa trésorerie seule, sans Petite Monnaie", () => {
    const b = computeInducementBudget({
      ...base,
      ctvHome: 1_200_000,
      ctvAway: 1_000_000,
      treasuryHome: 180_000,
    });
    expect(b.favorite).toBe("home");
    expect(b.home).toEqual({
      ctv: 1_200_000,
      treasury: 180_000,
      pettyCash: 0,
      maxBudget: 180_000,
      ctvGap: 0,
      opponentSpent: 0,
      treasuryAllowance: 180_000,
    });
  });

  it("outsider : écart de VEA + dépense adverse + 50 000 po de trésorerie max", () => {
    const b = computeInducementBudget({
      ...base,
      ctvHome: 1_200_000,
      ctvAway: 1_000_000,
      treasuryHome: 180_000,
      treasuryAway: 300_000,
      spentHome: 120_000,
    });
    expect(b.away).toEqual({
      ctv: 1_000_000,
      treasury: 300_000,
      pettyCash: 320_000,
      maxBudget: 370_000,
      ctvGap: 200_000,
      opponentSpent: 120_000,
      treasuryAllowance: 50_000,
    });
  });

  it("outsider à court de trésorerie : la part mobilisable suit la disponibilité", () => {
    const b = computeInducementBudget({
      ...base,
      ctvHome: 1_000_000,
      ctvAway: 1_100_000,
      treasuryHome: 20_000,
    });
    expect(b.home.treasuryAllowance).toBe(20_000);
    expect(b.home.maxBudget).toBe(120_000);
  });

  it("VEA égales : pas de favori, aucune trésorerie mobilisable", () => {
    const b = computeInducementBudget({
      ...base,
      ctvHome: 1_000_000,
      ctvAway: 1_000_000,
      treasuryHome: 200_000,
      treasuryAway: 90_000,
      spentHome: 40_000,
    });
    expect(b.favorite).toBeNull();
    expect(b.home.maxBudget).toBe(0);
    expect(b.away.maxBudget).toBe(0);
    expect(b.away.opponentSpent).toBe(0);
  });

  it("coupe : écart de VEA seul, ni trésorerie ni dépense adverse", () => {
    const b = computeInducementBudget({
      ...base,
      isCup: true,
      ctvHome: 1_200_000,
      ctvAway: 1_000_000,
      treasuryHome: 180_000,
      treasuryAway: 300_000,
      spentHome: 120_000,
    });
    expect(b.home).toMatchObject({ treasury: 0, maxBudget: 0 });
    expect(b.away).toMatchObject({
      treasury: 0,
      pettyCash: 200_000,
      maxBudget: 200_000,
      opponentSpent: 0,
      treasuryAllowance: 0,
    });
  });

  it("coupe sans vente d'avant-match : budget nul des deux côtés", () => {
    const b = computeInducementBudget({
      ...base,
      isCup: true,
      sellsInducements: false,
      ctvHome: 1_200_000,
      ctvAway: 1_000_000,
    });
    expect(b.away.maxBudget).toBe(0);
    expect(b.away.pettyCash).toBe(0);
  });
});

describe("sheetInducementSpend", () => {
  it("prend le payload quand il est présent, sinon la valeur stockée (PG ou SQLite)", () => {
    const stored = {
      inducementsHome: [{ cost: 50_000, qty: 2 }],
      inducementsAway: JSON.stringify([{ cost: 80_000 }]),
    };
    expect(sheetInducementSpend(stored)).toEqual({
      home: 100_000,
      away: 80_000,
    });
    expect(
      sheetInducementSpend(stored, { inducementsHome: [] }),
    ).toEqual({ home: 0, away: 80_000 });
  });

  it("sumGoldEntries ignore les entrées illisibles", () => {
    expect(sumGoldEntries("pas du json")).toBe(0);
    expect(sumGoldEntries([null, { cost: "x" }, { cost: 10_000.7, qty: -1 }])).toBe(
      10_000,
    );
  });
});

describe("écriture des coups de pouce par côté", () => {
  it("commissaire : les deux côtés ; coach : ses équipes", () => {
    expect(
      writableInducementSides({ commissioner: true, ownsHome: false, ownsAway: false }),
    ).toEqual(["home", "away"]);
    expect(
      writableInducementSides({ commissioner: false, ownsHome: true, ownsAway: false }),
    ).toEqual(["home"]);
    expect(
      writableInducementSides({ commissioner: false, ownsHome: true, ownsAway: true }),
    ).toEqual(["home", "away"]);
  });

  it("retire la liste d'un côté non modifiable, garde le reste du payload", () => {
    const out = restrictInducementPayload(
      {
        weather: "Beau temps",
        inducementsHome: [{ cost: 1 }],
        inducementsAway: [],
      },
      ["home"],
    );
    expect(out).toEqual({ weather: "Beau temps", inducementsHome: [{ cost: 1 }] });
    expect("inducementsAway" in out).toBe(false);
  });
});
