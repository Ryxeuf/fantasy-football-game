/**
 * Regression tests for GET /api/rosters — ensures that the public roster
 * listing returns results for every supported `ruleset`.
 *
 * Background: production had a bug where the frontend asked for
 * `?ruleset=season_3` but the database only contained season_2 rosters,
 * so the /teams page appeared empty for "Saison 3 (2025)". This test
 * locks in the expected behaviour.
 */

import fetch from "node-fetch";

const API_BASE =
  process.env.API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE ||
  `http://localhost:${process.env.API_PORT || "18001"}`;

interface RosterSummary {
  slug: string;
  name: string;
  budget: number;
  tier: string;
  naf: boolean;
  ruleset?: string;
}

interface RostersResponse {
  rosters: RosterSummary[];
  ruleset: string;
  availableRulesets?: string[];
}

async function waitForServer(maxWaitMs = 20_000): Promise<void> {
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return;
    } catch (error: unknown) {
      lastError = error;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Server at ${API_BASE} did not become ready within ${maxWaitMs}ms: ${String(lastError)}`,
  );
}

async function seedRosters(): Promise<void> {
  await waitForServer();
  const res = await fetch(`${API_BASE}/__test/seed-rosters`, {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(
      `Failed to seed rosters: ${res.status} ${await res.text()}`,
    );
  }
}

describe("GET /api/rosters (public rosters listing)", () => {
  beforeAll(async () => {
    await seedRosters();
  });

  it("returns season_2 rosters when ?ruleset=season_2", async () => {
    const res = await fetch(`${API_BASE}/api/rosters?ruleset=season_2`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as RostersResponse;
    expect(data.ruleset).toBe("season_2");
    expect(Array.isArray(data.rosters)).toBe(true);
    expect(data.rosters.length).toBeGreaterThan(0);
  });

  it("returns season_3 rosters when ?ruleset=season_3 (regression for empty /teams in 2025)", async () => {
    const res = await fetch(`${API_BASE}/api/rosters?ruleset=season_3`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as RostersResponse;
    expect(data.ruleset).toBe("season_3");
    expect(Array.isArray(data.rosters)).toBe(true);
    expect(data.rosters.length).toBeGreaterThan(0);
  });

  it("exposes the list of available rulesets in the response metadata", async () => {
    const res = await fetch(`${API_BASE}/api/rosters?ruleset=season_3`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as RostersResponse;
    expect(Array.isArray(data.availableRulesets)).toBe(true);
    expect(data.availableRulesets).toEqual(
      expect.arrayContaining(["season_2", "season_3"]),
    );
  });

  it("falls back to the default ruleset when the query param is invalid", async () => {
    const res = await fetch(`${API_BASE}/api/rosters?ruleset=not_a_season`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as RostersResponse;
    // resolveRuleset() returns DEFAULT_RULESET for unknown values.
    expect(["season_2", "season_3"]).toContain(data.ruleset);
    expect(data.rosters.length).toBeGreaterThan(0);
  });
});
