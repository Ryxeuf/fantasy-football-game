/**
 * Tests pour le perf baseline (Lot 3.B.3).
 *
 * Couvre la fonction pure `measureSimulationPerf` (statistiques sur N
 * runs) avec un `simulate` mocké qui contrôle la durée artificielle
 * via `mockNow`. La fonction réelle utilise `performance.now()` —
 * inj`ectable pour rendre le test déterministe sub-50ms.
 *
 * Le smoke test "real sim under SLO" est dans `perf-baseline.smoke.test.ts`
 * (séparé pour pouvoir le tagger avec un timeout long).
 */

import { describe, expect, it } from "vitest";

import { measureSimulationPerf } from "./perf-baseline";
import type { SimInput, SimResult } from "../types";

const mockResult: SimResult = {
  result: "draw",
  engineVer: "0.16.0",
  events: [],
  casualties: [],
  summary: {
    score: { home: 0, away: 0 },
    outcome: "draw",
    durationMs: 0,
    touchdownCount: 0,
    turnoverCount: 0,
    nuffleCount: 0,
    underdogBoostCount: 0,
    momentum: [],
  } as unknown as SimResult["summary"],
};

const fakeInput = {
  seed: 1,
  home: { id: "A", name: "A", side: "home" },
  away: { id: "B", name: "B", side: "away" },
} as unknown as SimInput;

describe("measureSimulationPerf — Lot 3.B.3", () => {
  it("calcule mean/p50/p95/max sur 5 runs avec mockNow contrôlé", () => {
    // Chaque sim "dure" 10, 20, 30, 40, 50 ms.
    const fakeNow = (() => {
      const stack = [
        0, 10, // run 1: 10ms
        100, 120, // run 2: 20ms
        200, 230, // run 3: 30ms
        300, 340, // run 4: 40ms
        400, 450, // run 5: 50ms
      ];
      return () => stack.shift() as number;
    })();

    const out = measureSimulationPerf({
      input: fakeInput,
      driverKind: "full",
      runs: 5,
      simulate: () => mockResult,
      now: fakeNow,
    });

    expect(out.runs).toBe(5);
    expect(out.driverKind).toBe("full");
    expect(out.mean).toBe(30);
    expect(out.p50).toBe(30);
    expect(out.max).toBe(50);
    expect(out.p95).toBeGreaterThanOrEqual(40);
  });

  it("rejette runs <= 0", () => {
    expect(() =>
      measureSimulationPerf({
        input: fakeInput,
        driverKind: "hybrid",
        runs: 0,
        simulate: () => mockResult,
      }),
    ).toThrow(/runs/);
  });

  it("propage l'erreur du sim sans renvoyer de stats partielles", () => {
    expect(() =>
      measureSimulationPerf({
        input: fakeInput,
        driverKind: "hybrid",
        runs: 5,
        simulate: () => {
          throw new Error("boom");
        },
      }),
    ).toThrow(/boom/);
  });

  it("transmet driverKind à `simulate` à chaque run", () => {
    const calls: Array<"hybrid" | "full" | undefined> = [];
    measureSimulationPerf({
      input: fakeInput,
      driverKind: "full",
      runs: 3,
      simulate: (_input, opts) => {
        calls.push(opts?.driverKind);
        return mockResult;
      },
      now: () => 0,
    });
    expect(calls).toEqual(["full", "full", "full"]);
  });
});
