import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: { findMany: vi.fn(), updateMany: vi.fn() },
    replay: { findMany: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { prisma } from "../prisma";

import {
  FALLBACK_MATCH_DURATION_MS,
  completeBroadcastMatches,
  completionDeadline,
  countStaleLiveMatches,
  shouldComplete,
} from "./pro-league-match-completion";

const mocked = prisma as unknown as {
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn>; updateMany: ReturnType<typeof vi.fn> };
  replay: { findMany: ReturnType<typeof vi.fn> };
};

const KICKOFF = new Date("2026-10-06T21:00:00Z");
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("completionDeadline / shouldComplete (purs)", () => {
  it("l'échéance est le coup d'envoi plus la durée du replay, 90 min sans replay", () => {
    expect(completionDeadline(KICKOFF, 2 * HOUR).getTime()).toBe(KICKOFF.getTime() + 2 * HOUR);
    expect(completionDeadline(KICKOFF, null).getTime()).toBe(KICKOFF.getTime() + FALLBACK_MATCH_DURATION_MS);
    expect(completionDeadline(KICKOFF, 0).getTime()).toBe(KICKOFF.getTime() + FALLBACK_MATCH_DURATION_MS);
  });

  it("ne termine qu'un match en direct dont l'échéance est passée", () => {
    const base = { id: "m", scheduledAt: KICKOFF, durationMs: HOUR };
    const after = new Date(KICKOFF.getTime() + HOUR);
    const before = new Date(KICKOFF.getTime() + HOUR - 1);
    expect(shouldComplete({ ...base, status: "ready" }, after)).toBe(true);
    expect(shouldComplete({ ...base, status: "in_progress" }, after)).toBe(true);
    expect(shouldComplete({ ...base, status: "ready" }, before)).toBe(false);
    expect(shouldComplete({ ...base, status: "scheduled" }, after)).toBe(false);
    expect(shouldComplete({ ...base, status: "completed" }, after)).toBe(false);
  });
});

describe("completeBroadcastMatches", () => {
  it("passe completed les matchs échus, avec completedAt = échéance, et laisse les autres", async () => {
    const now = new Date(KICKOFF.getTime() + 2 * HOUR);
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      { id: "done", status: "ready", scheduledAt: KICKOFF },
      { id: "live", status: "ready", scheduledAt: new Date(KICKOFF.getTime() + 1.5 * HOUR) },
      { id: "no-replay", status: "in_progress", scheduledAt: new Date(KICKOFF.getTime() - 3 * HOUR) },
    ]);
    mocked.replay.findMany.mockResolvedValue([
      { matchId: "done", durationMs: HOUR },
      { matchId: "live", durationMs: HOUR },
    ]);
    mocked.proLeagueMatch.updateMany.mockResolvedValue({ count: 1 });

    const out = await completeBroadcastMatches({ now });

    expect(out).toEqual({ inspected: 3, completed: 2, pending: 1 });
    expect(mocked.proLeagueMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["ready", "in_progress"] }, isTest: false, scheduledAt: { lte: now } },
      }),
    );
    const calls = mocked.proLeagueMatch.updateMany.mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({
      where: { id: "done", status: { in: ["ready", "in_progress"] } },
      data: { status: "completed", completedAt: new Date(KICKOFF.getTime() + HOUR) },
    });
    expect(calls[1].where.id).toBe("no-replay");
    expect(calls[1].data.completedAt).toEqual(
      new Date(KICKOFF.getTime() - 3 * HOUR + FALLBACK_MATCH_DURATION_MS),
    );
  });

  it("ne compte pas un match dont l'UPDATE conditionnel n'a rien touché (course)", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([{ id: "m", status: "ready", scheduledAt: KICKOFF }]);
    mocked.replay.findMany.mockResolvedValue([{ matchId: "m", durationMs: HOUR }]);
    mocked.proLeagueMatch.updateMany.mockResolvedValue({ count: 0 });
    const out = await completeBroadcastMatches({ now: new Date(KICKOFF.getTime() + 2 * HOUR) });
    expect(out).toEqual({ inspected: 1, completed: 0, pending: 1 });
  });

  it("rien à faire sans match en direct", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    const out = await completeBroadcastMatches({ now: KICKOFF });
    expect(out).toEqual({ inspected: 0, completed: 0, pending: 0 });
    expect(mocked.replay.findMany).not.toHaveBeenCalled();
  });
});

describe("countStaleLiveMatches", () => {
  it("compte les matchs en direct échus depuis plus de staleMs", async () => {
    const now = new Date(KICKOFF.getTime() + 6 * HOUR);
    mocked.proLeagueMatch.findMany.mockResolvedValue([
      { id: "stale", status: "ready", scheduledAt: KICKOFF },
      { id: "recent", status: "ready", scheduledAt: new Date(KICKOFF.getTime() + 2.5 * HOUR) },
    ]);
    mocked.replay.findMany.mockResolvedValue([
      { matchId: "stale", durationMs: HOUR },
      { matchId: "recent", durationMs: HOUR },
    ]);
    expect(await countStaleLiveMatches(now, 3 * HOUR)).toBe(1);
  });

  it("vaut 0 sans candidat", async () => {
    mocked.proLeagueMatch.findMany.mockResolvedValue([]);
    expect(await countStaleLiveMatches(KICKOFF, HOUR)).toBe(0);
  });
});
