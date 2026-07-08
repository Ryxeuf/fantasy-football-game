/**
 * Lot F — Tests du service de creation manuelle de pairings.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    leagueRound: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    leagueParticipant: { findMany: vi.fn() },
    leaguePairing: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  createManualRound,
  createManualPairing,
  deleteManualPairing,
  updateManualPairing,
  LeagueManualPairingError,
} from "./league-manual-pairing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("Lot F — league-manual-pairing service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("createManualRound", () => {
    it("rejects if season not found", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue(null);
      await expect(
        createManualRound({ seasonId: "s-X" }),
      ).rejects.toMatchObject({ code: "season_not_found" });
    });

    it("assigns next roundNumber based on last round", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "in_progress",
      });
      mockPrisma.leagueRound.findFirst.mockResolvedValue({ roundNumber: 5 });
      mockPrisma.leagueRound.create.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "r1", ...a.data }),
      );
      const out = await createManualRound({ seasonId: "s1", name: "Amical" });
      expect(out).toMatchObject({
        roundNumber: 6,
        kind: "regular",
        name: "Amical",
        status: "pending",
      });
    });

    it("starts at 1 if no previous round", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leagueRound.findFirst.mockResolvedValue(null);
      mockPrisma.leagueRound.create.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "r1", ...a.data }),
      );
      const out = await createManualRound({
        seasonId: "s1",
        kind: "playoff",
      });
      expect(out).toMatchObject({ roundNumber: 1, kind: "playoff" });
    });
  });

  describe("createManualPairing", () => {
    it("rejects same participant", async () => {
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p1",
        }),
      ).rejects.toMatchObject({ code: "same_participant" });
    });

    it("rejects if round not found", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue(null);
      await expect(
        createManualPairing({
          roundId: "rX",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).rejects.toMatchObject({ code: "round_not_found" });
    });

    it("rejects if round completed", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "completed",
      });
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).rejects.toMatchObject({ code: "round_completed" });
    });

    it("rejects if participants missing", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "pending",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1", status: "active" },
      ]);
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).rejects.toMatchObject({ code: "participant_not_found" });
    });

    it("rejects if a participant withdrew", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "pending",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1", status: "active" },
        { id: "p2", seasonId: "s1", status: "withdrawn" },
      ]);
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).rejects.toMatchObject({ code: "participant_not_active" });
    });

    it("A54 — rejects participants from different pools", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "pending",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1", status: "active", poolId: "poolA" },
        { id: "p2", seasonId: "s1", status: "active", poolId: "poolB" },
      ]);
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).rejects.toMatchObject({ code: "different_pools" });
    });

    it("A54 — accepts two participants of the same pool", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "pending",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1", status: "active", poolId: "poolA" },
        { id: "p2", seasonId: "s1", status: "active", poolId: "poolA" },
      ]);
      mockPrisma.leaguePairing.findFirst.mockResolvedValue(null);
      mockPrisma.leaguePairing.create.mockResolvedValue({ id: "new" });
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).resolves.toMatchObject({ id: "new" });
    });

    it("rejects if participant not in same season as round", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "pending",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1", status: "active" },
        { id: "p2", seasonId: "s2", status: "active" },
      ]);
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).rejects.toMatchObject({ code: "participant_not_found" });
    });

    it("rejects duplicate pairing in same round (regardless of home/away order)", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "pending",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1", status: "active" },
        { id: "p2", seasonId: "s1", status: "active" },
      ]);
      mockPrisma.leaguePairing.findFirst.mockResolvedValue({ id: "old" });
      await expect(
        createManualPairing({
          roundId: "r1",
          homeParticipantId: "p1",
          awayParticipantId: "p2",
        }),
      ).rejects.toMatchObject({ code: "duplicate_pairing" });
    });

    it("creates pairing on success", async () => {
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r1",
        seasonId: "s1",
        status: "pending",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1", status: "active" },
        { id: "p2", seasonId: "s1", status: "active" },
      ]);
      mockPrisma.leaguePairing.findFirst.mockResolvedValue(null);
      mockPrisma.leaguePairing.create.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "new", ...a.data }),
      );
      const out = await createManualPairing({
        roundId: "r1",
        homeParticipantId: "p1",
        awayParticipantId: "p2",
      });
      expect(out).toMatchObject({
        id: "new",
        status: "scheduled",
        homeParticipantId: "p1",
        awayParticipantId: "p2",
      });
    });
  });

  describe("deleteManualPairing", () => {
    it("rejects when pairing not found", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue(null);
      await expect(
        deleteManualPairing({ pairingId: "x" }),
      ).rejects.toMatchObject({ code: "pairing_not_found" });
    });

    it("rejects when pairing already played", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "p1",
        status: "played",
        match: { id: "m1" },
      });
      await expect(
        deleteManualPairing({ pairingId: "p1" }),
      ).rejects.toMatchObject({ code: "pairing_already_played" });
    });

    it("rejects when match exists (status scheduled but matchId set)", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "p1",
        status: "in_progress",
        match: { id: "m1" },
      });
      await expect(
        deleteManualPairing({ pairingId: "p1" }),
      ).rejects.toMatchObject({ code: "pairing_already_played" });
    });

    it("deletes scheduled pairing without match", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "p1",
        status: "scheduled",
        match: null,
      });
      mockPrisma.leaguePairing.delete.mockResolvedValue({ id: "p1" });
      await expect(
        deleteManualPairing({ pairingId: "p1" }),
      ).resolves.toMatchObject({ deleted: true });
    });
  });

  describe("updateManualPairing", () => {
    it("updates scheduledAt", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "p1",
        roundId: "r1",
        status: "scheduled",
        match: null,
      });
      mockPrisma.leaguePairing.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({
          id: "p1",
          ...a.data,
        }),
      );
      const newDate = new Date("2026-12-25T10:00:00Z");
      const out = await updateManualPairing({
        pairingId: "p1",
        scheduledAt: newDate,
      });
      expect(out).toMatchObject({ scheduledAt: newDate });
    });

    it("moves pairing to target round", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "p1",
        roundId: "r1",
        status: "scheduled",
        match: null,
      });
      // 1er findUnique : target round
      mockPrisma.leagueRound.findUnique
        .mockResolvedValueOnce({
          id: "r2",
          seasonId: "s1",
          status: "pending",
        })
        .mockResolvedValueOnce({ seasonId: "s1" });
      mockPrisma.leaguePairing.update.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({
          id: "p1",
          ...a.data,
        }),
      );
      const out = await updateManualPairing({
        pairingId: "p1",
        targetRoundId: "r2",
      });
      expect(out).toMatchObject({ roundId: "r2" });
    });

    it("rejects move to completed round", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "p1",
        roundId: "r1",
        status: "scheduled",
        match: null,
      });
      mockPrisma.leagueRound.findUnique.mockResolvedValue({
        id: "r2",
        seasonId: "s1",
        status: "completed",
      });
      await expect(
        updateManualPairing({ pairingId: "p1", targetRoundId: "r2" }),
      ).rejects.toMatchObject({ code: "round_completed" });
    });

    it("rejects update of played pairing", async () => {
      mockPrisma.leaguePairing.findUnique.mockResolvedValue({
        id: "p1",
        roundId: "r1",
        status: "played",
        match: { id: "m1" },
      });
      await expect(
        updateManualPairing({
          pairingId: "p1",
          scheduledAt: new Date(),
        }),
      ).rejects.toMatchObject({ code: "pairing_already_played" });
    });
  });

  describe("LeagueManualPairingError", () => {
    it("preserves code on instance", () => {
      const e = new LeagueManualPairingError("duplicate_pairing", "x");
      expect(e.code).toBe("duplicate_pairing");
      expect(e.name).toBe("LeagueManualPairingError");
      expect(e).toBeInstanceOf(Error);
    });
  });
});
