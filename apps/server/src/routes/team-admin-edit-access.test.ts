/**
 * Édition d'équipe par un ADMIN sur une équipe qui n'est pas la sienne.
 *
 * Les trois blocs demandés par la console admin sont couverts au niveau du
 * handler : liste des positions, Star Players, coups de pouce (staff). Ce qui
 * est vérifié n'est pas la logique métier (déjà testée pour le coach) mais
 * les DEUX bascules : le `where` ne contraint plus `ownerId`, et le gel
 * « équipe engagée » ne s'applique pas à l'admin.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    teamSelection: { findFirst: vi.fn() },
    teamPlayer: { findFirst: vi.fn(), create: vi.fn() },
    teamStarPlayer: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock("../services/team-lock-status", () => ({
  isTeamRosterFrozen: vi.fn(async () => true),
  TEAM_ENGAGED_MESSAGE: "Cette equipe est engagee",
}));

vi.mock("../services/team-audit", () => ({
  captureTeamState: vi.fn(async () => null),
  safeRecordTeamAudit: vi.fn(async () => {}),
}));

vi.mock("../utils/team-values", () => ({
  updateTeamValues: vi.fn(async () => ({ teamValue: 0, currentValue: 0 })),
  sumPlayerCostsForTeam: vi.fn(async () => 0),
}));

// Plafonds de staff et budget : hors sujet ici (couverts par les tests
// dédiés du coach), on les neutralise pour isoler la bascule d'accès.
vi.mock("../services/roster-staff-config", () => ({
  resolveStaffConfigBySlug: vi.fn(async () => ({
    rerollCost: 50_000,
    maxRerolls: 8,
    apothecaryAllowed: true,
    apothecaryCost: 50_000,
    maxCheerleaders: 12,
    cheerleaderCost: 10_000,
    maxAssistants: 6,
    assistantCost: 10_000,
    maxDedicatedFans: 6,
    dedicatedFanCost: 10_000,
  })),
}));

vi.mock("../services/team-budget-summary", () => ({
  buildTeamBudgetSummary: vi.fn(async () => ({
    totalSpent: 0,
    remaining: 1_000_000,
  })),
  syncDraftTreasury: vi.fn(async () => {}),
}));

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(async () => ({
    positions: [
      {
        slug: "skaven_lineman",
        displayName: "Coureur des rues",
        cost: 50,
        min: 0,
        max: 16,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: [],
        primarySkills: "G",
        secondarySkills: "A,S",
      },
    ],
  })),
}));

import type { Response } from "express";
import { prisma } from "../prisma";
import { isTeamRosterFrozen } from "../services/team-lock-status";
import { handleListAvailablePositions } from "./team-player-handlers";
import { handleListTeamStarPlayers } from "./team-star-player-handlers";
import { handlePutTeamInfo } from "./team-mutation-handlers";

const mockPrisma = prisma as any;
const mockedFrozen = vi.mocked(isTeamRosterFrozen);

const TEAM = {
  id: "team-1",
  ownerId: "someone-else",
  name: "Les Rats",
  roster: "skaven",
  ruleset: "season_3",
  format: "bb11",
  initialBudget: 1000,
  treasury: 0,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 1,
  players: [],
  starPlayers: [],
};

function reqAs(roles: string[], body: unknown = {}): any {
  return { params: { id: "team-1" }, user: { id: "admin-1", roles }, body };
}

function fakeRes(): { res: Response; status: () => number | null; payload: () => any } {
  let statusCode: number | null = null;
  let payload: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      payload = body;
      return this;
    },
  } as unknown as Response;
  return { res, status: () => statusCode, payload: () => payload };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFrozen.mockResolvedValue(true);
  mockPrisma.team.findFirst.mockResolvedValue({ ...TEAM });
  mockPrisma.teamSelection.findFirst.mockResolvedValue(null);
  mockPrisma.team.update.mockResolvedValue({ ...TEAM });
  mockPrisma.team.findUnique.mockResolvedValue({ ...TEAM });
});

describe("liste des positions — GET /team/:id/available-positions", () => {
  it("admin : requête l'équipe SANS contrainte de propriétaire", async () => {
    const { res } = fakeRes();
    await handleListAvailablePositions(reqAs(["admin"]), res);

    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "team-1" } }),
    );
  });

  it("admin : annonce le roster déverrouillé même sur une équipe engagée", async () => {
    const { res, payload } = fakeRes();
    await handleListAvailablePositions(reqAs(["admin"]), res);

    expect(payload().data.frozen).toBe(false);
    expect(mockedFrozen).not.toHaveBeenCalled();
  });

  it("coach : reste contraint à ses équipes et subit le gel", async () => {
    const { res, payload } = fakeRes();
    await handleListAvailablePositions(reqAs(["user"]), res);

    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "team-1", ownerId: "admin-1" } }),
    );
    expect(payload().data.frozen).toBe(true);
  });
});

describe("Star Players — GET /team/:id/star-players", () => {
  it("admin : lit les Star Players d'une équipe tierce", async () => {
    const { res, payload } = fakeRes();
    await handleListTeamStarPlayers(reqAs(["admin"]), res);

    expect(mockPrisma.team.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "team-1" } }),
    );
    expect(payload().data.starPlayers).toEqual([]);
  });

  it("coach : 404 quand l'équipe n'est pas la sienne", async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const { res, status } = fakeRes();
    await handleListTeamStarPlayers(reqAs(["user"]), res);

    expect(status()).toBe(404);
  });
});

describe("coups de pouce — PUT /team/:id/info", () => {
  it("admin : modifie le staff d'une équipe engagée (gel non applicable)", async () => {
    const { res, status } = fakeRes();
    await handlePutTeamInfo(reqAs(["admin"], { rerolls: 3 }), res);

    expect(status()).not.toBe(403);
    expect(mockPrisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "team-1" },
        data: expect.objectContaining({ rerolls: 3 }),
      }),
    );
  });

  it("coach : 403 sur une équipe engagée", async () => {
    mockPrisma.team.findFirst.mockResolvedValue({
      ...TEAM,
      ownerId: "admin-1",
    });
    const { res, status } = fakeRes();
    await handlePutTeamInfo(reqAs(["user"], { rerolls: 3 }), res);

    expect(status()).toBe(403);
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });

  it("le lock « match en cours » s'applique AUSSI à l'admin", async () => {
    // Un match live a un état de jeu en cours : y toucher corromprait la
    // partie. Ce lock-là n'est pas de l'anti-triche, il ne se contourne pas.
    mockPrisma.teamSelection.findFirst.mockResolvedValue({ id: "sel-1" });
    const { res, status } = fakeRes();
    await handlePutTeamInfo(reqAs(["admin"], { rerolls: 3 }), res);

    expect(status()).toBe(400);
    expect(mockPrisma.team.update).not.toHaveBeenCalled();
  });
});
