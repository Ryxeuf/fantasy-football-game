/**
 * S27.1i — Tests Zod pour la creation de Nuffle Cup mensuelle.
 *
 * Etend `createCupSchema` avec `monthlyYear` + `monthlyMonth` (couple
 * obligatoire). La validation "admin only" est faite cote handler.
 */

import { describe, it, expect } from "vitest";
import {
  updateCupSchema, createCupSchema, updateCupRulesSchema } from "./cup.schemas";

describe("createCupSchema (S27.1i monthlyYear/Month)", () => {
  it("accepte un payload sans monthlyYear/Month (cup privee retro-compat)", () => {
    const r = createCupSchema.safeParse({ name: "My Cup" });
    expect(r.success).toBe(true);
  });

  it("accepte le couple monthlyYear + monthlyMonth quand valides", () => {
    const r = createCupSchema.safeParse({
      name: "Nuffle Cup Avril 2026",
      monthlyYear: 2026,
      monthlyMonth: 4,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.monthlyYear).toBe(2026);
      expect(r.data.monthlyMonth).toBe(4);
    }
  });

  it("rejette monthlyMonth hors [1,12]", () => {
    expect(
      createCupSchema.safeParse({
        name: "X",
        monthlyYear: 2026,
        monthlyMonth: 13,
      }).success,
    ).toBe(false);
    expect(
      createCupSchema.safeParse({
        name: "X",
        monthlyYear: 2026,
        monthlyMonth: 0,
      }).success,
    ).toBe(false);
  });

  it("rejette monthlyYear non entier ou <= 0", () => {
    expect(
      createCupSchema.safeParse({
        name: "X",
        monthlyYear: 0,
        monthlyMonth: 4,
      }).success,
    ).toBe(false);
    expect(
      createCupSchema.safeParse({
        name: "X",
        monthlyYear: 2026.5,
        monthlyMonth: 4,
      }).success,
    ).toBe(false);
  });

  it("rejette monthlyYear sans monthlyMonth (couple obligatoire)", () => {
    const r = createCupSchema.safeParse({
      name: "X",
      monthlyYear: 2026,
    });
    expect(r.success).toBe(false);
  });

  it("rejette monthlyMonth sans monthlyYear (couple obligatoire)", () => {
    const r = createCupSchema.safeParse({
      name: "X",
      monthlyMonth: 4,
    });
    expect(r.success).toBe(false);
  });
});

describe("règles de composition (createCupSchema + updateCupRulesSchema)", () => {
  it("accepte la config complète à la création", () => {
    const r = createCupSchema.safeParse({
      name: "Coupe Tier",
      resurrectionMode: true,
      tierBudgets: { I: 1150, II: 1100 },
      rosterBudgetOverrides: { skaven: 1200 },
      tierStartingPsp: { II: 6, IV: 14 },
    });
    expect(r.success).toBe(true);
  });

  it("rejette un tier inconnu dans tierBudgets", () => {
    const r = updateCupRulesSchema.safeParse({ tierBudgets: { V: 1000 } });
    expect(r.success).toBe(false);
  });

  it("rejette une valeur négative", () => {
    expect(
      updateCupRulesSchema.safeParse({ tierStartingPsp: { I: -1 } }).success,
    ).toBe(false);
  });

  it("accepte un patch partiel (résurrection seule)", () => {
    const r = updateCupRulesSchema.safeParse({ resurrectionMode: false });
    expect(r.success).toBe(true);
  });
});

describe("updateCupSchema — édition d'une coupe par son commissaire", () => {
  it("accepte un patch partiel", () => {
    const out = updateCupSchema.safeParse({ name: "Coupe des Sables" });
    expect(out.success).toBe(true);
  });

  it("accepte un barème et des critères de départage", () => {
    const out = updateCupSchema.safeParse({
      winPoints: 3,
      drawPoints: 1,
      tieBreakRules: ["points", "cas_for"],
    });
    expect(out.success).toBe(true);
  });

  it("accepte `null` pour revenir à l'ordre par défaut", () => {
    expect(updateCupSchema.safeParse({ tieBreakRules: null }).success).toBe(
      true,
    );
  });

  it("refuse un nom vide et une liste de départages démesurée", () => {
    expect(updateCupSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      updateCupSchema.safeParse({
        tieBreakRules: Array.from({ length: 17 }, () => "points"),
      }).success,
    ).toBe(false);
  });

  it("ne laisse pas rééditer l'édition, le format ni le règlement", () => {
    const out = updateCupSchema.parse({
      name: "OK",
      ruleset: "season_2",
      format: "sevens",
      tournamentRuleset: "naf_world_cup_2027",
    } as Record<string, unknown>);
    expect(out).not.toHaveProperty("ruleset");
    expect(out).not.toHaveProperty("format");
    expect(out).not.toHaveProperty("tournamentRuleset");
  });
});
