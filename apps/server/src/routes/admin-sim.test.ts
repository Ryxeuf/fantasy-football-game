/**
 * Unit tests for the `/admin/sim/*` admin utility (Phase 0 helper).
 *
 * Tests the handlers directly — middleware (`authUser`, `adminOnly`,
 * `validate`) is covered by the routes that use the same pieces in
 * production.
 */

import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("../services/pro-league-engine-drift-watcher", () => ({
  computeEngineDrift: vi.fn(),
}));
vi.mock("../services/pro-league-match-broadcaster", () => ({
  getBroadcasterStats: vi.fn(),
}));
vi.mock("../services/pro-league-sandbox", () => ({
  createTestMatch: vi.fn(),
  listTestMatches: vi.fn(),
}));
vi.mock("../services/engine-comparison", () => ({
  runEngineComparison: vi.fn(),
}));

import {
  comparisonSchema,
  handleCreateTestMatch,
  handleGetBroadcasterStats,
  handleGetDrift,
  handleListTeams,
  handleListTestMatches,
  handleRunComparison,
  handleRunSim,
  runSimSchema,
  testMatchSchema,
  type RunSimBody,
} from "./admin-sim";
import { computeEngineDrift } from "../services/pro-league-engine-drift-watcher";
import { getBroadcasterStats } from "../services/pro-league-match-broadcaster";
import {
  createTestMatch,
  listTestMatches,
} from "../services/pro-league-sandbox";
import { runEngineComparison } from "../services/engine-comparison";
import { appMetrics } from "../utils/metrics";

function buildRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("handleListTeams", () => {
  it("returns the 16 Pro League teams with id/city/name/race/nflFlavor", () => {
    const res = buildRes();
    handleListTeams({} as Request, res);
    const body = res.body as { teams: Array<{ id: string; city: string }> };
    expect(body.teams).toHaveLength(16);
    expect(body.teams.find((t) => t.id === "pit-smashers")).toBeDefined();
    for (const team of body.teams) {
      expect(team.id.length).toBeGreaterThan(0);
      expect(team.city.length).toBeGreaterThan(0);
    }
  });
});

describe("handleRunSim", () => {
  function call(body: RunSimBody): {
    statusCode: number;
    body: unknown;
  } {
    const req = { body } as unknown as Request;
    const res = buildRes();
    handleRunSim(req, res);
    return res;
  }

  it("returns 200 with metrics for a valid pairing", () => {
    const out = call({
      teamA: "pit-smashers",
      teamB: "kc-soaring-hawks",
      runs: 5,
      seed: 0,
    });
    expect(out.statusCode).toBe(200);
    const body = out.body as {
      matches: number;
      metrics: { matches: number };
      report: string;
      pairing: { home: { id: string }; away: { id: string } };
    };
    expect(body.matches).toBe(5);
    expect(body.metrics.matches).toBe(5);
    expect(body.report).toContain("Smashers");
    expect(body.pairing.home.id).toBe("pit-smashers");
    expect(body.pairing.away.id).toBe("kc-soaring-hawks");
  });

  it("returns 400 when teamA is unknown", () => {
    const out = call({
      teamA: "vampire-counts",
      teamB: "kc-soaring-hawks",
      runs: 5,
      seed: 0,
    });
    expect(out.statusCode).toBe(400);
    expect((out.body as { error: string }).error).toContain("teamA");
  });

  it("returns 400 when teamB is unknown", () => {
    const out = call({
      teamA: "pit-smashers",
      teamB: "vampire-counts",
      runs: 5,
      seed: 0,
    });
    expect(out.statusCode).toBe(400);
    expect((out.body as { error: string }).error).toContain("teamB");
  });

  it("returns 400 when teamA === teamB", () => {
    const out = call({
      teamA: "pit-smashers",
      teamB: "pit-smashers",
      runs: 5,
      seed: 0,
    });
    expect(out.statusCode).toBe(400);
    expect((out.body as { error: string }).error).toContain("distinct");
  });

  it("is deterministic for the same seed", () => {
    const a = call({
      teamA: "pit-smashers",
      teamB: "kc-soaring-hawks",
      runs: 5,
      seed: 42,
    });
    const b = call({
      teamA: "pit-smashers",
      teamB: "kc-soaring-hawks",
      runs: 5,
      seed: 42,
    });
    expect(b.body).toEqual(a.body);
  });
});

describe("runSimSchema (Zod validation)", () => {
  it("applies sane defaults on optional fields", () => {
    const parsed = runSimSchema.parse({
      teamA: "pit-smashers",
      teamB: "kc-soaring-hawks",
    });
    expect(parsed.runs).toBe(50);
    expect(parsed.seed).toBe(0);
  });

  it("rejects empty team ids", () => {
    expect(() =>
      runSimSchema.parse({ teamA: "", teamB: "kc-soaring-hawks" }),
    ).toThrow();
  });

  it("rejects runs > 2000 (admin guardrail)", () => {
    expect(() =>
      runSimSchema.parse({
        teamA: "pit-smashers",
        teamB: "kc-soaring-hawks",
        runs: 5000,
      }),
    ).toThrow();
  });

  it("rejects negative seed", () => {
    expect(() =>
      runSimSchema.parse({
        teamA: "pit-smashers",
        teamB: "kc-soaring-hawks",
        seed: -1,
      }),
    ).toThrow();
  });
});

describe("handleGetDrift — Lot 2.A.5", () => {
  it("retourne les samples + computedAt sans args", async () => {
    (computeEngineDrift as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        metric: "tdMean",
        race: "Wood Elf",
        seasonId: "S",
        observed: 2.5,
        reference: 2.4,
        drift: 0.04,
        samples: 10,
      },
    ]);
    const res = buildRes();
    await handleGetDrift({ query: {} } as unknown as Request, res);
    const body = res.body as { samples: unknown[]; computedAt: string };
    expect(body.samples).toHaveLength(1);
    expect(typeof body.computedAt).toBe("string");
    expect(computeEngineDrift).toHaveBeenCalledWith({
      windowMs: undefined,
      seasonId: undefined,
    });
  });

  it("forwarde windowMs et seasonId quand fournis en query string", async () => {
    (computeEngineDrift as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = buildRes();
    await handleGetDrift(
      { query: { windowMs: "86400000", seasonId: "S2026" } } as unknown as Request,
      res,
    );
    expect(computeEngineDrift).toHaveBeenCalledWith({
      windowMs: 86400000,
      seasonId: "S2026",
    });
  });

  it("ignore un windowMs non-numérique (sécurise contre une chaîne arbitraire)", async () => {
    (computeEngineDrift as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = buildRes();
    await handleGetDrift(
      { query: { windowMs: "drop-tables" } } as unknown as Request,
      res,
    );
    expect(computeEngineDrift).toHaveBeenCalledWith({
      windowMs: undefined,
      seasonId: undefined,
    });
  });
});

describe("handleGetBroadcasterStats — Lot 2.B.4", () => {
  it("retourne les sessions / subscribers + valeurs Prometheus + timestamp", async () => {
    (getBroadcasterStats as ReturnType<typeof vi.fn>).mockReturnValue({
      activeSessions: 3,
      totalSubscribers: 12,
    });
    appMetrics.setBroadcasterActiveSessions(3);
    appMetrics.setBroadcasterTotalSubscribers(12);
    const res = buildRes();
    await handleGetBroadcasterStats({} as Request, res);
    const body = res.body as {
      activeSessions: number;
      totalSubscribers: number;
      promExposed: { activeSessions: number; totalSubscribers: number };
      fetchedAt: string;
    };
    expect(body.activeSessions).toBe(3);
    expect(body.totalSubscribers).toBe(12);
    expect(body.promExposed.activeSessions).toBe(3);
    expect(body.promExposed.totalSubscribers).toBe(12);
    expect(typeof body.fetchedAt).toBe("string");
  });
});

describe("testMatchSchema — Lot 2.C.2 input validation", () => {
  it("accepte un payload valide", () => {
    const out = testMatchSchema.parse({
      homeTeamId: "t1",
      awayTeamId: "t2",
    });
    expect(out).toEqual({ homeTeamId: "t1", awayTeamId: "t2" });
  });

  it("rejette les ids vides", () => {
    expect(() =>
      testMatchSchema.parse({ homeTeamId: "", awayTeamId: "t2" }),
    ).toThrow();
  });

  it("Lot 3.B.1 — accepte driverKind 'hybrid' ou 'full'", () => {
    expect(
      testMatchSchema.parse({
        homeTeamId: "t1",
        awayTeamId: "t2",
        driverKind: "hybrid",
      }),
    ).toMatchObject({ driverKind: "hybrid" });
    expect(
      testMatchSchema.parse({
        homeTeamId: "t1",
        awayTeamId: "t2",
        driverKind: "full",
      }),
    ).toMatchObject({ driverKind: "full" });
  });

  it("Lot 3.B.1 — driverKind optionnel (omis = inherit saison)", () => {
    const out = testMatchSchema.parse({ homeTeamId: "t1", awayTeamId: "t2" });
    expect(out.driverKind).toBeUndefined();
  });

  it("Lot 3.B.1 — rejette driverKind invalide", () => {
    expect(() =>
      testMatchSchema.parse({
        homeTeamId: "t1",
        awayTeamId: "t2",
        driverKind: "garbage",
      }),
    ).toThrow();
  });
});

describe("handleCreateTestMatch — Lot 2.C.2", () => {
  it("retourne 201 + matchId quand la création réussit", async () => {
    (createTestMatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      matchId: "m-abc",
      seasonId: "s-2026",
      engineVer: "0.16.0",
    });
    const res = buildRes();
    await handleCreateTestMatch(
      { body: { homeTeamId: "t1", awayTeamId: "t2" } } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      matchId: "m-abc",
      seasonId: "s-2026",
      engineVer: "0.16.0",
    });
  });

  it("retourne 400 quand les teams sont identiques (user input error)", async () => {
    (createTestMatch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("homeTeamId et awayTeamId doivent être distincts"),
    );
    const res = buildRes();
    await handleCreateTestMatch(
      { body: { homeTeamId: "t1", awayTeamId: "t1" } } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("retourne 400 quand une team est introuvable", async () => {
    (createTestMatch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Teams introuvables : t-unknown"),
    );
    const res = buildRes();
    await handleCreateTestMatch(
      {
        body: { homeTeamId: "t1", awayTeamId: "t-unknown" },
      } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("retourne 500 quand le sim crash (erreur interne)", async () => {
    (createTestMatch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("simulateMatch boom"),
    );
    const res = buildRes();
    await handleCreateTestMatch(
      { body: { homeTeamId: "t1", awayTeamId: "t2" } } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(500);
  });

  it("Lot 3.B.1 — propage driverKind à createTestMatch", async () => {
    (createTestMatch as ReturnType<typeof vi.fn>).mockResolvedValue({
      matchId: "m-x",
      seasonId: "s-2026",
      engineVer: "0.16.0",
    });
    const res = buildRes();
    await handleCreateTestMatch(
      {
        body: { homeTeamId: "t1", awayTeamId: "t2", driverKind: "full" },
      } as unknown as Request,
      res,
    );
    expect(createTestMatch).toHaveBeenCalledWith({
      homeTeamId: "t1",
      awayTeamId: "t2",
      driverKind: "full",
    });
  });
});

describe("handleListTestMatches — Lot 2.C.2", () => {
  it("retourne la liste sans limit", async () => {
    (listTestMatches as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = buildRes();
    await handleListTestMatches({ query: {} } as unknown as Request, res);
    expect(listTestMatches).toHaveBeenCalledWith(undefined);
    expect(res.body).toEqual({ matches: [] });
  });

  it("forwarde une limit numérique en query string", async () => {
    (listTestMatches as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = buildRes();
    await handleListTestMatches(
      { query: { limit: "50" } } as unknown as Request,
      res,
    );
    expect(listTestMatches).toHaveBeenCalledWith(50);
  });

  it("ignore une limit non-numérique", async () => {
    (listTestMatches as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = buildRes();
    await handleListTestMatches(
      { query: { limit: "abc" } } as unknown as Request,
      res,
    );
    expect(listTestMatches).toHaveBeenCalledWith(undefined);
  });
});

describe("comparisonSchema — Lot 3.B.2 input validation", () => {
  it("accepte un payload valide", () => {
    const out = comparisonSchema.parse({
      homeTeamId: "pit-smashers",
      awayTeamId: "kc-soaring-hawks",
      matches: 25,
      seedOffset: 0,
    });
    expect(out.matches).toBe(25);
  });

  it("rejette matches > 1000", () => {
    expect(() =>
      comparisonSchema.parse({
        homeTeamId: "a",
        awayTeamId: "b",
        matches: 1001,
        seedOffset: 0,
      }),
    ).toThrow();
  });

  it("rejette matches non entier", () => {
    expect(() =>
      comparisonSchema.parse({
        homeTeamId: "a",
        awayTeamId: "b",
        matches: 25.5,
        seedOffset: 0,
      }),
    ).toThrow();
  });

  it("rejette homeTeamId vide", () => {
    expect(() =>
      comparisonSchema.parse({
        homeTeamId: "",
        awayTeamId: "b",
        matches: 25,
        seedOffset: 0,
      }),
    ).toThrow();
  });
});

describe("handleRunComparison — Lot 3.B.2", () => {
  it("retourne 201 + aggregate quand le service réussit", async () => {
    (runEngineComparison as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ec-1",
      engineVer: "0.16.0",
      aggregate: {
        matches: 25,
        scoreTotal: { mean: 0.4, p50: 0, p95: 1, max: 2 },
        turnoverCount: { mean: 0.5, p50: 0, p95: 1, max: 2 },
        touchdownCount: { mean: 0.2, p50: 0, p95: 1, max: 1 },
        casualtyCount: { mean: 0.1, p50: 0, p95: 1, max: 1 },
        outcomeFlippedCount: 1,
        divergedPct: 0.2,
      },
    });
    const res = buildRes();
    await handleRunComparison(
      {
        body: {
          homeTeamId: "pit-smashers",
          awayTeamId: "kc-soaring-hawks",
          matches: 25,
          seedOffset: 0,
        },
      } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(201);
    expect((res.body as { id: string }).id).toBe("ec-1");
    expect(runEngineComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        homeTeamId: "pit-smashers",
        awayTeamId: "kc-soaring-hawks",
        matches: 25,
        seedOffset: 0,
        source: "admin",
      }),
      expect.objectContaining({ metrics: appMetrics }),
    );
  });

  it("retourne 400 quand teams identiques (user input)", async () => {
    (runEngineComparison as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("homeTeamId et awayTeamId doivent être distincts"),
    );
    const res = buildRes();
    await handleRunComparison(
      {
        body: {
          homeTeamId: "a",
          awayTeamId: "a",
          matches: 5,
          seedOffset: 0,
        },
      } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("retourne 400 quand team inconnue", async () => {
    (runEngineComparison as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Team home inconnue : team-bidon"),
    );
    const res = buildRes();
    await handleRunComparison(
      {
        body: {
          homeTeamId: "team-bidon",
          awayTeamId: "kc-soaring-hawks",
          matches: 5,
          seedOffset: 0,
        },
      } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it("retourne 500 quand le sim crash", async () => {
    (runEngineComparison as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("simulateMatch boom"),
    );
    const res = buildRes();
    await handleRunComparison(
      {
        body: {
          homeTeamId: "a",
          awayTeamId: "b",
          matches: 5,
          seedOffset: 0,
        },
      } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(500);
  });
});
