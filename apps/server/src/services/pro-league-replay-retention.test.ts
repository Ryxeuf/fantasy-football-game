import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findMany: vi.fn(), updateMany: vi.fn((args: unknown) => args) },
    replay: { deleteMany: vi.fn((args: unknown) => args) },
    $transaction: vi.fn(),
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "../prisma";

import {
  DEFAULT_REPLAY_RETENTION_DAYS,
  pruneExpiredReplays,
  replayRetentionCutoff,
  resolveReplayRetentionDays,
} from "./pro-league-replay-retention";

const mocked = prisma as unknown as {
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  replay: { deleteMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

const NOW = new Date("2026-10-06T03:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.resetAllMocks();
  mocked.proLeagueMatch.updateMany.mockImplementation((args: unknown) => args);
  mocked.replay.deleteMany.mockImplementation((args: unknown) => args);
});

describe("resolveReplayRetentionDays / replayRetentionCutoff (purs)", () => {
  it("lit l'environnement, 365 par défaut, 0 = jamais, valeur absurde = défaut", () => {
    expect(resolveReplayRetentionDays({})).toBe(DEFAULT_REPLAY_RETENTION_DAYS);
    expect(resolveReplayRetentionDays({ PRO_LEAGUE_REPLAY_RETENTION_DAYS: "90" })).toBe(90);
    expect(resolveReplayRetentionDays({ PRO_LEAGUE_REPLAY_RETENTION_DAYS: "0" })).toBe(0);
    expect(resolveReplayRetentionDays({ PRO_LEAGUE_REPLAY_RETENTION_DAYS: "abc" })).toBe(DEFAULT_REPLAY_RETENTION_DAYS);
    expect(resolveReplayRetentionDays({ PRO_LEAGUE_REPLAY_RETENTION_DAYS: "-3" })).toBe(DEFAULT_REPLAY_RETENTION_DAYS);
  });

  it("la coupure recule de N jours", () => {
    expect(replayRetentionCutoff(NOW, 10).getTime()).toBe(NOW.getTime() - 10 * DAY);
  });
});

describe("pruneExpiredReplays", () => {
  it("supprime les replays des matchs terminés hors saison en cours, et détache replayId", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);
    mocked.$transaction.mockResolvedValue([{ count: 2 }, { count: 2 }]);
    const out = await pruneExpiredReplays({ now: NOW, retentionDays: 30, batch: 10 });
    expect(out).toEqual({ inspected: 2, pruned: 2, skipped: false });
    const where = mocked.proLeagueMatch.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      status: "completed",
      isTest: false,
      replayId: { not: null },
      completedAt: { lt: new Date(NOW.getTime() - 30 * DAY) },
      season: { status: { not: "in_progress" } },
    });
    expect(mocked.replay.deleteMany).toHaveBeenCalledWith({ where: { matchId: { in: ["m1", "m2"] } } });
    expect(mocked.proLeagueMatch.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1", "m2"] } },
      data: { replayId: null },
    });
    expect(mocked.$transaction).toHaveBeenCalledTimes(1);
  });

  it("ne touche à rien avec une rétention à 0 ou sans candidat", async () => {
    expect(await pruneExpiredReplays({ now: NOW, retentionDays: 0 })).toEqual({ inspected: 0, pruned: 0, skipped: true });
    expect(mocked.proLeagueMatch.findMany).not.toHaveBeenCalled();
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    expect(await pruneExpiredReplays({ now: NOW, retentionDays: 5 })).toEqual({ inspected: 0, pruned: 0, skipped: false });
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });
});
