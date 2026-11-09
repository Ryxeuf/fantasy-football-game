/**
 * Routes des outils de calendrier du commissaire : handlers unitaires
 * (service mocké, req/res faits à la main — même patron que
 * `league-pairing-schedule.test.ts`) + schéma Zod.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/league-round-admin", () => ({
  updateLeagueRound: vi.fn(),
  deleteLeagueRound: vi.fn(),
  // Classe d'erreur DANS la factory (cf. CLAUDE.md).
  LeagueRoundAdminError: class LeagueRoundAdminError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "LeagueRoundAdminError";
    }
  },
}));

vi.mock("../services/league-season-deletion", () => ({
  deleteLeagueSeason: vi.fn(),
  LeagueSeasonDeletionError: class LeagueSeasonDeletionError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "LeagueSeasonDeletionError";
    }
  },
}));

vi.mock("../services/audit-log", () => ({
  safeRecordAdminActionFromRequest: vi.fn(async () => {}),
}));

vi.mock("../prisma", () => ({ prisma: {} }));

import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/authUser";
import {
  deleteLeagueRound,
  updateLeagueRound,
  LeagueRoundAdminError,
} from "../services/league-round-admin";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import {
  deleteLeagueSeason,
  LeagueSeasonDeletionError,
} from "../services/league-season-deletion";
import {
  handleDeleteLeagueRound,
  handleDeleteLeagueSeason,
  handleUpdateLeagueRound,
} from "./league-calendar-admin";
import { updateLeagueRoundSchema } from "../schemas/league-calendar-admin.schemas";

type MockFn = ReturnType<typeof vi.fn>;
const mockUpdate = updateLeagueRound as unknown as MockFn;
const mockDelete = deleteLeagueRound as unknown as MockFn;
const mockAudit = safeRecordAdminActionFromRequest as unknown as MockFn;
const mockDeleteSeason = deleteLeagueSeason as unknown as MockFn;

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response & {
    status: MockFn;
    json: MockFn;
  };
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<AuthenticatedRequest> = {}) {
  return {
    user: { id: "u-comm", roles: [] },
    params: { roundId: "r-1" },
    body: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("updateLeagueRoundSchema", () => {
  it("accepte un nom vide (nom par défaut) ou null", () => {
    expect(updateLeagueRoundSchema.safeParse({ name: "" }).success).toBe(true);
    expect(updateLeagueRoundSchema.safeParse({ name: null }).success).toBe(true);
  });

  it("convertit les dates ISO", () => {
    const parsed = updateLeagueRoundSchema.parse({
      startDate: "2026-11-10T00:00:00.000Z",
      endDate: null,
    });
    expect(parsed.startDate).toBeInstanceOf(Date);
    expect(parsed.endDate).toBeNull();
  });

  it("refuse un corps vide et un nom trop long", () => {
    expect(updateLeagueRoundSchema.safeParse({}).success).toBe(false);
    expect(
      updateLeagueRoundSchema.safeParse({ name: "x".repeat(121) }).success,
    ).toBe(false);
  });
});

describe("handleUpdateLeagueRound", () => {
  it("401 sans utilisateur", async () => {
    const res = makeRes();
    await handleUpdateLeagueRound(makeReq({ user: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("transmet le body validé, journalise et renvoie la journée", async () => {
    mockUpdate.mockResolvedValue({
      round: { id: "r-1", name: "Derby", startDate: null, endDate: null },
      before: { name: "Journee 3", startDate: null, endDate: null },
    });
    const res = makeRes();
    await handleUpdateLeagueRound(makeReq({ body: { name: "Derby" } }), res);
    expect(mockUpdate).toHaveBeenCalledWith({
      roundId: "r-1",
      actor: { userId: "u-comm", isAdmin: false },
      name: "Derby",
      startDate: undefined,
      endDate: undefined,
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "league.round.update", entityId: "r-1" }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it.each([
    ["round_not_found", 404],
    ["forbidden", 403],
    ["invalid_dates", 400],
  ])("traduit %s en %i", async (code, status) => {
    mockUpdate.mockRejectedValue(new LeagueRoundAdminError(code as "forbidden", "refus"));
    const res = makeRes();
    await handleUpdateLeagueRound(makeReq({ body: { name: "X" } }), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(mockAudit).not.toHaveBeenCalled();
  });
});

describe("handleDeleteLeagueRound", () => {
  it("supprime, journalise et renvoie le décompte", async () => {
    mockDelete.mockResolvedValue({
      deleted: true,
      roundId: "r-1",
      seasonId: "s-1",
      roundNumber: 3,
      name: null,
      pairingsRemoved: 2,
      draftSheetsRemoved: 0,
      predictionsRemoved: 1,
    });
    const res = makeRes();
    await handleDeleteLeagueRound(makeReq(), res);
    expect(mockDelete).toHaveBeenCalledWith({
      roundId: "r-1",
      actor: { userId: "u-comm", isAdmin: false },
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "league.round.delete", entity: "LeagueRound" }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ pairingsRemoved: 2 }),
      }),
    );
  });

  it.each([
    "season_completed",
    "playoff_round",
    "pairing_engaged",
    "match_linked",
    "match_scored",
    "sheet_submitted",
  ])("refus %s ⇒ 409 avec son code", async (code) => {
    mockDelete.mockRejectedValue(
      new LeagueRoundAdminError(code as "playoff_round", "Suppression impossible"),
    );
    const res = makeRes();
    await handleDeleteLeagueRound(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Suppression impossible",
      code,
    });
  });

  it("404 pour une journée introuvable ou une ligue privée cachée", async () => {
    mockDelete.mockRejectedValue(
      new LeagueRoundAdminError("round_not_found", "Journee introuvable"),
    );
    const res = makeRes();
    await handleDeleteLeagueRound(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("500 sur une erreur inattendue", async () => {
    mockDelete.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await handleDeleteLeagueRound(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("handleDeleteLeagueSeason", () => {
  const seasonReq = (overrides: Partial<AuthenticatedRequest> = {}) =>
    makeReq({ params: { seasonId: "s-1" }, ...overrides });

  it("401 sans utilisateur", async () => {
    const res = makeRes();
    await handleDeleteLeagueSeason(seasonReq({ user: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDeleteSeason).not.toHaveBeenCalled();
  });

  it("transmet l'acteur (admin reconnu par son rôle), journalise, 200", async () => {
    mockDeleteSeason.mockResolvedValue({
      deleted: true,
      seasonId: "s-1",
      leagueId: "lg-1",
      name: "Saison 2027",
      seasonNumber: 2,
      participantsRemoved: 4,
      invitationsCancelled: 0,
      notified: 3,
    });
    const res = makeRes();
    await handleDeleteLeagueSeason(
      seasonReq({ user: { id: "u-admin", roles: ["admin"] } as never }),
      res,
    );
    expect(mockDeleteSeason).toHaveBeenCalledWith({
      seasonId: "s-1",
      actor: { userId: "u-admin", isAdmin: true },
    });
    expect(mockAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        action: "league.season.delete",
        entity: "LeagueSeason",
        entityId: "s-1",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("ligue privée cachée / saison inconnue ⇒ 404", async () => {
    mockDeleteSeason.mockRejectedValue(
      new LeagueSeasonDeletionError("season_not_found", "Saison introuvable"),
    );
    const res = makeRes();
    await handleDeleteLeagueSeason(seasonReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Saison introuvable",
    });
  });

  it("ni commissaire ni admin ⇒ 403", async () => {
    mockDeleteSeason.mockRejectedValue(
      new LeagueSeasonDeletionError("forbidden", "Seul le commissaire"),
    );
    const res = makeRes();
    await handleDeleteLeagueSeason(seasonReq(), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each([
    "sheets_validated",
    "results_recorded",
    "matches_scored",
    "post_match_sequences",
  ])("saison jouée (%s) ⇒ 409 avec son code", async (code) => {
    mockDeleteSeason.mockRejectedValue(
      new LeagueSeasonDeletionError(code as "sheets_validated", "Suppression impossible : cloturez-la"),
    );
    const res = makeRes();
    await handleDeleteLeagueSeason(seasonReq(), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Suppression impossible : cloturez-la",
      code,
    });
    expect(mockAudit).not.toHaveBeenCalled();
  });
});
