/**
 * Lot A — Tests du service `league-invitation`.
 *
 * Mock `prisma` + le sous-service `addParticipant` (de `./league`)
 * pour ne pas tester deux fois la logique d'inscription.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn() },
    leagueSeason: { findUnique: vi.fn(), findMany: vi.fn() },
    leagueInvitation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    team: { findUnique: vi.fn() },
  },
}));

vi.mock("./league", () => ({
  addParticipant: vi.fn(),
}));

vi.mock("./league-invitation-notify", () => ({
  notifyInvitedCoach: vi.fn(),
}));

import { prisma } from "../prisma";
import {
  createInvitation,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
  expireOldInvitations,
  generateInvitationCode,
  LeagueInvitationError,
} from "./league-invitation";
import { addParticipant } from "./league";
import { notifyInvitedCoach } from "./league-invitation-notify";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockAddParticipant = addParticipant as ReturnType<typeof vi.fn>;
const mockNotifyInvitedCoach = notifyInvitedCoach as ReturnType<typeof vi.fn>;

describe("Lot A — league-invitation service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Défaut : la ligue a UNE saison ouverte aux inscriptions. Permet aux
    // tests d'invitation league-wide (sans seasonId) de passer le garde-fou
    // "no_open_season" et l'auto-résolution. Surchargé dans les tests dédiés.
    mockPrisma.leagueSeason.findMany.mockResolvedValue([
      { id: "s-default", name: "Saison 1", seasonNumber: 1, status: "draft" },
    ]);
  });

  describe("generateInvitationCode", () => {
    it("produces a URL-safe code of ~22 chars", () => {
      const code = generateInvitationCode();
      expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(code.length).toBeGreaterThanOrEqual(20);
      expect(code.length).toBeLessThanOrEqual(24);
    });

    it("produces unique codes", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        codes.add(generateInvitationCode());
      }
      expect(codes.size).toBe(50);
    });
  });

  describe("createInvitation", () => {
    const baseInput = {
      leagueId: "league-1",
      inviterUserId: "commissioner-1",
    };

    it("rejects if league not found", async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null);
      await expect(createInvitation(baseInput)).rejects.toMatchObject({
        code: "league_not_found",
      });
    });

    it("rejects if season does not belong to the league", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
      });
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "season-1",
        leagueId: "league-2",
        status: "draft",
      });
      await expect(
        createInvitation({ ...baseInput, seasonId: "season-1" }),
      ).rejects.toMatchObject({ code: "season_not_found" });
    });

    it("rejects if season is completed", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
      });
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "season-1",
        leagueId: "league-1",
        status: "completed",
      });
      await expect(
        createInvitation({ ...baseInput, seasonId: "season-1" }),
      ).rejects.toMatchObject({ code: "season_closed" });
    });

    it("blocks a league-wide invitation when the league has no open season", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "draft",
        name: "Skaven Cup",
      });
      mockPrisma.leagueSeason.findMany.mockResolvedValue([]); // aucune ouverte
      await expect(
        createInvitation({ ...baseInput, inviteeUserId: "user-2" }),
      ).rejects.toMatchObject({ code: "no_open_season" });
      expect(mockPrisma.leagueInvitation.create).not.toHaveBeenCalled();
    });

    it("creates an invitation with default 14d expiry", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
        name: "Skaven Cup",
      });
      mockPrisma.leagueInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.leagueInvitation.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "inv-1",
          ...args.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      const before = Date.now();
      const inv = await createInvitation({
        ...baseInput,
        inviteeUserId: "user-2",
      });
      const after = Date.now();
      expect(inv.status).toBe("pending");
      expect(inv.code).toMatch(/^[A-Za-z0-9_-]+$/);
      const expiresAt = (inv as { expiresAt: Date }).expiresAt.getTime();
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThanOrEqual(before + fourteenDays - 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + fourteenDays + 1000);
    });

    it("notifies the invited coach for a new invitation (A2)", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
        name: "Skaven Cup",
      });
      mockPrisma.leagueInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.leagueInvitation.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "inv-1",
          ...args.data,
        }),
      );

      await createInvitation({ ...baseInput, inviteeUserId: "user-2" });

      expect(mockNotifyInvitedCoach).toHaveBeenCalledTimes(1);
      const [arg] = mockNotifyInvitedCoach.mock.calls[0];
      expect(arg.leagueName).toBe("Skaven Cup");
      expect(arg.invitation).toMatchObject({ inviteeUserId: "user-2" });
    });

    it("returns existing pending invitation (idempotence)", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
        name: "Skaven Cup",
      });
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockPrisma.leagueInvitation.findFirst.mockResolvedValue({
        id: "existing-inv",
        status: "pending",
        expiresAt: futureExpiry,
      });
      const inv = await createInvitation({
        ...baseInput,
        inviteeUserId: "user-2",
      });
      expect(inv).toMatchObject({ id: "existing-inv" });
      expect(mockPrisma.leagueInvitation.create).not.toHaveBeenCalled();
      // Déduplication : ne renotifie PAS une invitation déjà émise.
      expect(mockNotifyInvitedCoach).not.toHaveBeenCalled();
    });

    it("still resolves when notifyInvitedCoach throws", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
        name: "Skaven Cup",
      });
      mockPrisma.leagueInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.leagueInvitation.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "inv-1",
          ...args.data,
        }),
      );
      mockNotifyInvitedCoach.mockRejectedValue(new Error("notify boom"));

      const inv = await createInvitation({
        ...baseInput,
        inviteeUserId: "user-2",
      });
      expect(inv).toMatchObject({ id: "inv-1" });
    });

    it("creates new invitation if previous expired", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
        name: "Skaven Cup",
      });
      const pastExpiry = new Date(Date.now() - 1000);
      mockPrisma.leagueInvitation.findFirst.mockResolvedValue({
        id: "existing-inv",
        status: "pending",
        expiresAt: pastExpiry,
      });
      mockPrisma.leagueInvitation.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          id: "new-inv",
          ...args.data,
        }),
      );
      const inv = await createInvitation({
        ...baseInput,
        inviteeUserId: "user-2",
      });
      expect(inv).toMatchObject({ id: "new-inv" });
    });

    it("clamps expiresInDays to [1, 90]", async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        id: "league-1",
        status: "open",
        name: "Skaven Cup",
      });
      mockPrisma.leagueInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.leagueInvitation.create.mockImplementation(
        async (args: { data: Record<string, unknown> }) => ({
          ...args.data,
        }),
      );
      const before = Date.now();
      const inv = await createInvitation({
        ...baseInput,
        inviteeUserId: "user-2",
        expiresInDays: 1000,
      });
      const expiresAt = (inv as { expiresAt: Date }).expiresAt.getTime();
      const ninetyDays = 90 * 24 * 60 * 60 * 1000;
      expect(expiresAt).toBeLessThanOrEqual(before + ninetyDays + 2000);
    });
  });

  describe("acceptInvitation", () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

    it("rejects if invitation not found", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue(null);
      await expect(
        acceptInvitation({ code: "x", userId: "u1", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "invitation_not_found" });
    });

    it("rejects if already accepted", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "accepted",
        expiresAt: futureDate,
      });
      await expect(
        acceptInvitation({ code: "x", userId: "u1", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "invitation_already_consumed" });
    });

    it("rejects if expired and marks expired", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        expiresAt: new Date(Date.now() - 1000),
      });
      mockPrisma.leagueInvitation.update.mockResolvedValue({ id: "i1" });
      await expect(
        acceptInvitation({ code: "x", userId: "u1", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "invitation_expired" });
      expect(mockPrisma.leagueInvitation.update).toHaveBeenCalledWith({
        where: { id: "i1" },
        data: { status: "expired" },
      });
    });

    it("rejects if inviteeUserId mismatches", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviteeUserId: "user-A",
        seasonId: "s1",
        expiresAt: futureDate,
      });
      await expect(
        acceptInvitation({ code: "x", userId: "user-B", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "invitation_not_for_user" });
    });

    // Auto-résolution de la saison pour une invitation league-wide (sans
    // seasonId) : dépend du nombre de saisons ouvertes de la ligue.
    it("league-wide: rejects with no_open_season when league has 0 open season", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        leagueId: "league-1",
        status: "pending",
        inviteeUserId: null,
        seasonId: null,
        expiresAt: futureDate,
      });
      mockPrisma.leagueSeason.findMany.mockResolvedValue([]); // aucune ouverte
      await expect(
        acceptInvitation({ code: "x", userId: "u1", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "no_open_season" });
      expect(mockAddParticipant).not.toHaveBeenCalled();
    });

    it("league-wide: auto-resolves the single open season", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        leagueId: "league-1",
        status: "pending",
        inviteeUserId: null,
        seasonId: null,
        expiresAt: futureDate,
      });
      mockPrisma.leagueSeason.findMany.mockResolvedValue([
        { id: "only-season", name: "S1", seasonNumber: 1, status: "draft" },
      ]);
      mockPrisma.team.findUnique.mockResolvedValue({ id: "t1", ownerId: "u1" });
      mockAddParticipant.mockResolvedValue({ id: "part-auto" });
      mockPrisma.leagueInvitation.update.mockResolvedValue({
        id: "i1",
        status: "accepted",
      });
      await acceptInvitation({ code: "x", userId: "u1", teamId: "t1" });
      expect(mockAddParticipant).toHaveBeenCalledWith({
        seasonId: "only-season",
        teamId: "t1",
      });
    });

    it("league-wide: requires a choice when several seasons are open", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        leagueId: "league-1",
        status: "pending",
        inviteeUserId: null,
        seasonId: null,
        expiresAt: futureDate,
      });
      mockPrisma.leagueSeason.findMany.mockResolvedValue([
        { id: "s1", name: "S1", seasonNumber: 1, status: "draft" },
        { id: "s2", name: "S2", seasonNumber: 2, status: "draft" },
      ]);
      await expect(
        acceptInvitation({ code: "x", userId: "u1", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "season_choice_required" });
      expect(mockAddParticipant).not.toHaveBeenCalled();
    });

    it("rejects an input.seasonId that does not belong to the invitation league", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        leagueId: "league-1",
        status: "pending",
        inviteeUserId: null,
        seasonId: null,
        expiresAt: futureDate,
      });
      // La saison choisie appartient à une AUTRE ligue → refus.
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        leagueId: "league-2",
      });
      await expect(
        acceptInvitation({
          code: "x",
          userId: "u1",
          teamId: "t1",
          seasonId: "foreign-season",
        }),
      ).rejects.toMatchObject({ code: "season_not_found" });
      expect(mockAddParticipant).not.toHaveBeenCalled();
    });

    it("rejects if team not owned by user", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviteeUserId: "u1",
        seasonId: "s1",
        expiresAt: futureDate,
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: "t1",
        ownerId: "other-user",
      });
      await expect(
        acceptInvitation({ code: "x", userId: "u1", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "team_not_owned_by_user" });
    });

    it("calls addParticipant on success and marks accepted", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviteeUserId: "u1",
        seasonId: "s1",
        expiresAt: futureDate,
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: "t1",
        ownerId: "u1",
      });
      mockAddParticipant.mockResolvedValue({ id: "part-1" });
      mockPrisma.leagueInvitation.update.mockResolvedValue({
        id: "i1",
        status: "accepted",
      });

      const out = await acceptInvitation({
        code: "x",
        userId: "u1",
        teamId: "t1",
      });
      expect(mockAddParticipant).toHaveBeenCalledWith({
        seasonId: "s1",
        teamId: "t1",
      });
      expect(out.invitation).toMatchObject({ status: "accepted" });
      expect(out.participant).toMatchObject({ id: "part-1" });
    });

    it("falls back to input.seasonId when invitation has no seasonId", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        leagueId: "league-1",
        status: "pending",
        inviteeUserId: null,
        seasonId: null,
        expiresAt: futureDate,
      });
      // La saison explicite appartient bien à la ligue de l'invitation.
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        leagueId: "league-1",
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: "t1",
        ownerId: "u1",
      });
      mockAddParticipant.mockResolvedValue({ id: "part-2" });
      mockPrisma.leagueInvitation.update.mockResolvedValue({
        id: "i1",
        status: "accepted",
      });
      await acceptInvitation({
        code: "x",
        userId: "u1",
        teamId: "t1",
        seasonId: "explicit-season",
      });
      expect(mockAddParticipant).toHaveBeenCalledWith({
        seasonId: "explicit-season",
        teamId: "t1",
      });
    });

    it("maps addParticipant 'deja inscrit' to team_already_registered", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviteeUserId: "u1",
        seasonId: "s1",
        expiresAt: futureDate,
      });
      mockPrisma.team.findUnique.mockResolvedValue({
        id: "t1",
        ownerId: "u1",
      });
      mockAddParticipant.mockRejectedValue(new Error("deja inscrit"));
      await expect(
        acceptInvitation({ code: "x", userId: "u1", teamId: "t1" }),
      ).rejects.toMatchObject({ code: "team_already_registered" });
    });
  });

  describe("declineInvitation", () => {
    it("transitions pending to declined", async () => {
      const futureDate = new Date(Date.now() + 1000);
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviteeUserId: "u1",
        expiresAt: futureDate,
      });
      mockPrisma.leagueInvitation.update.mockResolvedValue({
        id: "i1",
        status: "declined",
      });
      const out = await declineInvitation({ code: "x", userId: "u1" });
      expect(out).toMatchObject({ status: "declined" });
    });

    it("rejects if not for user", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviteeUserId: "user-A",
      });
      await expect(
        declineInvitation({ code: "x", userId: "user-B" }),
      ).rejects.toMatchObject({ code: "invitation_not_for_user" });
    });
  });

  describe("cancelInvitation", () => {
    it("allows inviter to cancel", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviterUserId: "commish-1",
      });
      mockPrisma.leagueInvitation.update.mockResolvedValue({
        id: "i1",
        status: "cancelled",
      });
      const out = await cancelInvitation({
        invitationId: "i1",
        byUserId: "commish-1",
      });
      expect(out).toMatchObject({ status: "cancelled" });
    });

    it("forbids non-inviter non-admin", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviterUserId: "commish-1",
      });
      await expect(
        cancelInvitation({ invitationId: "i1", byUserId: "stranger" }),
      ).rejects.toMatchObject({ code: "forbidden" });
    });

    it("allows admin override", async () => {
      mockPrisma.leagueInvitation.findUnique.mockResolvedValue({
        id: "i1",
        status: "pending",
        inviterUserId: "commish-1",
      });
      mockPrisma.leagueInvitation.update.mockResolvedValue({
        id: "i1",
        status: "cancelled",
      });
      await expect(
        cancelInvitation({
          invitationId: "i1",
          byUserId: "admin-x",
          isAdmin: true,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("expireOldInvitations", () => {
    it("calls updateMany with the correct filter", async () => {
      mockPrisma.leagueInvitation.updateMany.mockResolvedValue({ count: 3 });
      const fixedNow = new Date("2026-01-01T00:00:00Z");
      const out = await expireOldInvitations(fixedNow);
      expect(out).toEqual({ expired: 3 });
      expect(mockPrisma.leagueInvitation.updateMany).toHaveBeenCalledWith({
        where: { status: "pending", expiresAt: { lte: fixedNow } },
        data: { status: "expired" },
      });
    });
  });

  describe("LeagueInvitationError", () => {
    it("is an Error subclass with code", () => {
      const e = new LeagueInvitationError("forbidden", "nope");
      expect(e).toBeInstanceOf(Error);
      expect(e.name).toBe("LeagueInvitationError");
      expect(e.code).toBe("forbidden");
    });
  });
});
