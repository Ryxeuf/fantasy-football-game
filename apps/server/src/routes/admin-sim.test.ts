/**
 * Unit tests for the `/admin/sim/*` admin utility (Phase 0 helper).
 *
 * Tests the handlers directly — middleware (`authUser`, `adminOnly`,
 * `validate`) is covered by the routes that use the same pieces in
 * production.
 */

import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";

import {
  handleListTeams,
  handleRunSim,
  runSimSchema,
  type RunSimBody,
} from "./admin-sim";

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
