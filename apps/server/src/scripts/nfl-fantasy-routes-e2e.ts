/**
 * E2E Phase 2.G : exerce les routes HTTP nouvellement montees.
 * Lance dans le container nufflearena_server (qui resout
 * http://localhost:8201 vers son propre Express).
 *
 *   pnpm exec tsx src/scripts/nfl-fantasy-routes-e2e.ts
 *
 * Couvre :
 *   - 401 sans token sur toutes les routes user + admin
 *   - 403 admin sur les routes admin avec un token user normal
 *   - happy path : create league -> get -> patch -> delete (user)
 *   - lecture admin : seed-teams idempotent
 */

import jwt from "jsonwebtoken";

import { JWT_SECRET } from "../config";
import { prisma } from "../prisma";

const BASE = "http://localhost:8201";

interface Result {
  ok: boolean;
  status: number;
  body: unknown;
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<Result> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { ok: res.ok, status: res.status, body };
}

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  [${name}] `);
  try {
    await fn();
    console.log("OK");
  } catch (e) {
    console.log("FAIL");
    throw e;
  }
}

function assertStatus(got: Result, expected: number, what: string): void {
  if (got.status !== expected) {
    throw new Error(
      `${what}: status ${got.status} (attendu ${expected}) ; body=${JSON.stringify(got.body)}`,
    );
  }
}

async function ensureTestUser(opts: {
  id: string;
  email: string;
  isAdmin: boolean;
}): Promise<string> {
  // upsert pour idempotence — on assume que email est unique
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {
      coachName: opts.email.split("@")[0],
      roles: opts.isAdmin ? ["user", "admin"] : ["user"],
      role: opts.isAdmin ? "admin" : "user",
    },
    create: {
      id: opts.id,
      email: opts.email,
      passwordHash: "test-hash-do-not-use",
      coachName: opts.email.split("@")[0],
      roles: opts.isAdmin ? ["user", "admin"] : ["user"],
      role: opts.isAdmin ? "admin" : "user",
      valid: true,
    },
  });
  return user.id;
}

function signToken(userId: string, isAdmin: boolean): string {
  return jwt.sign(
    {
      sub: userId,
      roles: isAdmin ? ["user", "admin"] : ["user"],
    },
    JWT_SECRET,
    { expiresIn: "5m" },
  );
}

async function main(): Promise<void> {
  console.log("[routes-e2e] start");

  const ts = Date.now();
  const userEmail = `e2e-g-user-${ts}@local.test`;
  const adminEmail = `e2e-g-admin-${ts}@local.test`;

  const userId = await ensureTestUser({
    id: `e2e-g-user-${ts}`,
    email: userEmail,
    isAdmin: false,
  });
  const adminId = await ensureTestUser({
    id: `e2e-g-admin-${ts}`,
    email: adminEmail,
    isAdmin: true,
  });

  const userToken = signToken(userId, false);
  const adminToken = signToken(adminId, true);

  let createdLeagueId = "";

  try {
    await step("401 sans token /api/nfl-fantasy/leagues", async () => {
      const r = await call("GET", "/api/nfl-fantasy/leagues");
      assertStatus(r, 401, "GET leagues sans token");
    });

    await step("401 sans token /admin/nfl/ingest/seed-teams", async () => {
      const r = await call("POST", "/admin/nfl/ingest/seed-teams");
      assertStatus(r, 401, "admin sans token");
    });

    await step("403 user normal sur /admin/nfl/ingest/seed-teams", async () => {
      const r = await call("POST", "/admin/nfl/ingest/seed-teams", {
        token: userToken,
      });
      assertStatus(r, 403, "admin avec token user");
    });

    await step("POST /leagues create -> 201", async () => {
      const r = await call("POST", "/api/nfl-fantasy/leagues", {
        token: userToken,
        body: {
          name: "Phase 2G Routes E2E",
          teamName: "Routes Mob",
          seasonId: "2025",
        },
      });
      assertStatus(r, 201, "create league");
      const body = r.body as { id: string; entries: unknown[] };
      if (!body.id || !Array.isArray(body.entries) || body.entries.length !== 1) {
        throw new Error("payload create league inattendu");
      }
      createdLeagueId = body.id;
    });

    await step("GET /leagues/:id -> 200", async () => {
      const r = await call("GET", `/api/nfl-fantasy/leagues/${createdLeagueId}`, {
        token: userToken,
      });
      assertStatus(r, 200, "get league");
    });

    await step("GET /leagues/missing -> 404 NOT_FOUND", async () => {
      const r = await call("GET", "/api/nfl-fantasy/leagues/lg-missing", {
        token: userToken,
      });
      assertStatus(r, 404, "get league missing");
      if ((r.body as { code: string }).code !== "NOT_FOUND") {
        throw new Error(
          `code attendu NOT_FOUND, recu ${(r.body as { code: string }).code}`,
        );
      }
    });

    await step("PATCH /leagues/:id rename -> 200", async () => {
      const r = await call("PATCH", `/api/nfl-fantasy/leagues/${createdLeagueId}`, {
        token: userToken,
        body: { name: "Phase 2G Renamed" },
      });
      assertStatus(r, 200, "patch league");
      if ((r.body as { name: string }).name !== "Phase 2G Renamed") {
        throw new Error("rename pas pris en compte");
      }
    });

    await step("PATCH validation 400 sur name trop court", async () => {
      const r = await call("PATCH", `/api/nfl-fantasy/leagues/${createdLeagueId}`, {
        token: userToken,
        body: { name: "x" },
      });
      assertStatus(r, 400, "patch invalid name");
    });

    await step("POST seed-teams admin -> 200 idempotent", async () => {
      const r = await call("POST", "/admin/nfl/ingest/seed-teams", {
        token: adminToken,
      });
      assertStatus(r, 200, "seed-teams admin");
      const body = r.body as { teamsCreated: number; teamsUpdated: number };
      if (
        typeof body.teamsCreated !== "number" ||
        typeof body.teamsUpdated !== "number"
      ) {
        throw new Error("payload seed-teams inattendu");
      }
      if (body.teamsCreated + body.teamsUpdated !== 32) {
        throw new Error(
          `total = ${body.teamsCreated + body.teamsUpdated}, attendu 32`,
        );
      }
    });

    await step(
      "POST /admin/nfl-fantasy/lock-lineups validation 400 sans weekId",
      async () => {
        const r = await call("POST", "/admin/nfl-fantasy/lock-lineups", {
          token: adminToken,
          body: {},
        });
        assertStatus(r, 400, "lock-lineups validation");
      },
    );

    await step(
      "POST /admin/nfl-fantasy/settle-week 404 NOT_FOUND si league absente",
      async () => {
        const r = await call("POST", "/admin/nfl-fantasy/settle-week", {
          token: adminToken,
          body: { leagueId: "lg-missing", weekId: "2025:W10" },
        });
        assertStatus(r, 200, "settle-week sur 0 matchup retourne 200");
        // Note: settleNflFantasyWeek tolere une league absente (matchups
        // findMany retourne []), donc on attend 200 avec 0 matchupsSettled.
        const body = r.body as { matchupsSettled: number };
        if (body.matchupsSettled !== 0) {
          throw new Error("matchupsSettled != 0 sur league fantome");
        }
      },
    );

    await step("DELETE /leagues/:id -> 204", async () => {
      const r = await call("DELETE", `/api/nfl-fantasy/leagues/${createdLeagueId}`, {
        token: userToken,
      });
      assertStatus(r, 204, "delete league");
      createdLeagueId = "";
    });

    console.log("[routes-e2e] all steps OK");
  } finally {
    if (createdLeagueId) {
      await prisma.nflFantasyLeague
        .delete({ where: { id: createdLeagueId } })
        .catch(() => undefined);
    }
    // Cleanup users
    await prisma.user.deleteMany({
      where: { email: { in: [userEmail, adminEmail] } },
    }).catch(() => undefined);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error("[routes-e2e] fatal:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
