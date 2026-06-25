/**
 * Lot G — Tests du service `league-match-sheet` (machine a etats +
 * autorisation). Mocke prisma ; le summarizer pur est reutilise tel quel.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: { findUnique: vi.fn(), count: vi.fn() },
    leagueMatchSheet: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueMatchEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    match: { findFirst: vi.fn() },
  },
}));

// Lot G.2 — mock du pipeline offline branche a la validation.
vi.mock("./league-offline-result", () => ({
  recordOfflineLeagueResult: vi.fn(),
}));

// Polish — mock de la reversion (invalidation).
vi.mock("./league-offline-edit", () => ({
  reverseOfflineLeagueResult: vi.fn(),
}));

// Lot H — mock du push commissaire (fire-and-forget).
vi.mock("./push-notifications", () => ({
  sendLeagueMatchValidationPush: vi.fn(),
}));

import { prisma } from "../prisma";
import {
  createMatchSheet,
  addEvent,
  removeEvent,
  updatePreMatch,
  updatePostMatch,
  submitByCoach,
  unsubmitByCoach,
  validateByCommissioner,
  invalidateMatchSheet,
  canInvalidateMatchSheet,
  getMatchSheet,
  buildOfflineInputFromSummary,
  listPendingValidationsForCommissioner,
  MatchSheetError,
} from "./league-match-sheet";
import { recordOfflineLeagueResult } from "./league-offline-result";
import { reverseOfflineLeagueResult } from "./league-offline-edit";
import { sendLeagueMatchValidationPush } from "./push-notifications";
import type { MatchSummary } from "./league-match-summary";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockRecordOffline = recordOfflineLeagueResult as ReturnType<typeof vi.fn>;
const mockReverse = reverseOfflineLeagueResult as ReturnType<typeof vi.fn>;
const mockPush = sendLeagueMatchValidationPush as ReturnType<typeof vi.fn>;

const HOME = "home-owner";
const AWAY = "away-owner";
const COMMISH = "commish";

function mockPairing() {
  mockPrisma.leaguePairing.findUnique.mockResolvedValue({
    id: "pair-1",
    round: { season: { league: { id: "L1", creatorId: COMMISH } } },
    homeParticipant: { team: { ownerId: HOME } },
    awayParticipant: { team: { ownerId: AWAY } },
  });
}

describe("Lot G — league-match-sheet", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPairing();
  });

  describe("createMatchSheet", () => {
    it("rejects a non-participant", async () => {
      await expect(
        createMatchSheet({ pairingId: "pair-1", userId: "stranger" }),
      ).rejects.toMatchObject({ code: "not_a_participant" });
    });

    it("returns existing sheet (idempotent)", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
      });
      const out = await createMatchSheet({ pairingId: "pair-1", userId: HOME });
      expect(out).toMatchObject({ id: "ms1" });
      expect(mockPrisma.leagueMatchSheet.create).not.toHaveBeenCalled();
    });

    it("creates a draft sheet for a coach", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(null);
      mockPrisma.leagueMatchSheet.create.mockResolvedValue({
        id: "ms-new",
        status: "draft",
      });
      const out = await createMatchSheet({ pairingId: "pair-1", userId: AWAY });
      expect(out).toMatchObject({ status: "draft" });
    });

    it("allows the commissioner to open it", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(null);
      mockPrisma.leagueMatchSheet.create.mockResolvedValue({ id: "ms" });
      await expect(
        createMatchSheet({ pairingId: "pair-1", userId: COMMISH }),
      ).resolves.toBeDefined();
    });
  });

  describe("addEvent", () => {
    it("rejects invalid kind", async () => {
      await expect(
        addEvent({
          pairingId: "pair-1",
          userId: HOME,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event: { kind: "nope" as any },
        }),
      ).rejects.toMatchObject({ code: "invalid_event" });
    });

    it("rejects when sheet missing", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue(null);
      await expect(
        addEvent({
          pairingId: "pair-1",
          userId: HOME,
          event: { kind: "touchdown", team: "home" },
        }),
      ).rejects.toMatchObject({ code: "sheet_not_found" });
    });

    it("rejects editing a validated sheet", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "validated",
      });
      await expect(
        addEvent({
          pairingId: "pair-1",
          userId: HOME,
          event: { kind: "touchdown", team: "home" },
        }),
      ).rejects.toMatchObject({ code: "already_validated" });
    });

    it("creates an event for a coach", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
      });
      mockPrisma.leagueMatchEvent.create.mockResolvedValue({ id: "e1" });
      const out = await addEvent({
        pairingId: "pair-1",
        userId: AWAY,
        event: {
          kind: "casualty",
          team: "away",
          actorPlayerId: "a1",
          targetPlayerId: "h2",
          injurySeverity: "dead",
        },
      });
      expect(out).toMatchObject({ id: "e1" });
      const args = mockPrisma.leagueMatchEvent.create.mock.calls[0][0];
      expect(args.data.kind).toBe("casualty");
      expect(args.data.injurySeverity).toBe("dead");
    });
  });

  describe("removeEvent", () => {
    it("rejects event from another sheet", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
      });
      mockPrisma.leagueMatchEvent.findUnique.mockResolvedValue({
        id: "e1",
        matchSheetId: "OTHER",
      });
      await expect(
        removeEvent({ pairingId: "pair-1", userId: HOME, eventId: "e1" }),
      ).rejects.toMatchObject({ code: "event_not_found" });
    });

    it("deletes an event", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
      });
      mockPrisma.leagueMatchEvent.findUnique.mockResolvedValue({
        id: "e1",
        matchSheetId: "ms1",
      });
      mockPrisma.leagueMatchEvent.delete.mockResolvedValue({});
      await expect(
        removeEvent({ pairingId: "pair-1", userId: HOME, eventId: "e1" }),
      ).resolves.toMatchObject({ deleted: true });
    });
  });

  describe("submitByCoach", () => {
    it("rejects a non-coach (commissioner cannot submit)", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
      });
      await expect(
        submitByCoach({ pairingId: "pair-1", userId: COMMISH }),
      ).rejects.toMatchObject({ code: "not_a_participant" });
    });

    it("home submit on draft -> submitted_home", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
        submittedByHomeAt: null,
        submittedByAwayAt: null,
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await submitByCoach({ pairingId: "pair-1", userId: HOME });
      expect((out as { status: string }).status).toBe("submitted_home");
    });

    it("away submit when home already submitted -> both_submitted + notifies commissioner", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "submitted_home",
        submittedByHomeAt: new Date(),
        submittedByAwayAt: null,
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      // notifyCommissionerSheetReady re-reads the pairing for team names.
      mockPrisma.leaguePairing.findUnique.mockResolvedValueOnce({
        id: "pair-1",
        round: { season: { league: { id: "L1", creatorId: COMMISH } } },
        homeParticipant: { team: { ownerId: HOME } },
        awayParticipant: { team: { ownerId: AWAY } },
      });
      mockPrisma.leaguePairing.findUnique.mockResolvedValueOnce({
        homeParticipant: { team: { name: "Reikland" } },
        awayParticipant: { team: { name: "Gouged Eye" } },
      });
      const out = await submitByCoach({ pairingId: "pair-1", userId: AWAY });
      expect((out as { status: string }).status).toBe("both_submitted");
      // fire-and-forget : laisse la microtask s'executer.
      await Promise.resolve();
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          commissionerUserId: COMMISH,
          leagueId: "L1",
          pairingId: "pair-1",
        }),
      );
    });

    it("does not notify when only one coach submitted", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
        submittedByHomeAt: null,
        submittedByAwayAt: null,
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      await submitByCoach({ pairingId: "pair-1", userId: HOME });
      await Promise.resolve();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("unsubmitByCoach", () => {
    it("away unsubmit from both_submitted -> submitted_home", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
        submittedByHomeAt: new Date(),
        submittedByAwayAt: new Date(),
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await unsubmitByCoach({ pairingId: "pair-1", userId: AWAY });
      expect((out as { status: string }).status).toBe("submitted_home");
    });

    it("home unsubmit when alone -> draft", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "submitted_home",
        submittedByHomeAt: new Date(),
        submittedByAwayAt: null,
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await unsubmitByCoach({ pairingId: "pair-1", userId: HOME });
      expect((out as { status: string }).status).toBe("draft");
    });
  });

  describe("validateByCommissioner", () => {
    it("rejects a coach", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
      });
      await expect(
        validateByCommissioner({ pairingId: "pair-1", userId: HOME }),
      ).rejects.toMatchObject({ code: "forbidden" });
    });

    it("freezes derived score from events and applies offline effects", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
        motmPlayerIds: [],
      });
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        { kind: "touchdown", team: "home", actorPlayerId: "h1" },
        { kind: "touchdown", team: "home", actorPlayerId: "h1" },
        { kind: "touchdown", team: "away", actorPlayerId: "a1" },
      ]);
      mockRecordOffline.mockResolvedValue({
        recorded: true,
        pairingId: "pair-1",
        matchId: "m1",
        winner: "home",
        sppPlayersUpdated: 2,
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await validateByCommissioner({
        pairingId: "pair-1",
        userId: COMMISH,
      });
      expect(out.summary.scoreHome).toBe(2);
      expect(out.summary.scoreAway).toBe(1);
      expect(out.effects).toEqual({ applied: true });
      // Le pipeline offline a bien ete appele avec le score derive.
      const offlineArgs = mockRecordOffline.mock.calls[0][0];
      expect(offlineArgs).toMatchObject({
        pairingId: "pair-1",
        scoreHome: 2,
        scoreAway: 1,
      });
      const updateArgs = mockPrisma.leagueMatchSheet.update.mock.calls[0][0];
      expect(updateArgs.data).toMatchObject({
        status: "validated",
        scoreHome: 2,
        scoreAway: 1,
        validatedById: COMMISH,
      });
    });

    it("marks validated even when offline pipeline skips (already scored)", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
        motmPlayerIds: [],
      });
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([]);
      mockRecordOffline.mockResolvedValue({
        skipped: true,
        reason: "match-already-scored",
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await validateByCommissioner({
        pairingId: "pair-1",
        userId: COMMISH,
      });
      expect(out.effects).toEqual({
        applied: false,
        reason: "match-already-scored",
      });
      expect(mockPrisma.leagueMatchSheet.update).toHaveBeenCalled();
    });

    it("does not validate if offline pipeline throws", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
        motmPlayerIds: [],
      });
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([]);
      mockRecordOffline.mockRejectedValue(new Error("boom"));
      await expect(
        validateByCommissioner({ pairingId: "pair-1", userId: COMMISH }),
      ).rejects.toThrow(/boom/);
      expect(mockPrisma.leagueMatchSheet.update).not.toHaveBeenCalled();
    });

    it("rejects double validation", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "validated",
      });
      await expect(
        validateByCommissioner({ pairingId: "pair-1", userId: COMMISH }),
      ).rejects.toMatchObject({ code: "already_validated" });
    });
  });

  describe("getMatchSheet", () => {
    it("returns sheet + summary + viewerRole", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
        events: [{ kind: "touchdown", team: "away", actorPlayerId: "a1" }],
      });
      const out = await getMatchSheet({ pairingId: "pair-1", userId: AWAY });
      expect(out.viewerRole).toBe("away");
      expect(out.summary.scoreAway).toBe(1);
    });

    it("marks commissioner role", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
        events: [],
      });
      const out = await getMatchSheet({ pairingId: "pair-1", userId: COMMISH });
      expect(out.viewerRole).toBe("commissioner");
    });
  });

  // Lot H — liste des matchs a valider pour le commissaire.
  describe("listPendingValidationsForCommissioner", () => {
    it("maps both_submitted sheets to a flat pending list", async () => {
      const homeAt = new Date("2026-06-01T10:00:00Z");
      const awayAt = new Date("2026-06-01T11:00:00Z");
      mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([
        {
          id: "ms1",
          pairingId: "pair-1",
          submittedByHomeAt: homeAt,
          submittedByAwayAt: awayAt,
          pairing: {
            round: {
              roundNumber: 3,
              season: {
                id: "s1",
                name: "Saison 1",
                league: { id: "L1", name: "Ma Ligue" },
              },
            },
            homeParticipant: { team: { name: "Reikland" } },
            awayParticipant: { team: { name: "Gouged Eye" } },
          },
        },
      ]);
      const out = await listPendingValidationsForCommissioner(COMMISH);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        pairingId: "pair-1",
        matchSheetId: "ms1",
        leagueId: "L1",
        leagueName: "Ma Ligue",
        seasonId: "s1",
        roundNumber: 3,
        homeTeamName: "Reikland",
        awayTeamName: "Gouged Eye",
      });
      // bothSubmittedAt = max(home, away)
      expect(out[0].bothSubmittedAt?.toISOString()).toBe(awayAt.toISOString());
      // Filtre Prisma : creatorId du commissaire + status both_submitted.
      const where = mockPrisma.leagueMatchSheet.findMany.mock.calls[0][0].where;
      expect(where.status).toBe("both_submitted");
      expect(where.pairing.round.season.league.creatorId).toBe(COMMISH);
    });

    it("returns empty list when nothing pending", async () => {
      mockPrisma.leagueMatchSheet.findMany.mockResolvedValue([]);
      const out = await listPendingValidationsForCommissioner(COMMISH);
      expect(out).toEqual([]);
    });
  });

  // Polish — pre-match auto-calcule les winnings depuis la popularite.
  describe("updatePreMatch (auto winnings)", () => {
    it("computes winningsHome/Away from popularity", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      await updatePreMatch({
        pairingId: "pair-1",
        userId: HOME,
        payload: { popularityHome: 4, popularityAway: 2 },
      });
      const data = mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data;
      expect(data.winningsHome).toBe(40_000);
      expect(data.winningsAway).toBe(20_000);
    });
  });

  // Polish — apres-match.
  describe("updatePostMatch", () => {
    it("rejects a non-participant", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "draft",
      });
      await expect(
        updatePostMatch({
          pairingId: "pair-1",
          userId: "stranger",
          payload: { winningsHomeManual: 50000 },
        }),
      ).rejects.toMatchObject({ code: "forbidden" });
    });

    it("rejects editing a validated sheet", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "validated",
      });
      await expect(
        updatePostMatch({
          pairingId: "pair-1",
          userId: COMMISH,
          payload: { winningsHomeManual: 50000 },
        }),
      ).rejects.toMatchObject({ code: "already_validated" });
    });

    it("updates winnings override, fans, MVP", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await updatePostMatch({
        pairingId: "pair-1",
        userId: HOME,
        payload: {
          winningsHomeManual: 60000,
          dedicatedFansDeltaHome: 1,
          motmPlayerIds: ["h1", "h2"],
        },
      });
      const data = mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data;
      expect(data).toMatchObject({
        winningsHomeManual: 60000,
        dedicatedFansDeltaHome: 1,
        motmPlayerIds: ["h1", "h2"],
      });
      expect(out).toBeDefined();
    });
  });

  // Polish — fenetre d'invalidation.
  describe("canInvalidateMatchSheet", () => {
    function mockCurrentPairing() {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "pair-1",
        homeParticipantId: "ph",
        awayParticipantId: "pa",
        round: { seasonId: "s1", roundNumber: 3 },
      });
    }

    it("ok when neither team played a later match", async () => {
      mockCurrentPairing();
      mockPrisma.leaguePairing.count.mockResolvedValue(0);
      const out = await canInvalidateMatchSheet({ pairingId: "pair-1" });
      expect(out).toEqual({ ok: true });
    });

    it("ok when only one team played a later match", async () => {
      mockCurrentPairing();
      // home played 1 later, away played 0
      mockPrisma.leaguePairing.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);
      const out = await canInvalidateMatchSheet({ pairingId: "pair-1" });
      expect(out).toEqual({ ok: true });
    });

    it("closed when BOTH teams played a later match", async () => {
      mockCurrentPairing();
      mockPrisma.leaguePairing.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);
      const out = await canInvalidateMatchSheet({ pairingId: "pair-1" });
      expect(out).toEqual({ ok: false, reason: "both_teams_played_later" });
    });
  });

  describe("invalidateMatchSheet", () => {
    it("rejects a coach", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "validated",
      });
      await expect(
        invalidateMatchSheet({ pairingId: "pair-1", userId: HOME }),
      ).rejects.toMatchObject({ code: "forbidden" });
    });

    it("rejects when sheet is not validated", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
      });
      await expect(
        invalidateMatchSheet({ pairingId: "pair-1", userId: COMMISH }),
      ).rejects.toMatchObject({ code: "not_validated" });
    });

    // Forme fusionnee : satisfait loadPairingContext (league/owners)
    // ET canInvalidateMatchSheet (participants/round).
    function mockMergedPairing() {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "pair-1",
        homeParticipantId: "ph",
        awayParticipantId: "pa",
        round: {
          seasonId: "s1",
          roundNumber: 3,
          season: { league: { id: "L1", creatorId: COMMISH } },
        },
        homeParticipant: { team: { ownerId: HOME } },
        awayParticipant: { team: { ownerId: AWAY } },
      });
    }

    it("rejects when the invalidation window is closed", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "validated",
      });
      mockMergedPairing();
      mockPrisma.leaguePairing.count.mockResolvedValue(1); // both teams later
      await expect(
        invalidateMatchSheet({ pairingId: "pair-1", userId: COMMISH }),
      ).rejects.toMatchObject({ code: "invalidation_window_closed" });
    });

    it("reverses the offline match and sets status invalidated", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "validated",
      });
      mockMergedPairing();
      mockPrisma.leaguePairing.count.mockResolvedValue(0); // window open
      mockPrisma.match.findFirst.mockResolvedValue({ id: "m1" });
      mockReverse.mockResolvedValue({
        reversed: true,
        matchId: "m1",
        pairingId: "pair-1",
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await invalidateMatchSheet({
        pairingId: "pair-1",
        userId: COMMISH,
        reason: "erreur de saisie",
      });
      expect(mockReverse).toHaveBeenCalledWith("m1");
      const data = mockPrisma.leagueMatchSheet.update.mock.calls[0][0].data;
      expect(data).toMatchObject({
        status: "invalidated",
        invalidationReason: "erreur de saisie",
      });
      expect(out).toBeDefined();
    });

    it("aborts when reversion is impossible (e.g. a death)", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "validated",
      });
      mockMergedPairing();
      mockPrisma.leaguePairing.count.mockResolvedValue(0);
      mockPrisma.match.findFirst.mockResolvedValue({ id: "m1" });
      mockReverse.mockResolvedValue({ skipped: true, reason: "injury-dead" });
      await expect(
        invalidateMatchSheet({ pairingId: "pair-1", userId: COMMISH }),
      ).rejects.toMatchObject({ code: "invalidation_failed" });
      expect(mockPrisma.leagueMatchSheet.update).not.toHaveBeenCalled();
    });
  });

  describe("MatchSheetError", () => {
    it("preserves code", () => {
      const e = new MatchSheetError("forbidden", "x");
      expect(e.code).toBe("forbidden");
      expect(e).toBeInstanceOf(Error);
    });
  });

  // Lot G.2 — mapping pur summary -> input offline.
  describe("buildOfflineInputFromSummary (Lot G.2)", () => {
    const baseSummary: MatchSummary = {
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 1,
      casualtiesAway: 0,
      injuries: [],
      playerStats: [
        {
          playerId: "h1",
          side: "home",
          touchdowns: 2,
          casualtiesInflicted: 1,
          completions: 0,
          interceptions: 0,
          aggressions: 0,
        },
      ],
    };

    it("maps player stats and flags MVP from motmPlayerIds", () => {
      const out = buildOfflineInputFromSummary(
        "pair-1",
        baseSummary,
        { motmPlayerIds: ["h1"] },
        [],
      );
      expect(out.scoreHome).toBe(2);
      expect(out.casualtiesHome).toBe(1);
      expect(out.playerStats).toEqual([
        {
          teamPlayerId: "h1",
          touchdowns: 2,
          casualties: 1,
          completions: 0,
          interceptions: 0,
          mvp: true,
        },
      ]);
    });

    it("derive le debit treasury (coups de pouce + erreurs couteuses + achats)", () => {
      const out = buildOfflineInputFromSummary(
        "pair-1",
        baseSummary,
        {
          motmPlayerIds: [],
          // home : 2x coup de pouce 50k + erreur couteuse 100k + achat 60k
          inducementsHome: [{ id: "bribe", name: "Pot-de-vin", cost: 50000, qty: 2 }],
          costlyErrorsHome: [{ cost: 100000, reason: "Crise" }],
          purchasesHome: [{ kind: "reroll", name: "Relance", cost: 60000 }],
          // away : string serialisee (sqlite mirror)
          inducementsAway: JSON.stringify([{ name: "Apo", cost: 50000 }]),
        },
        [],
      );
      // home = 50000*2 + 100000 + 60000 = 260000
      expect(out.treasuryDebitHome).toBe(260000);
      expect(out.treasuryDebitAway).toBe(50000);
    });

    it("adds MVP-only players who had no stat line", () => {
      const out = buildOfflineInputFromSummary(
        "pair-1",
        baseSummary,
        { motmPlayerIds: ["h1", "bench9"] },
        [],
      );
      const bench = out.playerStats.find((p) => p.teamPlayerId === "bench9");
      expect(bench).toEqual({ teamPlayerId: "bench9", mvp: true });
    });

    it("maps mng/niggling/dead injuries; skips badly_hurt", () => {
      const summary: MatchSummary = {
        ...baseSummary,
        injuries: [
          { playerId: "a1", severity: "dead", side: "away", cause: "block" },
          { playerId: "a2", severity: "mng", side: "away", cause: "block" },
          { playerId: "a3", severity: "niggling", side: "away", cause: "block" },
          { playerId: "a4", severity: "badly_hurt", side: "away", cause: "block" },
        ],
      };
      const out = buildOfflineInputFromSummary(
        "pair-1",
        summary,
        { motmPlayerIds: [] },
        [],
      );
      expect(out.injuries).toEqual([
        { teamPlayerId: "a1", type: "dead" },
        { teamPlayerId: "a2", type: "mng" },
        { teamPlayerId: "a3", type: "niggling" },
      ]);
    });

    it("maps stat_loss using event meta.stat", () => {
      const summary: MatchSummary = {
        ...baseSummary,
        injuries: [
          { playerId: "a5", severity: "stat_loss", side: "away", cause: "block" },
        ],
      };
      const out = buildOfflineInputFromSummary(
        "pair-1",
        summary,
        { motmPlayerIds: [] },
        [
          {
            kind: "casualty",
            team: "home",
            targetPlayerId: "a5",
            injurySeverity: "stat_loss",
            meta: { stat: "st" },
          },
        ],
      );
      expect(out.injuries).toEqual([{ teamPlayerId: "a5", type: "st" }]);
    });

    it("skips stat_loss when no specific stat is provided", () => {
      const summary: MatchSummary = {
        ...baseSummary,
        injuries: [
          { playerId: "a6", severity: "stat_loss", side: "away", cause: "block" },
        ],
      };
      const out = buildOfflineInputFromSummary(
        "pair-1",
        summary,
        { motmPlayerIds: [] },
        [],
      );
      expect(out.injuries).toEqual([]);
    });

    it("passes manual winnings and fans deltas through", () => {
      const out = buildOfflineInputFromSummary(
        "pair-1",
        baseSummary,
        {
          motmPlayerIds: [],
          winningsHomeManual: 60000,
          winningsAwayManual: 30000,
          dedicatedFansDeltaHome: 1,
          dedicatedFansDeltaAway: -1,
        },
        [],
      );
      expect(out.winningsHome).toBe(60000);
      expect(out.winningsAway).toBe(30000);
      expect(out.dedicatedFansDeltaHome).toBe(1);
      expect(out.dedicatedFansDeltaAway).toBe(-1);
    });

    it("falls back to auto-computed winnings when no manual override", () => {
      const out = buildOfflineInputFromSummary(
        "pair-1",
        baseSummary,
        {
          motmPlayerIds: [],
          // pas d'override -> on prend la valeur auto-calculee.
          winningsHome: 50000,
          winningsAway: 20000,
        },
        [],
      );
      expect(out.winningsHome).toBe(50000);
      expect(out.winningsAway).toBe(20000);
    });

    it("manual override beats the computed value", () => {
      const out = buildOfflineInputFromSummary(
        "pair-1",
        baseSummary,
        {
          motmPlayerIds: [],
          winningsHome: 50000,
          winningsHomeManual: 99000,
        },
        [],
      );
      expect(out.winningsHome).toBe(99000);
    });

    it("parses motmPlayerIds from a serialized JSON string (sqlite)", () => {
      const out = buildOfflineInputFromSummary(
        "pair-1",
        baseSummary,
        { motmPlayerIds: JSON.stringify(["h1"]) },
        [],
      );
      expect(out.playerStats[0].mvp).toBe(true);
    });
  });
});
