/**
 * Lot G — Tests du service `league-match-sheet` (machine a etats +
 * autorisation). Mocke prisma ; le summarizer pur est reutilise tel quel.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leaguePairing: { findUnique: vi.fn() },
    leagueMatchSheet: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueMatchEvent: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  createMatchSheet,
  addEvent,
  removeEvent,
  submitByCoach,
  unsubmitByCoach,
  validateByCommissioner,
  getMatchSheet,
  MatchSheetError,
} from "./league-match-sheet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

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

    it("away submit when home already submitted -> both_submitted", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "submitted_home",
        submittedByHomeAt: new Date(),
        submittedByAwayAt: null,
      });
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await submitByCoach({ pairingId: "pair-1", userId: AWAY });
      expect((out as { status: string }).status).toBe("both_submitted");
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

    it("freezes derived score from events", async () => {
      mockPrisma.leagueMatchSheet.findUnique.mockResolvedValue({
        id: "ms1",
        status: "both_submitted",
      });
      mockPrisma.leagueMatchEvent.findMany.mockResolvedValue([
        { kind: "touchdown", team: "home", actorPlayerId: "h1" },
        { kind: "touchdown", team: "home", actorPlayerId: "h1" },
        { kind: "touchdown", team: "away", actorPlayerId: "a1" },
      ]);
      mockPrisma.leagueMatchSheet.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "ms1", ...a.data }),
      );
      const out = await validateByCommissioner({
        pairingId: "pair-1",
        userId: COMMISH,
      });
      expect(out.summary.scoreHome).toBe(2);
      expect(out.summary.scoreAway).toBe(1);
      const updateArgs = mockPrisma.leagueMatchSheet.update.mock.calls[0][0];
      expect(updateArgs.data).toMatchObject({
        status: "validated",
        scoreHome: 2,
        scoreAway: 1,
        validatedById: COMMISH,
      });
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

  describe("MatchSheetError", () => {
    it("preserves code", () => {
      const e = new MatchSheetError("forbidden", "x");
      expect(e.code).toBe("forbidden");
      expect(e).toBeInstanceOf(Error);
    });
  });
});
