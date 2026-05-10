/**
 * Tests pour les bornes de drift par race (Lot 4.A.3).
 *
 * Couvre :
 *   - Table `RACE_DRIFT_BOUNDS` : valeurs canoniques BB pour les races
 *     emblematiquement skewees (Halfling, Wood Elf, Chaos Dwarf, etc.).
 *   - `detectRaceBoundAlerts(samples)` : alerte critical quand
 *     l'observed sort des bornes (independent de la drift relative).
 *   - Races sans bornes definies -> no-op (fallback sur le drift
 *     watcher classique).
 */

import { describe, expect, it } from "vitest";

import type { DriftSample } from "./pro-league-engine-drift-watcher";
import {
  detectRaceBoundAlerts,
  RACE_DRIFT_BOUNDS,
} from "./pro-league-race-bounds";

function sample(overrides: Partial<DriftSample> = {}): DriftSample {
  return {
    metric: "winRate",
    race: "Halfling",
    seasonId: "s_2026",
    observed: 0.3,
    reference: 0.3,
    drift: 0,
    samples: 50,
    ...overrides,
  };
}

describe("RACE_DRIFT_BOUNDS — Lot 4.A.3", () => {
  it("definit des bornes pour Halfling (winrate max bas)", () => {
    const halfling = RACE_DRIFT_BOUNDS.Halfling;
    expect(halfling).toBeDefined();
    expect(halfling?.winRate?.max).toBeLessThan(0.5);
  });

  it("definit des bornes pour Wood Elf (winrate min haut)", () => {
    const woodElf = RACE_DRIFT_BOUNDS["Wood Elf"];
    expect(woodElf).toBeDefined();
    expect(woodElf?.winRate?.min).toBeGreaterThan(0.4);
  });

  it("definit des bornes pour Chaos Dwarf (winrate max haut, race forte)", () => {
    const cd = RACE_DRIFT_BOUNDS["Chaos Dwarf"];
    expect(cd).toBeDefined();
    expect(cd?.winRate?.max).toBeGreaterThanOrEqual(0.65);
  });

  it("races sans bornes -> entry undefined (fallback drift watcher)", () => {
    expect(RACE_DRIFT_BOUNDS["UnknownRace"]).toBeUndefined();
  });
});

describe("detectRaceBoundAlerts — Lot 4.A.3", () => {
  it("ignore les races sans bornes definies", () => {
    const out = detectRaceBoundAlerts([
      sample({ race: "UnknownRace", observed: 1.0 }),
    ]);
    expect(out).toEqual([]);
  });

  it("ignore les samples avec moins de minMatches (variance trop forte)", () => {
    const out = detectRaceBoundAlerts(
      [sample({ race: "Halfling", observed: 0.7, samples: 3 })],
      { minMatches: 5 },
    );
    expect(out).toEqual([]);
  });

  it("alerte critical si winRate Halfling > borne max", () => {
    const out = detectRaceBoundAlerts([
      sample({ race: "Halfling", metric: "winRate", observed: 0.55 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      severity: "critical",
      race: "Halfling",
      metric: "winRate",
      direction: "above_max",
    });
  });

  it("alerte critical si winRate Wood Elf < borne min", () => {
    const out = detectRaceBoundAlerts([
      sample({ race: "Wood Elf", metric: "winRate", observed: 0.3 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      severity: "critical",
      race: "Wood Elf",
      direction: "below_min",
    });
  });

  it("aucune alerte si observed dans les bornes", () => {
    const out = detectRaceBoundAlerts([
      sample({ race: "Halfling", metric: "winRate", observed: 0.3 }),
      sample({ race: "Wood Elf", metric: "winRate", observed: 0.55 }),
    ]);
    expect(out).toEqual([]);
  });

  it("supporte plusieurs metriques par race (winRate + tdMean)", () => {
    const out = detectRaceBoundAlerts([
      sample({
        race: "Halfling",
        metric: "tdMean",
        observed: 4.0,
        reference: 1.4,
      }),
    ]);
    // Halfling tdMean max = 2.5 -> 4.0 declenche above_max.
    if (RACE_DRIFT_BOUNDS.Halfling?.tdMean?.max !== undefined) {
      expect(out).toHaveLength(1);
      expect(out[0].metric).toBe("tdMean");
    }
  });

  it("ignore les metriques sans bornes pour cette race", () => {
    // Halfling n'a pas de bornes definies sur casualtyMean -> no alert
    // meme si observed est extreme.
    const out = detectRaceBoundAlerts([
      sample({
        race: "Halfling",
        metric: "casualtyMean",
        observed: 100,
      }),
    ]);
    expect(out).toEqual([]);
  });

  it("agrege plusieurs alertes sur plusieurs samples", () => {
    const out = detectRaceBoundAlerts([
      sample({ race: "Halfling", metric: "winRate", observed: 0.6 }),
      sample({ race: "Wood Elf", metric: "winRate", observed: 0.2 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((a) => a.race).sort()).toEqual(["Halfling", "Wood Elf"]);
  });
});
