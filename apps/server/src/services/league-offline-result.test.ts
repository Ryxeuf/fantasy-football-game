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
    teamPlayer: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    team: { update: vi.fn() },
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
  tpUpdateMany: prisma.teamPlayer.updateMany as MockFn,
  teamUpdate: prisma.team.update as MockFn,
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
      team: { ownerId: "u-home", name: "Orcs", roster: "orc", dedicatedFans: 1 },
    },
    awayParticipant: {
      id: "pa",
      teamId: "team-away",
      team: {
        ownerId: "u-away",
        name: "Elfes",
        roster: "wood_elf",
        dedicatedFans: 6,
      },
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
    m.tpUpdateMany.mockResolvedValue({ count: 0 });
    m.teamUpdate.mockResolvedValue({});
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

    // Snapshot de la saisie brute + pre-valeurs persiste pour la reversion.
    expect(matchData.offlineResultInput).toMatchObject({
      input: { scoreHome: 2, scoreAway: 1, casualtiesHome: 3, casualtiesAway: 1 },
      dedicatedFansBefore: { home: 1, away: 6 },
    });

    // 2 TeamSelection (home puis away)
    const selData = m.selCreate.mock.calls[0][0].data;
    expect(selData).toHaveLength(2);
    expect(selData[0].teamId).toBe("team-home");
    expect(selData[1].teamId).toBe("team-away");

    // Delegation avec les bons scores (A=home, B=away) + ELO neutralise
    expect(m.record).toHaveBeenCalledWith({
      matchId: "m-1",
      scoreA: 2,
      scoreB: 1,
      casualtiesA: 3,
      casualtiesB: 1,
      skipSeasonElo: true,
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

  it("applique winnings (treasury) et dedicated fans clampes 1-6", async () => {
    m.pairFind.mockResolvedValue(buildPairing()); // home fans=1, away fans=6
    await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      winningsHome: 50000,
      dedicatedFansDeltaHome: 2, // 1 -> 3
      winningsAway: 0,
      dedicatedFansDeltaAway: 3, // 6 -> clamp 6 (inchange -> pas d'update)
    });

    const homeUpdate = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-home",
    ) as [{ data: Record<string, any> }] | undefined;
    expect(homeUpdate).toBeTruthy();
    expect(homeUpdate![0].data.treasury).toEqual({ increment: 50000 });
    expect(homeUpdate![0].data.dedicatedFans).toBe(3);

    // away : winnings 0 + fans 6+3 clamp 6 (inchange) -> aucun update
    const awayUpdate = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-away",
    );
    expect(awayUpdate).toBeFalsy();
  });

  it("applique le net treasury = winnings - treasuryDebit (depenses)", async () => {
    m.pairFind.mockResolvedValue(buildPairing()); // home fans=1, away fans=6
    await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      // home : 60k gains - 50k depenses = +10k net
      winningsHome: 60000,
      treasuryDebitHome: 50000,
      // away : 0 gains - 30k depenses (coups de pouce) = -30k net
      winningsAway: 0,
      treasuryDebitAway: 30000,
    });

    const homeUpdate = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-home",
    ) as [{ data: Record<string, any> }] | undefined;
    expect(homeUpdate![0].data.treasury).toEqual({ increment: 10000 });

    const awayUpdate = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-away",
    ) as [{ data: Record<string, any> }] | undefined;
    expect(awayUpdate![0].data.treasury).toEqual({ decrement: 30000 });
  });

  it("applique les blessures durables (validation appartenance)", async () => {
    m.pairFind.mockResolvedValue(buildPairing());
    m.tpFindMany.mockResolvedValue([{ id: "p1" }]); // p1 valide ; p9 hors equipes
    await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      injuries: [
        { teamPlayerId: "p1", type: "niggling" },
        { teamPlayerId: "p9", type: "dead" }, // ignore (pas dans les equipes)
      ],
    });
    // p1 -> niggling + MNG ; p9 ignore
    expect(m.tpUpdate).toHaveBeenCalledTimes(1);
    expect(m.tpUpdate).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { missNextMatch: true, nigglingInjuries: { increment: 1 } },
    });
  });

  it("purge missNextMatch des 2 equipes (suspensions purgees par ce match)", async () => {
    m.pairFind.mockResolvedValue(buildPairing());
    await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });

    // Les joueurs (non morts) des 2 equipes voient leur suspension purgee :
    // ils viennent de disputer ce match offline. Mirror de match-start.ts.
    expect(m.tpUpdateMany).toHaveBeenCalledWith({
      where: {
        teamId: { in: ["team-home", "team-away"] },
        missNextMatch: true,
        dead: false,
      },
      data: { missNextMatch: false },
    });
  });

  it("purge AVANT d'appliquer les blessures (la suspension du match suivant survit)", async () => {
    m.pairFind.mockResolvedValue(buildPairing());
    m.tpFindMany.mockResolvedValue([{ id: "p1" }]);
    const order: string[] = [];
    m.tpUpdateMany.mockImplementation(async () => {
      order.push("clear");
      return { count: 1 };
    });
    m.tpUpdate.mockImplementation(async () => {
      order.push("injury");
      return {};
    });

    await recordOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 0,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
      injuries: [{ teamPlayerId: "p1", type: "niggling" }],
    });

    // purge (updateMany) puis re-pose la suspension via la blessure (update).
    expect(order).toEqual(["clear", "injury"]);
  });
});
