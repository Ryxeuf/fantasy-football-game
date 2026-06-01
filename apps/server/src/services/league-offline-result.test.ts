/**
 * Workstream ligue offline — tests de `recordOfflineLeagueResult` (option b).
 *
 * Couvre :
 *  - skips : pairing introuvable / etat terminal / match deja compte
 *  - materialise un Match `offline` + 2 TeamSelection puis delegue a
 *    `recordLeagueMatchResult` (mock) avec les bons scores
 *  - stats par joueur -> SPP applique (teamPlayer.update) avant la delegation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => {
  const prisma: any = {
    leaguePairing: { findUnique: vi.fn() },
    match: { create: vi.fn() },
    teamSelection: { createMany: vi.fn() },
    teamPlayer: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === "function") {
        return (arg as (tx: unknown) => Promise<unknown>)(prisma);
      }
      return Promise.all(arg as Promise<unknown>[]);
    }),
  };
  return { prisma };
});

vi.mock("./league-match-result", () => ({
  recordLeagueMatchResult: vi.fn(),
}));

vi.mock("./spp-tracking", () => ({
  loadLeagueSPPContext: vi.fn(async () => ({
    isLeagueMatch: true,
    teamA: { bagarreursBrutaux: false },
    teamB: { bagarreursBrutaux: false },
  })),
  calculatePlayerSPP: vi.fn(() => 6),
}));

import { prisma } from "../prisma";
import { recordLeagueMatchResult } from "./league-match-result";
import { recordOfflineLeagueResult } from "./league-offline-result";

type MockFn = ReturnType<typeof vi.fn>;
const m = {
  pairFind: prisma.leaguePairing.findUnique as MockFn,
  matchCreate: prisma.match.create as MockFn,
  selCreate: prisma.teamSelection.createMany as MockFn,
  tpFindMany: prisma.teamPlayer.findMany as MockFn,
  tpUpdate: prisma.teamPlayer.update as MockFn,
  record: recordLeagueMatchResult as unknown as MockFn,
};

function buildPairing(overrides: Record<string, unknown> = {}) {
  return {
    id: "pair-1",
    status: "scheduled",
    match: null,
    round: { id: "round-1", seasonId: "season-1" },
    homeParticipant: {
      id: "ph",
      teamId: "team-home",
      team: { ownerId: "u-home", name: "Orcs", roster: "orc" },
    },
    awayParticipant: {
      id: "pa",
      teamId: "team-away",
      team: { ownerId: "u-away", name: "Elfes", roster: "wood_elf" },
    },
    ...overrides,
  };
}

describe("recordOfflineLeagueResult (option b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.matchCreate.mockResolvedValue({ id: "m-1" });
    m.selCreate.mockResolvedValue({});
    m.tpUpdate.mockResolvedValue({});
    m.tpFindMany.mockResolvedValue([]);
    m.record.mockResolvedValue({
      recorded: true,
      winner: "A",
      pointsDelta: { teamA: 3, teamB: 0 },
      roundCompleted: false,
      seasonCompleted: false,
    });
  });

  it("skips when the pairing does not exist", async () => {
    m.pairFind.mockResolvedValue(null);
    const r = await recordOfflineLeagueResult({
      pairingId: "nope",
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({ skipped: true, reason: "pairing-missing" });
    expect(m.record).not.toHaveBeenCalled();
  });

  it("skips when the pairing is already terminal", async () => {
    m.pairFind.mockResolvedValue(buildPairing({ status: "played" }));
    const r = await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({
      skipped: true,
      reason: "pairing-not-terminal-eligible",
    });
  });

  it("materialise un Match offline puis delegue a recordLeagueMatchResult", async () => {
    m.pairFind.mockResolvedValue(buildPairing());
    const r = await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 3,
      casualtiesAway: 1,
    });

    expect(r).toMatchObject({
      recorded: true,
      matchId: "m-1",
      winner: "home",
      sppPlayersUpdated: 0,
    });

    // Match synthetique en mode offline, rattache au pairing
    const matchData = m.matchCreate.mock.calls[0][0].data;
    expect(matchData.mode).toBe("offline");
    expect(matchData.leaguePairingId).toBe("pair-1");
    expect(matchData.leagueSeasonId).toBe("season-1");

    // 2 TeamSelection (home puis away)
    const selData = m.selCreate.mock.calls[0][0].data;
    expect(selData).toHaveLength(2);
    expect(selData[0].teamId).toBe("team-home");
    expect(selData[1].teamId).toBe("team-away");

    // Delegation avec les bons scores (A=home, B=away)
    expect(m.record).toHaveBeenCalledWith({
      matchId: "m-1",
      scoreA: 2,
      scoreB: 1,
      casualtiesA: 3,
      casualtiesB: 1,
    });
  });

  it("applique le SPP par joueur avant la delegation", async () => {
    m.pairFind.mockResolvedValue(buildPairing());
    m.tpFindMany.mockResolvedValue([
      { id: "p1", teamId: "team-home" },
      { id: "p2", teamId: "team-away" },
    ]);

    const r = await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 2,
      casualtiesAway: 0,
      playerStats: [
        { teamPlayerId: "p1", touchdowns: 1, casualties: 1 },
        { teamPlayerId: "p2", mvp: true },
      ],
    });

    expect(r).toMatchObject({ recorded: true, sppPlayersUpdated: 2 });
    expect(m.tpUpdate).toHaveBeenCalledTimes(2);
    const p1Data = m.tpUpdate.mock.calls[0][0].data;
    expect(p1Data.spp).toEqual({ increment: 6 }); // mock calculatePlayerSPP -> 6
    expect(p1Data.totalTouchdowns).toEqual({ increment: 1 });
    expect(p1Data.matchesPlayed).toEqual({ increment: 1 });
    // SPP applique avant la delegation
    expect(m.record).toHaveBeenCalled();
  });
});
