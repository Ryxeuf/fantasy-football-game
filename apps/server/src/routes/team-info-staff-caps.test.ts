/**
 * `PUT /team/:id/info` — les plafonds de staff viennent de la config du
 * roster x format (`RosterStaffConfig`), pas de constantes ecrites en dur.
 *
 * Regression : le schema Zod bornait 0-8 relances / 0-12 cheerleaders /
 * 0-6 assistants / 1-6 fans quel que soit le format. Une equipe Sevens
 * (6 / 6 / 3) pouvait donc enregistrer un staff illegal, et un roster sans
 * apothicaire pouvait s'en payer un.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    teamSelection: { findFirst: vi.fn() },
    roster: { findUnique: vi.fn() },
    rosterStaffConfig: { findUnique: vi.fn() },
  },
}));

vi.mock("../utils/team-values", () => ({
  updateTeamValues: vi.fn(),
}));

vi.mock("../services/team-lock-status", () => ({
  isTeamRosterFrozen: vi.fn().mockResolvedValue(false),
  TEAM_ENGAGED_MESSAGE: "engagee",
}));

vi.mock("../services/team-budget-summary", () => ({
  buildTeamBudgetSummary: vi.fn(),
  syncDraftTreasury: vi.fn(),
}));

import { defaultStaffConfig } from "@bb/game-engine";
import {
  buildTeamBudgetSummary,
  syncDraftTreasury,
} from "../services/team-budget-summary";
import {
  handlePutTeamInfo,
  validateStaffAgainstConfig,
} from "./team-mutation-handlers";
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authUser";

const BB11 = defaultStaffConfig("orc", "bb11");
const SEVENS = defaultStaffConfig("orc", "sevens");

describe("validateStaffAgainstConfig", () => {
  it("accepte un staff dans les plafonds", () => {
    expect(
      validateStaffAgainstConfig(
        { rerolls: 8, cheerleaders: 12, assistants: 6, dedicatedFans: 6 },
        BB11,
      ),
    ).toBeNull();
  });

  it("refuse au-dela du plafond de relances du format", () => {
    // Legal en BB11 (max 8), illegal en Sevens (max 6).
    expect(validateStaffAgainstConfig({ rerolls: 8 }, BB11)).toBeNull();
    const error = validateStaffAgainstConfig({ rerolls: 8 }, SEVENS);
    expect(error).toContain("relances");
    expect(error).toContain(String(SEVENS.maxRerolls));
  });

  it("refuse au-dela du plafond d'assistants du format", () => {
    expect(validateStaffAgainstConfig({ assistants: 6 }, BB11)).toBeNull();
    expect(validateStaffAgainstConfig({ assistants: 6 }, SEVENS)).toContain(
      "assistants",
    );
  });

  it("refuse un plafond resserre en base (admin)", () => {
    const tight = { ...BB11, maxCheerleaders: 4 };
    expect(validateStaffAgainstConfig({ cheerleaders: 5 }, tight)).toContain(
      "cheerleaders",
    );
    expect(validateStaffAgainstConfig({ cheerleaders: 4 }, tight)).toBeNull();
  });

  it("refuse moins d'un fan devoue", () => {
    expect(validateStaffAgainstConfig({ dedicatedFans: 0 }, BB11)).toContain(
      "fans devoues",
    );
  });

  it("refuse l'apothicaire pour un roster qui n'y a pas droit", () => {
    const noApo = { ...BB11, apothecaryAllowed: false };
    expect(validateStaffAgainstConfig({ apothecary: true }, noApo)).toContain(
      "apothicaire",
    );
    // Le decocher reste legal (utile pour reparer une equipe historique).
    expect(validateStaffAgainstConfig({ apothecary: false }, noApo)).toBeNull();
  });

  it("ignore les champs absents", () => {
    expect(validateStaffAgainstConfig({}, SEVENS)).toBeNull();
  });
});

function createReq(body: unknown): AuthenticatedRequest {
  return {
    params: { id: "team-1" },
    body,
    user: { id: "user-1" },
  } as unknown as AuthenticatedRequest;
}

function createRes(): Response & { statusCode: number; payload: unknown } {
  const res = {
    statusCode: 200,
    payload: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.payload = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; payload: unknown };
}

const mockBudget = buildTeamBudgetSummary as ReturnType<typeof vi.fn>;
const mockSyncTreasury = syncDraftTreasury as ReturnType<typeof vi.fn>;

describe("handlePutTeamInfo — plafonds resolus en base", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Par defaut : budget exactement consomme (reliquat 0).
    mockBudget.mockResolvedValue({ remaining: 0, totalSpent: 1_000_000 });
    mockSyncTreasury.mockResolvedValue(0);
  });

  async function mocks() {
    const { prisma } = vi.mocked(await import("../prisma"));
    return prisma as unknown as {
      team: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
      teamSelection: { findFirst: ReturnType<typeof vi.fn> };
      roster: { findUnique: ReturnType<typeof vi.fn> };
      rosterStaffConfig: { findUnique: ReturnType<typeof vi.fn> };
    };
  }

  it("refuse 8 relances pour une equipe Sevens", async () => {
    const prisma = await mocks();
    prisma.team.findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "orc",
      ruleset: "season_3",
      format: "sevens",
    });
    prisma.teamSelection.findFirst.mockResolvedValue(null);
    prisma.roster.findUnique.mockResolvedValue(null); // => defaultStaffConfig

    const res = createRes();
    await handlePutTeamInfo(createReq({ rerolls: 8 }), res);

    expect(res.statusCode).toBe(400);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it("applique le plafond de la ligne RosterStaffConfig en base", async () => {
    const prisma = await mocks();
    prisma.team.findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "orc",
      ruleset: "season_3",
      format: "bb11",
    });
    prisma.teamSelection.findFirst.mockResolvedValue(null);
    prisma.roster.findUnique.mockResolvedValue({ id: "roster-1", slug: "orc" });
    prisma.rosterStaffConfig.findUnique.mockResolvedValue({
      ...BB11,
      maxRerolls: 3,
    });

    const res = createRes();
    await handlePutTeamInfo(createReq({ rerolls: 4 }), res);

    expect(res.statusCode).toBe(400);
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it("accepte un staff legal et persiste", async () => {
    const prisma = await mocks();
    prisma.team.findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "orc",
      ruleset: "season_3",
      format: "bb11",
    });
    prisma.teamSelection.findFirst.mockResolvedValue(null);
    prisma.roster.findUnique.mockResolvedValue(null);
    prisma.team.update.mockResolvedValue({ id: "team-1", players: [] });
    prisma.team.findUnique.mockResolvedValue({ id: "team-1", players: [] });

    const res = createRes();
    await handlePutTeamInfo(createReq({ rerolls: 4, dedicatedFans: 3 }), res);

    expect(res.statusCode).toBe(200);
    expect(prisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { rerolls: 4, dedicatedFans: 3 } }),
    );
  });
});

describe("handlePutTeamInfo — budget et tresorerie du brouillon", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSyncTreasury.mockResolvedValue(0);
  });

  async function draftTeam() {
    const { prisma } = vi.mocked(await import("../prisma"));
    const p = prisma as unknown as {
      team: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
      teamSelection: { findFirst: ReturnType<typeof vi.fn> };
      roster: { findUnique: ReturnType<typeof vi.fn> };
    };
    p.team.findFirst.mockResolvedValue({
      id: "team-1",
      ownerId: "user-1",
      roster: "orc",
      ruleset: "season_3",
      format: "bb11",
      initialBudget: 1000,
      treasury: 70_000,
      rerolls: 2,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
      players: [{ position: "orc_trois_quart_orque" }],
      starPlayers: [],
    });
    p.teamSelection.findFirst.mockResolvedValue(null);
    p.roster.findUnique.mockResolvedValue(null);
    p.team.update.mockResolvedValue({ id: "team-1", players: [] });
    p.team.findUnique.mockResolvedValue({ id: "team-1", players: [] });
    return p;
  }

  it("refuse un staff qui depasse le budget initial (meme regle que PUT /roster)", async () => {
    const prisma = await draftTeam();
    mockBudget.mockResolvedValue({ remaining: -60_000, totalSpent: 1_060_000 });

    const res = createRes();
    await handlePutTeamInfo(createReq({ rerolls: 3 }), res);

    expect(res.statusCode).toBe(400);
    expect(res.payload).toMatchObject({
      error: expect.stringContaining("Budget depasse"),
    });
    expect(prisma.team.update).not.toHaveBeenCalled();
    expect(mockSyncTreasury).not.toHaveBeenCalled();
  });

  it("evalue le budget avec le staff CIBLE fusionne sur l'equipe", async () => {
    await draftTeam();
    mockBudget.mockResolvedValue({ remaining: 0, totalSpent: 1_000_000 });

    await handlePutTeamInfo(createReq({ rerolls: 3, assistants: 1 }), createRes());

    expect(mockBudget).toHaveBeenCalledWith(
      expect.anything(),
      // Champs absents du body : valeurs courantes de l'equipe.
      expect.objectContaining({
        rerolls: 3,
        assistants: 1,
        cheerleaders: 0,
        dedicatedFans: 1,
        initialBudget: 1000,
      }),
      [{ position: "orc_trois_quart_orque" }],
      [],
    );
  });

  it("resynchronise la tresorerie du brouillon apres la mise a jour", async () => {
    const prisma = await draftTeam();
    mockBudget.mockResolvedValue({ remaining: 0, totalSpent: 1_000_000 });

    const res = createRes();
    await handlePutTeamInfo(createReq({ rerolls: 3 }), res);

    expect(res.statusCode).toBe(200);
    expect(mockSyncTreasury).toHaveBeenCalledTimes(1);
    expect(mockSyncTreasury).toHaveBeenCalledWith(prisma, "team-1");
    // Le sync vient APRES l'ecriture du staff (il lit l'etat en base).
    expect(mockSyncTreasury.mock.invocationCallOrder[0]).toBeGreaterThan(
      prisma.team.update.mock.invocationCallOrder[0]!,
    );
  });
});
