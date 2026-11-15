/**
 * Coupe PRIVÉE = invisible (404) sur toutes ses lectures par id.
 *
 * Chaîne Express réelle (vrais JWT signés avec `JWT_SECRET`, routeurs montés
 * dans l'ordre de `index.ts`), Prisma mocké. Avant ce change, chacune de ces
 * lectures servait une coupe privée à n'importe quel compte connecté.
 */

import express from "express";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn() },
    cupPairing: { findUnique: vi.fn() },
    cupParticipant: { count: vi.fn() },
    cupInvitation: { count: vi.fn() },
    leaguePairing: { findUnique: vi.fn() },
  },
}));
vi.mock("../services/cup-leaderboards", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../services/cup-leaderboards")>();
  return { ...actual, loadCupLeaderboards: vi.fn(async () => ({ ok: true })) };
});

import { prisma } from "../prisma";
import { JWT_SECRET } from "../config";
import cupRoundRoutes from "./cup-rounds";
import cupMatchSheetRoutes from "./cup-match-sheet";
import cupPoolRoutes from "./cup-pools";
import cupPlayoffRoutes from "./cup-playoffs";
import cupTeamRosterRoutes from "./cup-team-roster";
import cupLeaderboardRoutes from "./cup-leaderboards";
import cupPredictionRoutes from "./cup-predictions";
import cupRoutes from "./cup";
import { requestApp } from "../test-utils/express-request";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as Record<string, Record<string, MockFn>>;

const COMMISH = "commish";
const MEMBER = "member";
const INVITEE = "invitee";
const STRANGER = "stranger";

function tokenFor(userId: string, roles: readonly string[] = ["user"]): string {
  return jwt.sign({ sub: userId, roles: [...roles] }, JWT_SECRET);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/cup", cupRoundRoutes);
  app.use("/cup", cupMatchSheetRoutes);
  app.use("/cup", cupPoolRoutes);
  app.use("/cup", cupPlayoffRoutes);
  app.use("/cup", cupTeamRosterRoutes);
  app.use("/cup", cupLeaderboardRoutes);
  app.use("/cup", cupPredictionRoutes);
  app.use("/cup", cupRoutes);
  return app;
}

const CUP = { id: "cup-1", creatorId: COMMISH, isPublic: false };

beforeEach(() => {
  vi.resetAllMocks();
  db.cup.findUnique.mockResolvedValue(CUP);
  db.cupPairing.findUnique.mockResolvedValue({ round: { cup: CUP } });
  db.leaguePairing.findUnique.mockResolvedValue(null);
  db.cupParticipant.count.mockImplementation(
    async (args: { where: { team: { ownerId: string } } }) =>
      args.where.team.ownerId === MEMBER ? 1 : 0,
  );
  db.cupInvitation.count.mockImplementation(
    async (args: { where: { OR: Array<{ inviteeUserId?: string }> } }) =>
      args.where.OR[0].inviteeUserId === INVITEE ? 1 : 0,
  );
});

const READS = [
  "/cup/cup-1",
  "/cup/cup-1/rounds",
  "/cup/cup-1/pools",
  "/cup/cup-1/playoffs",
  "/cup/cup-1/teams/team-1/roster-view",
  "/cup/cup-1/leaderboards",
  "/cup/cup-1/predictions",
  "/cup/cup-1/predictions/leaderboard",
  "/cup/pairings/pairing-1/sheet",
  "/cup/pairings/pairing-1/sheet/can-invalidate",
];

describe("coupe privée : un coach étranger reçoit un 404 partout", () => {
  it.each(READS)("GET %s", async (path) => {
    const res = await requestApp(buildApp(), "GET", path, {
      token: tokenFor(STRANGER),
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/introuvable/i);
  });

  it("même message qu'une coupe inexistante", async () => {
    const hidden = await requestApp(buildApp(), "GET", "/cup/cup-1/rounds", {
      token: tokenFor(STRANGER),
    });
    db.cup.findUnique.mockResolvedValue(null);
    const missing = await requestApp(buildApp(), "GET", "/cup/nope/rounds", {
      token: tokenFor(STRANGER),
    });
    expect(hidden.body.error).toBe("Coupe introuvable");
    expect(missing.body.error).toBe(hidden.body.error);
  });
});

describe("coupe privée : ses membres passent la garde", () => {
  it.each([
    ["commissaire", tokenFor(COMMISH)],
    ["inscrit", tokenFor(MEMBER)],
    ["invité", tokenFor(INVITEE)],
    ["admin", tokenFor("admin-1", ["admin"])],
  ])("%s", async (_label, token) => {
    const res = await requestApp(buildApp(), "GET", "/cup/cup-1/leaderboards", {
      token,
    });
    expect(res.status).toBe(200);
  });
});

describe("coupe publique", () => {
  it("lisible par un coach étranger", async () => {
    db.cup.findUnique.mockResolvedValue({ ...CUP, isPublic: true });
    const res = await requestApp(buildApp(), "GET", "/cup/cup-1/leaderboards", {
      token: tokenFor(STRANGER),
    });
    expect(res.status).toBe(200);
    expect(db.cupParticipant.count).not.toHaveBeenCalled();
  });
});
