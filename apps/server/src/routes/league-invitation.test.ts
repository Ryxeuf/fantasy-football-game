/**
 * Lot A — Tests des handlers de route pour les invitations.
 *
 * Mocke le service `league-invitation` + `user-lookup` + `prisma` ;
 * verifie le bon mapping des erreurs typees vers les status HTTP
 * et le bon enchainement permission/service.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../services/league-invitation", () => {
  class LeagueInvitationError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "LeagueInvitationError";
    }
  }
  return {
    createInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    declineInvitation: vi.fn(),
    cancelInvitation: vi.fn(),
    listInvitationsForLeague: vi.fn(),
    listPendingInvitationsForUser: vi.fn(),
    getInvitationByCode: vi.fn(),
    LeagueInvitationError,
  };
});

vi.mock("../services/user-lookup", () => ({
  searchUsersByCoachName: vi.fn(),
}));

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueParticipant: { findMany: vi.fn() },
  },
}));

import leagueInvitationRouter, {
  handleCreateInvitation,
  handleAcceptInvitation,
  handleDeclineInvitation,
  handleCancelInvitation,
  handleListInvitations,
  handleListMyInvitations,
  handleGetInvitationByCode,
  handleSearchCoaches,
} from "./league-invitation";
import {
  createInvitation,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  listInvitationsForLeague,
  listPendingInvitationsForUser,
  getInvitationByCode,
} from "../services/league-invitation";
import { searchUsersByCoachName } from "../services/user-lookup";
import { prisma } from "../prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSvc = {
  createInvitation: createInvitation as ReturnType<typeof vi.fn>,
  acceptInvitation: acceptInvitation as ReturnType<typeof vi.fn>,
  declineInvitation: declineInvitation as ReturnType<typeof vi.fn>,
  cancelInvitation: cancelInvitation as ReturnType<typeof vi.fn>,
  listInvitationsForLeague: listInvitationsForLeague as ReturnType<typeof vi.fn>,
  listPendingInvitationsForUser: listPendingInvitationsForUser as ReturnType<typeof vi.fn>,
  getInvitationByCode: getInvitationByCode as ReturnType<typeof vi.fn>,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSearch = searchUsersByCoachName as ReturnType<typeof vi.fn>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

function createRes() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {};
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((p: unknown) => {
    res.payload = p;
    return res;
  });
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createReq(overrides: any = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    user: { id: "user-1", roles: ["user"] },
    // Express expose `req.get(header)` ; le handler s'en sert pour dériver
    // l'origine web (lien d'invitation). Mock par défaut : pas de header.
    get: (_name: string) => undefined,
    ...overrides,
  };
}

describe("Lot A — routes league-invitation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("handleCreateInvitation", () => {
    it("returns 404 when league not found", async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null);
      const req = createReq({
        params: { leagueId: "league-X" },
        body: { inviteeUserId: "coach-2" },
      });
      const res = createRes();
      await handleCreateInvitation(req, res);
      expect(res.statusCode).toBe(404);
      expect(mockSvc.createInvitation).not.toHaveBeenCalled();
    });

    it("returns 403 when user is not creator nor admin", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        creatorId: "other-user",
      });
      const req = createReq({
        params: { leagueId: "league-1" },
        body: { inviteeUserId: "coach-2" },
      });
      const res = createRes();
      await handleCreateInvitation(req, res);
      expect(res.statusCode).toBe(403);
    });

    it("creates invitation for the league creator", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        creatorId: "user-1",
      });
      mockSvc.createInvitation.mockResolvedValue({
        id: "inv-1",
        code: "abc",
        status: "pending",
      });
      const req = createReq({
        params: { leagueId: "league-1" },
        body: {
          inviteeUserId: "coach-2",
          message: "Hello",
          expiresInDays: 7,
        },
      });
      const res = createRes();
      await handleCreateInvitation(req, res);
      expect(res.statusCode).toBe(201);
      expect(mockSvc.createInvitation).toHaveBeenCalledWith(
        expect.objectContaining({
          leagueId: "league-1",
          inviterUserId: "user-1",
          inviteeUserId: "coach-2",
          message: "Hello",
        }),
      );
    });

    it("maps season_not_found to 404", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        creatorId: "user-1",
      });
      const { LeagueInvitationError } = await import(
        "../services/league-invitation"
      );
      mockSvc.createInvitation.mockRejectedValue(
        new LeagueInvitationError("season_not_found", "nope"),
      );
      const req = createReq({
        params: { leagueId: "league-1" },
        body: { seasonId: "x" },
      });
      const res = createRes();
      await handleCreateInvitation(req, res);
      expect(res.statusCode).toBe(404);
    });

    it("maps season_closed to 409", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        creatorId: "user-1",
      });
      const { LeagueInvitationError } = await import(
        "../services/league-invitation"
      );
      mockSvc.createInvitation.mockRejectedValue(
        new LeagueInvitationError("season_closed", "fermee"),
      );
      const req = createReq({
        params: { leagueId: "league-1" },
        body: { inviteeUserId: "coach-2" },
      });
      const res = createRes();
      await handleCreateInvitation(req, res);
      expect(res.statusCode).toBe(409);
    });

    it("maps no_open_season to 409 (league-wide invite without open season)", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        creatorId: "user-1",
      });
      const { LeagueInvitationError } = await import(
        "../services/league-invitation"
      );
      mockSvc.createInvitation.mockRejectedValue(
        new LeagueInvitationError("no_open_season", "pas de saison"),
      );
      const req = createReq({
        params: { leagueId: "league-1" },
        body: { inviteeUserId: "coach-2" },
      });
      const res = createRes();
      await handleCreateInvitation(req, res);
      expect(res.statusCode).toBe(409);
    });
  });

  describe("handleAcceptInvitation", () => {
    it("returns 401 when not authenticated", async () => {
      const req = createReq({ user: undefined });
      const res = createRes();
      await handleAcceptInvitation(req, res);
      expect(res.statusCode).toBe(401);
    });

    it("returns 200 on success", async () => {
      mockSvc.acceptInvitation.mockResolvedValue({
        invitation: { id: "i1", status: "accepted" },
        participant: { id: "p1" },
      });
      const req = createReq({
        params: { code: "abc" },
        body: { teamId: "team-1" },
      });
      const res = createRes();
      await handleAcceptInvitation(req, res);
      expect(res.statusCode).toBe(200);
      expect(mockSvc.acceptInvitation).toHaveBeenCalledWith({
        code: "abc",
        userId: "user-1",
        teamId: "team-1",
        seasonId: undefined,
      });
    });

    it("maps invitation_expired to 409", async () => {
      const { LeagueInvitationError } = await import(
        "../services/league-invitation"
      );
      mockSvc.acceptInvitation.mockRejectedValue(
        new LeagueInvitationError("invitation_expired", "expired"),
      );
      const req = createReq({
        params: { code: "abc" },
        body: { teamId: "t" },
      });
      const res = createRes();
      await handleAcceptInvitation(req, res);
      expect(res.statusCode).toBe(409);
    });

    it("maps team_not_owned_by_user to 403", async () => {
      const { LeagueInvitationError } = await import(
        "../services/league-invitation"
      );
      mockSvc.acceptInvitation.mockRejectedValue(
        new LeagueInvitationError("team_not_owned_by_user", "not yours"),
      );
      const req = createReq({
        params: { code: "abc" },
        body: { teamId: "t" },
      });
      const res = createRes();
      await handleAcceptInvitation(req, res);
      expect(res.statusCode).toBe(403);
    });

    it("maps no_open_season to 409 (league-wide accept, no open season)", async () => {
      const { LeagueInvitationError } = await import(
        "../services/league-invitation"
      );
      mockSvc.acceptInvitation.mockRejectedValue(
        new LeagueInvitationError("no_open_season", "pas de saison"),
      );
      const req = createReq({ params: { code: "abc" }, body: { teamId: "t" } });
      const res = createRes();
      await handleAcceptInvitation(req, res);
      expect(res.statusCode).toBe(409);
    });

    it("maps season_choice_required to 400 (several open seasons)", async () => {
      const { LeagueInvitationError } = await import(
        "../services/league-invitation"
      );
      mockSvc.acceptInvitation.mockRejectedValue(
        new LeagueInvitationError("season_choice_required", "choisis"),
      );
      const req = createReq({ params: { code: "abc" }, body: { teamId: "t" } });
      const res = createRes();
      await handleAcceptInvitation(req, res);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("handleDeclineInvitation", () => {
    it("calls service and returns 200", async () => {
      mockSvc.declineInvitation.mockResolvedValue({
        id: "i1",
        status: "declined",
      });
      const req = createReq({ params: { code: "abc" } });
      const res = createRes();
      await handleDeclineInvitation(req, res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("handleCancelInvitation", () => {
    it("propagates isAdmin from req.user.roles", async () => {
      mockSvc.cancelInvitation.mockResolvedValue({
        id: "i1",
        status: "cancelled",
      });
      const req = createReq({
        params: { invitationId: "i1" },
        user: { id: "admin-x", roles: ["user", "admin"] },
      });
      const res = createRes();
      await handleCancelInvitation(req, res);
      expect(mockSvc.cancelInvitation).toHaveBeenCalledWith({
        invitationId: "i1",
        byUserId: "admin-x",
        isAdmin: true,
      });
    });
  });

  describe("handleListInvitations", () => {
    it("requires commissioner", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        creatorId: "someone-else",
      });
      const req = createReq({ params: { leagueId: "league-1" } });
      const res = createRes();
      await handleListInvitations(req, res);
      expect(res.statusCode).toBe(403);
    });

    it("returns invitations for the commissioner", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        creatorId: "user-1",
      });
      mockSvc.listInvitationsForLeague.mockResolvedValue([
        { id: "i1" },
        { id: "i2" },
      ]);
      const req = createReq({ params: { leagueId: "league-1" } });
      const res = createRes();
      await handleListInvitations(req, res);
      expect(res.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = res.payload as any;
      expect(payload.data.invitations).toHaveLength(2);
    });
  });

  describe("handleListMyInvitations", () => {
    it("returns 401 when not authenticated", async () => {
      const req = createReq({ user: undefined });
      const res = createRes();
      await handleListMyInvitations(req, res);
      expect(res.statusCode).toBe(401);
    });

    it("calls listPendingInvitationsForUser", async () => {
      mockSvc.listPendingInvitationsForUser.mockResolvedValue([{ id: "i1" }]);
      const req = createReq();
      const res = createRes();
      await handleListMyInvitations(req, res);
      expect(mockSvc.listPendingInvitationsForUser).toHaveBeenCalledWith(
        "user-1",
      );
      expect(res.statusCode).toBe(200);
    });
  });

  describe("handleGetInvitationByCode", () => {
    it("returns 404 when not found", async () => {
      mockSvc.getInvitationByCode.mockResolvedValue(null);
      const req = createReq({ params: { code: "abc" } });
      const res = createRes();
      await handleGetInvitationByCode(req, res);
      expect(res.statusCode).toBe(404);
    });

    it("returns invitation when found", async () => {
      mockSvc.getInvitationByCode.mockResolvedValue({ id: "i1" });
      const req = createReq({ params: { code: "abc" } });
      const res = createRes();
      await handleGetInvitationByCode(req, res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("handleSearchCoaches", () => {
    it("returns coaches with alreadyInSeason=false by default", async () => {
      mockSearch.mockResolvedValue([
        { id: "u2", coachName: "Bob" },
        { id: "u3", coachName: "Carl" },
      ]);
      const req = createReq({ query: { q: "ob" } });
      const res = createRes();
      await handleSearchCoaches(req, res);
      expect(res.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = res.payload as any;
      expect(payload.data.coaches).toHaveLength(2);
      expect(payload.data.coaches[0]).toMatchObject({
        id: "u2",
        coachName: "Bob",
        alreadyInSeason: false,
      });
    });

    it("flags alreadyInSeason=true when seasonId filter matches", async () => {
      mockSearch.mockResolvedValue([
        { id: "u2", coachName: "Bob" },
        { id: "u3", coachName: "Carl" },
      ]);
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { team: { ownerId: "u3" } },
      ]);
      const req = createReq({ query: { q: "x", seasonId: "season-1" } });
      const res = createRes();
      await handleSearchCoaches(req, res);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = res.payload as any;
      const carl = payload.data.coaches.find(
        (c: { id: string }) => c.id === "u3",
      );
      expect(carl.alreadyInSeason).toBe(true);
    });
  });

  // Non-régression : `/me/invitations` était capturé par la route
  // paramétrique `/:leagueId/invitations` (leagueId="me") → 404 "Ligue
  // introuvable". La route littérale DOIT être enregistrée avant la
  // paramétrique. On vérifie l'ordre dans la stack Express.
  describe("route ordering (anti-shadowing)", () => {
    function getRoutes() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (leagueInvitationRouter as any).stack
        .filter((l: { route?: unknown }) => l.route)
        .map((l: { route: { path: string; methods: Record<string, boolean> } }) => ({
          path: l.route.path,
          methods: l.route.methods,
        }));
    }

    it("registers GET /me/invitations before GET /:leagueId/invitations", () => {
      const routes = getRoutes();
      const idxMe = routes.findIndex(
        (r: { path: string; methods: Record<string, boolean> }) =>
          r.path === "/me/invitations" && r.methods.get,
      );
      const idxParam = routes.findIndex(
        (r: { path: string; methods: Record<string, boolean> }) =>
          r.path === "/:leagueId/invitations" && r.methods.get,
      );
      expect(idxMe).toBeGreaterThanOrEqual(0);
      expect(idxParam).toBeGreaterThanOrEqual(0);
      expect(idxMe).toBeLessThan(idxParam);
    });
  });
});
