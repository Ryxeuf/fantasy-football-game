/**
 * Lot C — Tests du service `league-pool`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    leagueRound: { count: vi.fn() },
    leaguePool: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    leagueParticipant: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  createPool,
  updatePool,
  deletePool,
  assignParticipantsToPools,
  autoAssignBySnakeDraft,
  computeSnakeDraftAssignment,
  listPoolsForSeason,
  LeaguePoolError,
} from "./league-pool";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("Lot C — league-pool service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => ops);
  });

  describe("createPool", () => {
    it("refuses if season not found", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue(null);
      await expect(
        createPool({ seasonId: "x", name: "A" }),
      ).rejects.toMatchObject({ code: "season_not_found" });
    });

    it("refuses if season has started", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "in_progress",
      });
      await expect(
        createPool({ seasonId: "s1", name: "A" }),
      ).rejects.toMatchObject({ code: "season_started" });
    });

    it("rejects empty name", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      await expect(
        createPool({ seasonId: "s1", name: "   " }),
      ).rejects.toMatchObject({ code: "pool_name_taken" });
    });

    it("rejects duplicate name", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.findFirst.mockResolvedValueOnce({ id: "existing" });
      await expect(
        createPool({ seasonId: "s1", name: "Poule A" }),
      ).rejects.toMatchObject({ code: "pool_name_taken" });
    });

    it("auto-assigns next order when not provided", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.findFirst
        .mockResolvedValueOnce(null) // dup check
        .mockResolvedValueOnce({ order: 3 }); // last order
      mockPrisma.leaguePool.create.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "p1", ...a.data }),
      );
      const out = await createPool({ seasonId: "s1", name: "Poule B" });
      expect(out).toMatchObject({ order: 4 });
    });

    it("clamps qualifiesForPlayoffs to [0,128]", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.findFirst.mockResolvedValue(null);
      mockPrisma.leaguePool.create.mockImplementation(
        async (a: { data: Record<string, unknown> }) => ({ id: "p1", ...a.data }),
      );
      const out = await createPool({
        seasonId: "s1",
        name: "Poule C",
        qualifiesForPlayoffs: 9999,
      });
      expect((out as { qualifiesForPlayoffs: number }).qualifiesForPlayoffs).toBe(128);

      const out2 = await createPool({
        seasonId: "s1",
        name: "Poule D",
        qualifiesForPlayoffs: -5,
      });
      expect((out2 as { qualifiesForPlayoffs: number }).qualifiesForPlayoffs).toBe(0);
    });
  });

  describe("updatePool", () => {
    it("rejects if pool not found", async () => {
      mockPrisma.leaguePool.findUnique.mockResolvedValue(null);
      await expect(
        updatePool({ poolId: "x", name: "Y" }),
      ).rejects.toMatchObject({ code: "pool_not_found" });
    });

    it("rejects duplicate name to another pool in same season", async () => {
      mockPrisma.leaguePool.findUnique.mockResolvedValue({
        id: "p1",
        seasonId: "s1",
        name: "Old",
      });
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.findFirst.mockResolvedValue({ id: "p2" });
      await expect(
        updatePool({ poolId: "p1", name: "New" }),
      ).rejects.toMatchObject({ code: "pool_name_taken" });
    });

    it("accepts name unchanged", async () => {
      mockPrisma.leaguePool.findUnique.mockResolvedValue({
        id: "p1",
        seasonId: "s1",
        name: "A",
      });
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.update.mockResolvedValue({ id: "p1", name: "A" });
      await expect(
        updatePool({ poolId: "p1", name: "A" }),
      ).resolves.toBeDefined();
    });

    // Retour commissaire (ligue Kraken) : un quota faux etait definitif des
    // le demarrage de la saison. Le QUOTA reste corrigeable jusqu'au
    // bracket ; la composition, elle, reste figee.
    describe("quota de qualifies en cours de saison", () => {
      beforeEach(() => {
        mockPrisma.leaguePool.findUnique.mockResolvedValue({
          id: "p1",
          seasonId: "s1",
          name: "Poule A",
        });
        mockPrisma.leagueSeason.findUnique.mockResolvedValue({
          id: "s1",
          status: "in_progress",
        });
        mockPrisma.leagueRound.count.mockResolvedValue(0);
        mockPrisma.leaguePool.update.mockImplementation(
          async (args: { data: Record<string, unknown> }) => ({
            id: "p1",
            ...args.data,
          }),
        );
      });

      it("accepte un quota corrige sur une saison in_progress sans bracket", async () => {
        const out = await updatePool({ poolId: "p1", qualifiesForPlayoffs: 4 });
        expect(out).toMatchObject({ qualifiesForPlayoffs: 4 });
        expect(mockPrisma.leaguePool.update).toHaveBeenCalledWith({
          where: { id: "p1" },
          data: { qualifiesForPlayoffs: 4 },
        });
      });

      it("reconnait un tour de bracket par son kind OU son bracketSlot", async () => {
        await updatePool({ poolId: "p1", qualifiesForPlayoffs: 4 });
        expect(mockPrisma.leagueRound.count).toHaveBeenCalledWith({
          where: {
            seasonId: "s1",
            OR: [{ kind: "playoff" }, { bracketSlot: { not: null } }],
          },
        });
      });

      it("refuse le quota une fois le bracket genere", async () => {
        mockPrisma.leagueRound.count.mockResolvedValue(2);
        await expect(
          updatePool({ poolId: "p1", qualifiesForPlayoffs: 4 }),
        ).rejects.toMatchObject({ code: "playoffs_started" });
        expect(mockPrisma.leaguePool.update).not.toHaveBeenCalled();
      });

      it("refuse le quota sur une saison cloturee", async () => {
        mockPrisma.leagueSeason.findUnique.mockResolvedValue({
          id: "s1",
          status: "completed",
        });
        await expect(
          updatePool({ poolId: "p1", qualifiesForPlayoffs: 4 }),
        ).rejects.toMatchObject({ code: "season_completed" });
        expect(mockPrisma.leaguePool.update).not.toHaveBeenCalled();
      });

      it("garde la composition figee : renommer reste refuse", async () => {
        await expect(
          updatePool({ poolId: "p1", name: "Poule Z" }),
        ).rejects.toMatchObject({ code: "season_started" });
      });

      it("un patch quota + autre champ suit la regle de la composition", async () => {
        await expect(
          updatePool({ poolId: "p1", qualifiesForPlayoffs: 4, order: 3 }),
        ).rejects.toMatchObject({ code: "season_started" });
        expect(mockPrisma.leaguePool.update).not.toHaveBeenCalled();
      });

      it("une saison en brouillon accepte toujours tout", async () => {
        mockPrisma.leagueSeason.findUnique.mockResolvedValue({
          id: "s1",
          status: "draft",
        });
        await expect(
          updatePool({ poolId: "p1", qualifiesForPlayoffs: 2 }),
        ).resolves.toMatchObject({ qualifiesForPlayoffs: 2 });
      });
    });
  });

  describe("deletePool", () => {
    it("rejects if participants still assigned", async () => {
      mockPrisma.leaguePool.findUnique.mockResolvedValue({
        id: "p1",
        seasonId: "s1",
        _count: { participants: 2 },
      });
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      await expect(
        deletePool({ poolId: "p1" }),
      ).rejects.toMatchObject({ code: "pool_not_empty" });
    });

    it("deletes empty pool", async () => {
      mockPrisma.leaguePool.findUnique.mockResolvedValue({
        id: "p1",
        seasonId: "s1",
        _count: { participants: 0 },
      });
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.delete.mockResolvedValue({ id: "p1" });
      await expect(
        deletePool({ poolId: "p1" }),
      ).resolves.toMatchObject({ deleted: true });
    });
  });

  describe("assignParticipantsToPools", () => {
    it("rejects if participant not found", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([]);
      await expect(
        assignParticipantsToPools({
          seasonId: "s1",
          assignments: [{ participantId: "missing", poolId: "p1" }],
        }),
      ).rejects.toMatchObject({ code: "participant_not_found" });
    });

    it("rejects participant from another season", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "pa", seasonId: "OTHER" },
      ]);
      await expect(
        assignParticipantsToPools({
          seasonId: "s1",
          assignments: [{ participantId: "pa", poolId: "p1" }],
        }),
      ).rejects.toMatchObject({ code: "participant_not_in_season" });
    });

    it("rejects pool from another season", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "pa", seasonId: "s1" },
      ]);
      mockPrisma.leaguePool.findMany.mockResolvedValue([
        { id: "p1", seasonId: "OTHER" },
      ]);
      await expect(
        assignParticipantsToPools({
          seasonId: "s1",
          assignments: [{ participantId: "pa", poolId: "p1" }],
        }),
      ).rejects.toMatchObject({ code: "pool_not_found" });
    });

    it("commits updates atomically", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "pa", seasonId: "s1" },
        { id: "pb", seasonId: "s1" },
      ]);
      mockPrisma.leaguePool.findMany.mockResolvedValue([
        { id: "p1", seasonId: "s1" },
      ]);
      mockPrisma.leagueParticipant.update.mockResolvedValue({});
      const out = await assignParticipantsToPools({
        seasonId: "s1",
        assignments: [
          { participantId: "pa", poolId: "p1" },
          { participantId: "pb", poolId: null },
        ],
      });
      expect(out).toMatchObject({ updated: 2 });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("returns updated=0 on empty payload", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      const out = await assignParticipantsToPools({
        seasonId: "s1",
        assignments: [],
      });
      expect(out).toEqual({ updated: 0 });
    });
  });

  describe("computeSnakeDraftAssignment (pure)", () => {
    it("returns empty when no pools", () => {
      expect(computeSnakeDraftAssignment(["a", "b", "c"], [])).toEqual([]);
    });

    it("distributes 8 participants in 2 pools (snake)", () => {
      const out = computeSnakeDraftAssignment(
        ["1", "2", "3", "4", "5", "6", "7", "8"],
        ["A", "B"],
      );
      // cycle 0 (1,2) : A,B
      // cycle 1 (3,4) : B,A
      // cycle 2 (5,6) : A,B
      // cycle 3 (7,8) : B,A
      expect(out.map((o) => o.poolId)).toEqual([
        "A",
        "B",
        "B",
        "A",
        "A",
        "B",
        "B",
        "A",
      ]);
    });

    it("distributes 6 participants in 3 pools (snake)", () => {
      const out = computeSnakeDraftAssignment(
        ["1", "2", "3", "4", "5", "6"],
        ["A", "B", "C"],
      );
      // cycle 0 (1,2,3) : A,B,C
      // cycle 1 (4,5,6) : C,B,A
      expect(out.map((o) => o.poolId)).toEqual([
        "A",
        "B",
        "C",
        "C",
        "B",
        "A",
      ]);
    });

    it("handles uneven distribution gracefully", () => {
      const out = computeSnakeDraftAssignment(["1", "2", "3", "4", "5"], ["A", "B"]);
      expect(out.map((o) => o.poolId)).toEqual(["A", "B", "B", "A", "A"]);
    });
  });

  describe("autoAssignBySnakeDraft (with mocked DB)", () => {
    it("returns no-pools note when no pools exist", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.findMany.mockResolvedValue([]);
      const out = await autoAssignBySnakeDraft({ seasonId: "s1" });
      expect(out).toMatchObject({ assigned: 0, note: "no-pools" });
    });

    it("assigns participants according to snake order", async () => {
      mockPrisma.leagueSeason.findUnique.mockResolvedValue({
        id: "s1",
        status: "draft",
      });
      mockPrisma.leaguePool.findMany.mockResolvedValue([
        { id: "A" },
        { id: "B" },
      ]);
      mockPrisma.leagueParticipant.findMany.mockResolvedValue([
        { id: "1" },
        { id: "2" },
        { id: "3" },
        { id: "4" },
      ]);
      mockPrisma.leagueParticipant.update.mockResolvedValue({});
      const out = await autoAssignBySnakeDraft({ seasonId: "s1" });
      expect(out).toMatchObject({ assigned: 4 });
    });
  });

  describe("listPoolsForSeason", () => {
    it("returns pools ordered by `order`", async () => {
      mockPrisma.leaguePool.findMany.mockResolvedValue([
        { id: "a", order: 0, _count: { participants: 2 } },
        { id: "b", order: 1, _count: { participants: 3 } },
      ]);
      const out = await listPoolsForSeason("s1");
      expect(out).toHaveLength(2);
      expect(mockPrisma.leaguePool.findMany).toHaveBeenCalledWith({
        where: { seasonId: "s1" },
        orderBy: { order: "asc" },
        include: { _count: { select: { participants: true } } },
      });
    });
  });

  describe("LeaguePoolError", () => {
    it("preserves code", () => {
      const e = new LeaguePoolError("pool_not_empty", "x");
      expect(e.code).toBe("pool_not_empty");
      expect(e).toBeInstanceOf(Error);
    });
  });
});
