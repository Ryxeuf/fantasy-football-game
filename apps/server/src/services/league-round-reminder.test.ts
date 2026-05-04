/**
 * L2.A.12 — Tests du service `league-round-reminder.ts`.
 *
 * Verifie que :
 *  - une saison/round absent retourne `notified=0` proprement
 *  - les pairings du round ciblé sont enumeres
 *  - chaque coach implique recoit un push (2 par pairing)
 *  - les coaches sans coachName retombent sur le defaut "Coach"
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const sendPushSpy = vi.fn();

vi.mock("./push-notifications", () => ({
  sendLeagueRoundReminderPush: (input: unknown) => sendPushSpy(input),
}));

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    leagueRound: { findUnique: vi.fn() },
    leaguePairing: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { notifyParticipantsOfFirstRound } from "./league-round-reminder";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  seasonFind: prisma.leagueSeason.findUnique as MockFn,
  roundFind: prisma.leagueRound.findUnique as MockFn,
  pairingFindMany: prisma.leaguePairing.findMany as MockFn,
};

beforeEach(() => {
  vi.clearAllMocks();
  sendPushSpy.mockReset();
});

describe("notifyParticipantsOfFirstRound", () => {
  it("returns 0 when season is missing", async () => {
    mocked.seasonFind.mockResolvedValue(null);
    const out = await notifyParticipantsOfFirstRound({ seasonId: "s1" });
    expect(out).toEqual({ notified: 0 });
    expect(sendPushSpy).not.toHaveBeenCalled();
  });

  it("returns 0 when the target round does not exist", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", leagueId: "l1" });
    mocked.roundFind.mockResolvedValue(null);
    const out = await notifyParticipantsOfFirstRound({ seasonId: "s1" });
    expect(out).toEqual({ notified: 0 });
    expect(sendPushSpy).not.toHaveBeenCalled();
  });

  it("emits 2 pushes per pairing (home + away)", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", leagueId: "l1" });
    mocked.roundFind.mockResolvedValue({ id: "r1" });
    const deadline = new Date("2026-06-08T00:00:00.000Z");
    mocked.pairingFindMany.mockResolvedValue([
      {
        id: "p1",
        deadlineAt: deadline,
        homeParticipant: {
          team: {
            ownerId: "u-home",
            owner: { coachName: "Alice" },
          },
        },
        awayParticipant: {
          team: {
            ownerId: "u-away",
            owner: { coachName: "Bob" },
          },
        },
      },
    ]);

    const out = await notifyParticipantsOfFirstRound({ seasonId: "s1" });
    expect(out).toEqual({ notified: 2 });
    expect(sendPushSpy).toHaveBeenCalledTimes(2);

    const pushes = sendPushSpy.mock.calls.map((c: unknown[]) => c[0]) as Array<{
      userId: string;
      opponentCoachName: string;
      roundNumber: number;
      deadlineAt: Date | null;
    }>;
    const home = pushes.find((p) => p.userId === "u-home");
    const away = pushes.find((p) => p.userId === "u-away");
    expect(home?.opponentCoachName).toBe("Bob");
    expect(home?.roundNumber).toBe(1);
    expect(home?.deadlineAt?.toISOString()).toBe(deadline.toISOString());
    expect(away?.opponentCoachName).toBe("Alice");
  });

  it("falls back to 'Coach' when the opponent has no coachName", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", leagueId: "l1" });
    mocked.roundFind.mockResolvedValue({ id: "r1" });
    mocked.pairingFindMany.mockResolvedValue([
      {
        id: "p1",
        deadlineAt: null,
        homeParticipant: {
          team: { ownerId: "u-home", owner: { coachName: null } },
        },
        awayParticipant: {
          team: { ownerId: "u-away", owner: { coachName: null } },
        },
      },
    ]);

    await notifyParticipantsOfFirstRound({ seasonId: "s1" });

    const pushes = sendPushSpy.mock.calls.map((c: unknown[]) => c[0]) as Array<{
      opponentCoachName: string;
    }>;
    expect(pushes.every((p) => p.opponentCoachName === "Coach")).toBe(true);
  });

  it("uses opts.roundNumber when provided", async () => {
    mocked.seasonFind.mockResolvedValue({ id: "s1", leagueId: "l1" });
    mocked.roundFind.mockResolvedValue({ id: "r3" });
    mocked.pairingFindMany.mockResolvedValue([]);

    await notifyParticipantsOfFirstRound({ seasonId: "s1", roundNumber: 3 });

    const findArgs = mocked.roundFind.mock.calls[0][0];
    expect(findArgs.where.seasonId_roundNumber.roundNumber).toBe(3);
  });
});
