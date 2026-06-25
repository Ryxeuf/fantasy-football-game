/**
 * L2.A.2 — Tests du service `league-scheduler.ts`.
 *
 * Couvre :
 *  - startSeason : status invalides, < 2 participants, calendrier deja
 *    existant, persistance correcte rounds + pairings, basculement
 *    `in_progress`, options doubleRoundRobin / dates / deadline.
 *  - regenerateSchedule : refus si match deja compte, suppression +
 *    reconstruction sinon.
 *  - openSeasonForRegistration : draft -> scheduled, no-op si deja
 *    scheduled, refus depuis in_progress / completed.
 *  - closeSeason : cancelle les pairings non joues + passe a
 *    completed (idempotent).
 *  - requireLeagueCreator : 404 / 403 / OK.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    leagueParticipant: {
      findMany: vi.fn(),
    },
    // Lot C.2 — buildSchedule interroge les poules de la saison.
    leaguePool: {
      findMany: vi.fn(),
    },
    leagueRound: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    leaguePairing: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    match: {
      count: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  startSeason,
  regenerateSchedule,
  openSeasonForRegistration,
  closeSeason,
  requireLeagueCreator,
} from "./league-scheduler";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  seasonFind: prisma.leagueSeason.findUnique as MockFn,
  seasonUpdate: prisma.leagueSeason.update as MockFn,
  leagueFind: prisma.league.findUnique as MockFn,
  leagueUpdate: prisma.league.update as MockFn,
  participantFind: prisma.leagueParticipant.findMany as MockFn,
  roundCount: prisma.leagueRound.count as MockFn,
  roundCreate: prisma.leagueRound.create as MockFn,
  roundDelete: prisma.leagueRound.deleteMany as MockFn,
  roundUpdateMany: prisma.leagueRound.updateMany as MockFn,
  pairingCreateMany: prisma.leaguePairing.createMany as MockFn,
  pairingUpdateMany: prisma.leaguePairing.updateMany as MockFn,
  matchCount: prisma.match.count as MockFn,
  poolFind: prisma.leaguePool.findMany as MockFn,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Lot C.2 — defaut : aucune poule -> chemin round-robin global
  // (comportement historique). Les tests multi-poules dedies
  // override ce mock.
  mocked.poolFind.mockResolvedValue([]);
});

describe("league-scheduler.startSeason", () => {
  it("rejects if season is missing", async () => {
    mocked.seasonFind.mockResolvedValue(null);
    await expect(startSeason("missing")).rejects.toThrow(/introuvable/i);
  });

  it("rejects if season status is not draft/scheduled", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "in_progress",
    });
    await expect(startSeason("s1")).rejects.toThrow(/status/i);
  });

  it("rejects if a schedule already exists", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "draft" });
    mocked.roundCount.mockResolvedValue(3);
    await expect(startSeason("s1")).rejects.toThrow(/deja generee?/i);
  });

  it("rejects if fewer than 2 active participants", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "draft" });
    mocked.roundCount.mockResolvedValue(0);
    mocked.participantFind.mockResolvedValue([{ id: "p1" }]);
    await expect(startSeason("s1")).rejects.toThrow(/participants/i);
  });

  it("creates rounds + pairings and sets status=in_progress (4 teams)", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "scheduled" });
    mocked.roundCount.mockResolvedValue(0);
    mocked.participantFind.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
      { id: "p3" },
      { id: "p4" },
    ]);
    let roundIdx = 0;
    mocked.roundCreate.mockImplementation(async () => ({
      id: `r${++roundIdx}`,
    }));
    mocked.pairingCreateMany.mockResolvedValue({ count: 0 });
    mocked.seasonUpdate.mockResolvedValue({});

    const result = await startSeason("s1");

    expect(result).toEqual({
      seasonId: "s1",
      roundsCreated: 3,
      pairingsCreated: 6,
      status: "in_progress",
    });
    expect(mocked.roundCreate).toHaveBeenCalledTimes(3);
    expect(mocked.pairingCreateMany).toHaveBeenCalledTimes(3);
    expect(mocked.seasonUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "in_progress" },
    });
  });

  // Lot C.2 — quand la saison a des poules, le calendrier est genere
  // par poule avec journees partagees.
  it("generates a per-pool schedule when the season has pools", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "draft" });
    mocked.roundCount.mockResolvedValue(0);
    // 2 poules de 4 -> 3 journees partagees, 4 pairings par journee.
    mocked.poolFind.mockResolvedValue([{ id: "A" }, { id: "B" }]);
    mocked.participantFind.mockResolvedValue([
      { id: "a1", poolId: "A" },
      { id: "a2", poolId: "A" },
      { id: "a3", poolId: "A" },
      { id: "a4", poolId: "A" },
      { id: "b1", poolId: "B" },
      { id: "b2", poolId: "B" },
      { id: "b3", poolId: "B" },
      { id: "b4", poolId: "B" },
    ]);
    let ri = 0;
    mocked.roundCreate.mockImplementation(async () => ({ id: `r${++ri}` }));
    const pairingBatches: number[] = [];
    mocked.pairingCreateMany.mockImplementation(
      async (args: { data: unknown[] }) => {
        pairingBatches.push(args.data.length);
        return { count: args.data.length };
      },
    );
    mocked.seasonUpdate.mockResolvedValue({});

    const result = await startSeason("s1");
    expect(result.roundsCreated).toBe(3);
    // 6 pairs/pool * 2 pools = 12 pairings total.
    expect(result.pairingsCreated).toBe(12);
    // Chaque journee a 4 pairings (2 par poule).
    expect(pairingBatches).toEqual([4, 4, 4]);
  });

  it("doubles the schedule when doubleRoundRobin=true", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "draft" });
    mocked.roundCount.mockResolvedValue(0);
    mocked.participantFind.mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
      { id: "d" },
    ]);
    let i = 0;
    mocked.roundCreate.mockImplementation(async () => ({ id: `r${++i}` }));
    mocked.pairingCreateMany.mockResolvedValue({ count: 0 });

    const result = await startSeason("s1", { doubleRoundRobin: true });
    expect(result.roundsCreated).toBe(6);
    expect(result.pairingsCreated).toBe(12);
  });

  it("propagates scheduledAt and deadlineAt from options", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "draft" });
    mocked.roundCount.mockResolvedValue(0);
    mocked.participantFind.mockResolvedValue([
      { id: "a" },
      { id: "b" },
    ]);
    mocked.roundCreate.mockResolvedValue({ id: "r1" });
    mocked.pairingCreateMany.mockResolvedValue({ count: 0 });

    const baseStart = new Date("2026-06-01T00:00:00.000Z");
    await startSeason("s1", {
      firstRoundStartDate: baseStart,
      roundDurationDays: 7,
    });

    const roundCall = mocked.roundCreate.mock.calls[0][0];
    expect(roundCall.data.startDate?.toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
    expect(roundCall.data.endDate?.toISOString()).toBe(
      "2026-06-08T00:00:00.000Z",
    );
    const pairingCall = mocked.pairingCreateMany.mock.calls[0][0];
    expect(pairingCall.data[0].scheduledAt?.toISOString()).toBe(
      "2026-06-01T00:00:00.000Z",
    );
    expect(pairingCall.data[0].deadlineAt?.toISOString()).toBe(
      "2026-06-08T00:00:00.000Z",
    );
  });
});

describe("league-scheduler.regenerateSchedule", () => {
  it("refuses if the season is completed", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "completed" });
    await expect(regenerateSchedule("s1")).rejects.toThrow(/terminee/i);
  });

  it("refuses if a match has already been scored", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "in_progress" });
    mocked.matchCount.mockResolvedValue(1);
    await expect(regenerateSchedule("s1")).rejects.toThrow(/comptabilis/i);
  });

  it("deletes rounds + regenerates", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "in_progress" });
    mocked.matchCount.mockResolvedValue(0);
    mocked.roundDelete.mockResolvedValue({ count: 3 });
    mocked.participantFind.mockResolvedValue([
      { id: "a" },
      { id: "b" },
    ]);
    mocked.roundCreate.mockResolvedValue({ id: "r1" });
    mocked.pairingCreateMany.mockResolvedValue({ count: 0 });

    const result = await regenerateSchedule("s1");
    expect(mocked.roundDelete).toHaveBeenCalledWith({
      where: { seasonId: "s1" },
    });
    expect(result.roundsCreated).toBe(1);
    expect(result.pairingsCreated).toBe(1);
  });
});

describe("league-scheduler.openSeasonForRegistration", () => {
  it("noop if already scheduled", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "scheduled" });
    await openSeasonForRegistration("s1");
    expect(mocked.seasonUpdate).not.toHaveBeenCalled();
  });

  it("transitions draft -> scheduled", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "draft" });
    await openSeasonForRegistration("s1");
    expect(mocked.seasonUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "scheduled" },
    });
  });

  it("rejects if season is in_progress or completed", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "in_progress" });
    await expect(openSeasonForRegistration("s1")).rejects.toThrow(/status/i);
  });
});

// Non-regression : `League.status` restait fige a "draft" (« Brouillon »)
// car aucun chemin hors force-status admin ne le faisait avancer. Les
// actions de saison doivent desormais le faire progresser, forward-only.
describe("league-scheduler — auto-avancement du statut de ligue", () => {
  it("openSeasonForRegistration fait passer la ligue draft -> open", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "draft",
      leagueId: "l1",
    });
    mocked.leagueFind.mockResolvedValue({ id: "l1", status: "draft" });

    await openSeasonForRegistration("s1");

    expect(mocked.leagueUpdate).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "open" },
    });
  });

  it("startSeason fait passer la ligue (open) -> in_progress", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "scheduled",
      leagueId: "l1",
    });
    mocked.roundCount.mockResolvedValue(0);
    mocked.participantFind.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
    ]);
    mocked.roundCreate.mockImplementation(async () => ({ id: "r1" }));
    mocked.pairingCreateMany.mockResolvedValue({ count: 0 });
    mocked.seasonUpdate.mockResolvedValue({});
    mocked.leagueFind.mockResolvedValue({ id: "l1", status: "open" });

    await startSeason("s1");

    expect(mocked.leagueUpdate).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "in_progress" },
    });
  });

  it("ne retrograde jamais : startSeason ne touche pas une ligue completed", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "scheduled",
      leagueId: "l1",
    });
    mocked.roundCount.mockResolvedValue(0);
    mocked.participantFind.mockResolvedValue([
      { id: "p1" },
      { id: "p2" },
    ]);
    mocked.roundCreate.mockImplementation(async () => ({ id: "r1" }));
    mocked.pairingCreateMany.mockResolvedValue({ count: 0 });
    mocked.seasonUpdate.mockResolvedValue({});
    // completed / archived sont hors echelle : pilotes par l'admin.
    mocked.leagueFind.mockResolvedValue({ id: "l1", status: "completed" });

    await startSeason("s1");

    expect(mocked.leagueUpdate).not.toHaveBeenCalled();
  });

  it("idempotent : openSeasonForRegistration n'ecrit pas si la ligue est deja in_progress", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "draft",
      leagueId: "l1",
    });
    mocked.leagueFind.mockResolvedValue({ id: "l1", status: "in_progress" });

    await openSeasonForRegistration("s1");

    expect(mocked.leagueUpdate).not.toHaveBeenCalled();
  });
});

describe("league-scheduler.closeSeason", () => {
  it("noop if already completed", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "completed" });
    await closeSeason("s1");
    expect(mocked.pairingUpdateMany).not.toHaveBeenCalled();
    expect(mocked.seasonUpdate).not.toHaveBeenCalled();
  });

  it("cancels pending pairings + completes rounds + season", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", status: "in_progress" });
    mocked.pairingUpdateMany.mockResolvedValue({ count: 2 });
    mocked.roundUpdateMany.mockResolvedValue({ count: 3 });
    mocked.seasonUpdate.mockResolvedValue({});

    await closeSeason("s1");

    expect(mocked.pairingUpdateMany).toHaveBeenCalledWith({
      where: {
        round: { seasonId: "s1" },
        status: { in: ["scheduled", "in_progress"] },
      },
      data: { status: "cancelled" },
    });
    expect(mocked.roundUpdateMany).toHaveBeenCalled();
    expect(mocked.seasonUpdate).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "completed" },
    });
  });
});

describe("league-scheduler.requireLeagueCreator", () => {
  it("throws season-not-found when season missing", async () => {
    mocked.seasonFind.mockResolvedValue(null);
    await expect(requireLeagueCreator("u1", "s1")).rejects.toThrow(
      /season-not-found/,
    );
  });

  it("throws forbidden when user is not the creator", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "draft",
      league: { id: "l1", creatorId: "other" },
    });
    await expect(requireLeagueCreator("u1", "s1")).rejects.toThrow(
      /forbidden/,
    );
  });

  it("returns season info when user is the creator", async () => {
    mocked.seasonFind.mockResolvedValue({
      id: "s1",
      status: "draft",
      league: { id: "l1", creatorId: "u1" },
    });
    const out = await requireLeagueCreator("u1", "s1");
    expect(out).toEqual({
      seasonId: "s1",
      leagueId: "l1",
      status: "draft",
      creatorId: "u1",
    });
  });
});
