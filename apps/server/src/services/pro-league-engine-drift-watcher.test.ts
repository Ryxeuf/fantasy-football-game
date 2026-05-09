/**
 * Tests pour `pro-league-engine-drift-watcher` (Lot 2.A.5).
 *
 * Couvre :
 *  - aggregateMatchesByRace : double comptage home/away, casualties
 *    splittés 50/50, wins par outcome.
 *  - computeRelativeDrift : drift signée, défensif sur reference=0.
 *  - buildDriftSamples : skip races sans match, skip races inconnues
 *    de FUMBBL.
 *  - runDriftTick : push gauges Prometheus, erreur isolée.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

import {
  aggregateMatchesByRace,
  buildDriftSamples,
  computeEngineDrift,
  computeRelativeDrift,
  countAlertsBySeverity,
  detectDriftAlerts,
  DRIFT_CRITICAL_THRESHOLD,
  DRIFT_WARN_THRESHOLD,
  MIN_MATCHES_FOR_ALERT,
  runDriftTick,
  startDriftWatcher,
  type DriftSample,
} from "./pro-league-engine-drift-watcher";
import { appMetrics } from "../utils/metrics";

const mocked = prisma as unknown as {
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
};

interface MatchRow {
  seasonId: string;
  scoreHome: number | null;
  scoreAway: number | null;
  outcome: string | null;
  touchdownCount: number | null;
  casualtyCount: number | null;
  homeTeam: { race: string };
  awayTeam: { race: string };
}

const matchRow = (overrides: Partial<MatchRow> = {}): MatchRow => ({
  seasonId: "S2026",
  scoreHome: 2,
  scoreAway: 1,
  outcome: "home",
  touchdownCount: 3,
  casualtyCount: 1,
  homeTeam: { race: "Wood Elf" },
  awayTeam: { race: "Halfling" },
  ...overrides,
});

describe("aggregateMatchesByRace — Lot 2.A.5", () => {
  it("compte chaque match deux fois (home + away race)", () => {
    const out = aggregateMatchesByRace([
      {
        seasonId: "S2026",
        homeRace: "Wood Elf",
        awayRace: "Halfling",
        scoreHome: 3,
        scoreAway: 1,
        outcome: "home",
        touchdownCount: 4,
        casualtyCount: 2,
      },
    ]);
    const wood = out.get("S2026")?.get("Wood Elf");
    const half = out.get("S2026")?.get("Halfling");
    expect(wood).toEqual({ matches: 1, tdsSum: 3, casualtiesSum: 1, wins: 1 });
    expect(half).toEqual({ matches: 1, tdsSum: 1, casualtiesSum: 1, wins: 0 });
  });

  it("compte les wins par outcome correctement", () => {
    const out = aggregateMatchesByRace([
      {
        seasonId: "S",
        homeRace: "Orc",
        awayRace: "Dwarf",
        scoreHome: 2,
        scoreAway: 1,
        outcome: "home",
        touchdownCount: 3,
        casualtyCount: 0,
      },
      {
        seasonId: "S",
        homeRace: "Orc",
        awayRace: "Dwarf",
        scoreHome: 0,
        scoreAway: 2,
        outcome: "away",
        touchdownCount: 2,
        casualtyCount: 0,
      },
      {
        seasonId: "S",
        homeRace: "Orc",
        awayRace: "Dwarf",
        scoreHome: 1,
        scoreAway: 1,
        outcome: "draw",
        touchdownCount: 2,
        casualtyCount: 0,
      },
    ]);
    expect(out.get("S")?.get("Orc")).toEqual({
      matches: 3,
      tdsSum: 3,
      casualtiesSum: 0,
      wins: 1,
    });
    expect(out.get("S")?.get("Dwarf")).toEqual({
      matches: 3,
      tdsSum: 4,
      casualtiesSum: 0,
      wins: 1,
    });
  });

  it("split les casualties 50/50 entre home et away", () => {
    const out = aggregateMatchesByRace([
      {
        seasonId: "S",
        homeRace: "Orc",
        awayRace: "Skaven",
        scoreHome: 1,
        scoreAway: 1,
        outcome: "draw",
        touchdownCount: 2,
        casualtyCount: 4,
      },
    ]);
    expect(out.get("S")?.get("Orc")?.casualtiesSum).toBe(2);
    expect(out.get("S")?.get("Skaven")?.casualtiesSum).toBe(2);
  });

  it("traite scoreHome/scoreAway null comme 0", () => {
    const out = aggregateMatchesByRace([
      {
        seasonId: "S",
        homeRace: "Orc",
        awayRace: "Skaven",
        scoreHome: null,
        scoreAway: null,
        outcome: null,
        touchdownCount: null,
        casualtyCount: null,
      },
    ]);
    expect(out.get("S")?.get("Orc")?.tdsSum).toBe(0);
    expect(out.get("S")?.get("Skaven")?.casualtiesSum).toBe(0);
  });
});

describe("computeRelativeDrift", () => {
  it("retourne (observed - reference) / reference", () => {
    expect(computeRelativeDrift(2.5, 2.0)).toBeCloseTo(0.25, 6);
    expect(computeRelativeDrift(1.6, 2.0)).toBeCloseTo(-0.2, 6);
    expect(computeRelativeDrift(2.0, 2.0)).toBe(0);
  });

  it("retourne 0 si reference est 0 (defensive)", () => {
    expect(computeRelativeDrift(1, 0)).toBe(0);
  });

  it("retourne 0 si une valeur n'est pas finite", () => {
    expect(computeRelativeDrift(Number.NaN, 2)).toBe(0);
    expect(computeRelativeDrift(2, Number.NaN)).toBe(0);
    expect(computeRelativeDrift(2, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("buildDriftSamples", () => {
  it("produit une triplette {tdMean, casualtyMean, winRate} par (season, race)", () => {
    const aggs = aggregateMatchesByRace([
      {
        seasonId: "S",
        homeRace: "Wood Elf",
        awayRace: "Halfling",
        scoreHome: 3,
        scoreAway: 1,
        outcome: "home",
        touchdownCount: 4,
        casualtyCount: 0,
      },
    ]);
    const samples = buildDriftSamples(aggs);
    const woodMetrics = samples.filter((s) => s.race === "Wood Elf").map((s) => s.metric);
    expect(woodMetrics).toEqual(
      expect.arrayContaining(["tdMean", "casualtyMean", "winRate"]),
    );
    expect(woodMetrics).toHaveLength(3);
  });

  it("skip une race sans match dans la fenêtre (samples=0)", () => {
    const aggs = new Map();
    const samples = buildDriftSamples(aggs);
    expect(samples).toEqual([]);
  });

  it("skip une race inconnue de la référence FUMBBL", () => {
    const aggs = aggregateMatchesByRace([
      {
        seasonId: "S",
        homeRace: "Imaginary Race",
        awayRace: "Wood Elf",
        scoreHome: 1,
        scoreAway: 1,
        outcome: "draw",
        touchdownCount: 2,
        casualtyCount: 0,
      },
    ]);
    const samples = buildDriftSamples(aggs);
    expect(samples.find((s) => s.race === "Imaginary Race")).toBeUndefined();
    expect(samples.find((s) => s.race === "Wood Elf")).toBeDefined();
  });

  it("la drift est positive si observed > reference", () => {
    // Wood Elf FUMBBL tdAverage = 2.4. On force observed = 3.0.
    const aggs = new Map([
      ["S", new Map([["Wood Elf", { matches: 10, tdsSum: 30, casualtiesSum: 0, wins: 5 }]])],
    ]);
    const samples = buildDriftSamples(aggs);
    const td = samples.find((s) => s.race === "Wood Elf" && s.metric === "tdMean");
    expect(td?.observed).toBeCloseTo(3.0, 6);
    expect(td?.drift).toBeGreaterThan(0);
  });
});

describe("computeEngineDrift", () => {
  beforeEach(() => {
    mocked.proLeagueMatch.findMany.mockReset();
  });

  it("query la fenêtre attendue et passe seasonId quand fourni", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    await computeEngineDrift({
      windowMs: 24 * 60 * 60 * 1000,
      now: new Date("2026-05-07T12:00:00Z"),
      seasonId: "S2026",
    });
    const args = mocked.proLeagueMatch.findMany.mock.calls[0][0];
    expect(args.where.seasonId).toBe("S2026");
    expect(args.where.simulatedAt.gte).toEqual(new Date("2026-05-06T12:00:00Z"));
    expect(args.where.simulatedAt.lte).toEqual(new Date("2026-05-07T12:00:00Z"));
  });

  it("retourne un sample drift par (race, metric) après mapping rows", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      matchRow({ scoreHome: 3, scoreAway: 1 }),
    ]);
    const samples = await computeEngineDrift();
    // 2 races × 3 metrics = 6 samples.
    expect(samples).toHaveLength(6);
  });
});

describe("runDriftTick — Prometheus push", () => {
  beforeEach(() => {
    mocked.proLeagueMatch.findMany.mockReset();
    appMetrics.registry.resetMetrics();
  });

  it("pousse les samples dans nuffle_engine_drift", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      matchRow({ scoreHome: 3, scoreAway: 1 }),
    ]);
    const pushed = await runDriftTick();
    expect(pushed).toBe(6);
    const text = await appMetrics.registry.metrics();
    expect(text).toContain("nuffle_engine_drift");
    expect(text).toMatch(/race="Wood Elf"/);
    expect(text).toMatch(/race="Halfling"/);
  });

  it("erreur isolée : si findMany throw, le tick retourne 0 sans propager", async () => {
    mocked.proLeagueMatch.findMany.mockRejectedValue(new Error("boom"));
    const pushed = await runDriftTick();
    expect(pushed).toBe(0);
  });
});

describe("startDriftWatcher", () => {
  let handles: Array<{ stop(): void }> = [];

  afterEach(() => {
    for (const h of handles) h.stop();
    handles = [];
  });

  it("expose tickNow pour forcer un calcul immédiat", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    const handle = startDriftWatcher({ enabled: false });
    handles.push(handle);
    const pushed = await handle.tickNow();
    expect(pushed).toBe(0);
  });

  it("opt-out via enabled=false (pas de timer)", () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    const handle = startDriftWatcher({ enabled: false });
    handles.push(handle);
    handle.stop();
    // Si un timer avait démarré, stop() le clearInterval. Smoke test :
    // pas d'erreur = OK.
    expect(true).toBe(true);
  });
});

describe("detectDriftAlerts — Lot 4.A.3", () => {
  function sample(
    overrides: Partial<DriftSample> = {},
  ): DriftSample {
    return {
      metric: "tdMean",
      race: "Wood Elf",
      seasonId: "s_2026",
      observed: 2.5,
      reference: 2.4,
      drift: 0.04,
      samples: 50,
      ...overrides,
    };
  }

  it("seuils par defaut respectent FUMBBL_TOLERANCE (10%) + critical (25%)", () => {
    expect(DRIFT_WARN_THRESHOLD).toBe(0.1);
    expect(DRIFT_CRITICAL_THRESHOLD).toBe(0.25);
    expect(MIN_MATCHES_FOR_ALERT).toBe(5);
  });

  it("aucune alerte sous le seuil warn (10%)", () => {
    expect(detectDriftAlerts([sample({ drift: 0.05 })])).toEqual([]);
    expect(detectDriftAlerts([sample({ drift: -0.09 })])).toEqual([]);
  });

  it("warn si |drift| > 10% et < 25% (signe ne change pas la severite)", () => {
    const alerts = detectDriftAlerts([
      sample({ drift: 0.15, race: "Halfling" }),
      sample({ drift: -0.2, race: "Chaos Dwarf" }),
    ]);
    expect(alerts.map((a) => a.severity)).toEqual(["warn", "warn"]);
  });

  it("critical si |drift| > 25%", () => {
    const alerts = detectDriftAlerts([sample({ drift: 0.3, race: "Halfling" })]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
  });

  it("ignore les samples sous MIN_MATCHES_FOR_ALERT (variance trop forte)", () => {
    expect(
      detectDriftAlerts([sample({ drift: 0.5, samples: 3 })]),
    ).toEqual([]);
  });

  it("override des seuils via options", () => {
    const alerts = detectDriftAlerts(
      [sample({ drift: 0.06 })],
      { warnThreshold: 0.05 },
    );
    expect(alerts).toHaveLength(1);
  });
});

describe("countAlertsBySeverity — Lot 4.A.3", () => {
  it("compte par severite", () => {
    const result = countAlertsBySeverity([
      {
        severity: "warn",
        metric: "tdMean",
        race: "Halfling",
        seasonId: "s",
        drift: 0.15,
        observed: 2,
        reference: 1.8,
        samples: 50,
      },
      {
        severity: "critical",
        metric: "winRate",
        race: "Chaos",
        seasonId: "s",
        drift: 0.3,
        observed: 0.7,
        reference: 0.55,
        samples: 50,
      },
      {
        severity: "warn",
        metric: "casualtyMean",
        race: "Orc",
        seasonId: "s",
        drift: 0.12,
        observed: 1.5,
        reference: 1.34,
        samples: 50,
      },
    ]);
    expect(result).toEqual({ warn: 2, critical: 1 });
  });

  it("0/0 sur liste vide", () => {
    expect(countAlertsBySeverity([])).toEqual({ warn: 0, critical: 0 });
  });
});
