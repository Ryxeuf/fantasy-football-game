/**
 * Tests de `reverseOfflineLeagueResult` (W-B2).
 *
 * Couvre les garde-fous (refus) et la reversion exacte : standings decrementes,
 * SPP/blessures/eco annulees, Match supprime, pairing/round re-ouverts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => {
  const prisma: any = {
    match: { findUnique: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
    leagueRound: { count: vi.fn(), update: vi.fn() },
    leaguePairing: { findUnique: vi.fn(), update: vi.fn() },
    leagueParticipant: { update: vi.fn() },
    teamPlayer: {
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    team: { update: vi.fn() },
    teamSelection: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown) =>
      Array.isArray(ops) ? Promise.all(ops as Promise<unknown>[]) : ops,
    ),
  };
  return { prisma };
});

// Recalcul TV isole : la reversion d'achats appelle updateTeamValues apres la
// transaction (testee a part). On le neutralise ici.
vi.mock("../utils/team-values", () => ({ updateTeamValues: vi.fn() }));

vi.mock("./spp-tracking", () => ({
  loadLeagueSPPContext: vi.fn(async () => ({
    isLeagueMatch: true,
    teamA: { bagarreursBrutaux: false },
    teamB: { bagarreursBrutaux: false },
  })),
  calculatePlayerSPP: vi.fn(() => 6),
}));

// Garde parseOfflineSnapshot / OFFLINE_MATCH_MODE reels, mocke uniquement la
// re-saisie pour tester l'orchestration d'edition.
vi.mock("./league-offline-result", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, recordOfflineLeagueResult: vi.fn() };
});

import { prisma } from "../prisma";
import { recordOfflineLeagueResult } from "./league-offline-result";
import { updateTeamValues } from "../utils/team-values";
import {
  reverseOfflineLeagueResult,
  editOfflineLeagueResult,
} from "./league-offline-edit";

type MockFn = ReturnType<typeof vi.fn>;
const m = {
  matchFind: prisma.match.findUnique as MockFn,
  matchFindFirst: prisma.match.findFirst as MockFn,
  matchDelete: prisma.match.delete as MockFn,
  roundCount: prisma.leagueRound.count as MockFn,
  roundUpdate: prisma.leagueRound.update as MockFn,
  pairFind: prisma.leaguePairing.findUnique as MockFn,
  pairUpdate: prisma.leaguePairing.update as MockFn,
  partUpdate: prisma.leagueParticipant.update as MockFn,
  tpFindMany: prisma.teamPlayer.findMany as MockFn,
  tpUpdate: prisma.teamPlayer.update as MockFn,
  tpDeleteMany: prisma.teamPlayer.deleteMany as MockFn,
  tpUpdateMany: prisma.teamPlayer.updateMany as MockFn,
  teamUpdate: prisma.team.update as MockFn,
  selDelete: prisma.teamSelection.deleteMany as MockFn,
  updateTv: updateTeamValues as unknown as MockFn,
};

function buildSnapshot(over: Record<string, unknown> = {}) {
  return {
    input: {
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 3,
      casualtiesAway: 0,
      playerStats: [],
      winningsHome: 50000,
      winningsAway: 0,
      dedicatedFansDeltaHome: 1,
      dedicatedFansDeltaAway: 0,
      injuries: [],
      ...over,
    },
    dedicatedFansBefore: { home: 1, away: 6 },
  };
}

function buildMatch(over: Record<string, unknown> = {}) {
  return {
    id: "m-1",
    mode: "offline",
    leagueScoredAt: new Date(),
    leaguePairingId: "pair-1",
    leagueRoundId: "round-1",
    leagueSeasonId: "season-1",
    offlineResultInput: buildSnapshot(),
    leaguePostMatchSequence: null,
    leagueSeason: {
      status: "in_progress",
      league: { winPoints: 3, drawPoints: 1, lossPoints: 0 },
    },
    leagueRound: { id: "round-1", status: "completed" },
    ...over,
  };
}

function buildPairing() {
  return {
    id: "pair-1",
    homeParticipant: {
      id: "ph",
      teamId: "team-home",
      team: { roster: "orc" },
    },
    awayParticipant: {
      id: "pa",
      teamId: "team-away",
      team: { roster: "wood_elf" },
    },
  };
}

describe("reverseOfflineLeagueResult (W-B2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.roundCount.mockResolvedValue(0);
    m.pairFind.mockResolvedValue(buildPairing());
    m.tpFindMany.mockResolvedValue([]);
    m.partUpdate.mockResolvedValue({});
    m.tpUpdate.mockResolvedValue({});
    m.tpDeleteMany.mockResolvedValue({ count: 0 });
    m.tpUpdateMany.mockResolvedValue({ count: 0 });
    m.teamUpdate.mockResolvedValue({});
    m.selDelete.mockResolvedValue({ count: 2 });
    m.matchDelete.mockResolvedValue({});
    m.pairUpdate.mockResolvedValue({});
    m.roundUpdate.mockResolvedValue({});
  });

  it("skip si le match est introuvable", async () => {
    m.matchFind.mockResolvedValue(null);
    expect(await reverseOfflineLeagueResult("nope")).toEqual({
      skipped: true,
      reason: "match-missing",
    });
  });

  it("skip si le match n'est pas offline", async () => {
    m.matchFind.mockResolvedValue(buildMatch({ mode: "realtime" }));
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "not-offline-match",
    });
  });

  it("skip si pas encore comptabilise", async () => {
    m.matchFind.mockResolvedValue(buildMatch({ leagueScoredAt: null }));
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "not-scored",
    });
  });

  it("skip si le snapshot est absent", async () => {
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: null }));
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "snapshot-missing",
    });
  });

  it("skip si la saison est clôturee", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leagueSeason: {
          status: "completed",
          league: { winPoints: 3, drawPoints: 1, lossPoints: 0 },
        },
      }),
    );
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "season-completed",
    });
  });

  it("skip si des playoffs sont generes", async () => {
    m.matchFind.mockResolvedValue(buildMatch());
    m.roundCount.mockResolvedValue(1);
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "playoffs-generated",
    });
  });

  it("skip si une blessure 'dead' a ete appliquee", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          injuries: [{ teamPlayerId: "p1", type: "dead" }],
        }),
      }),
    );
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "injury-dead",
    });
  });

  it("skip si un level-up issu de ce match a ete consomme", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 0 },
          ]),
        },
      }),
    );
    // p1 a maintenant 1 advancement (> 0 capture) -> consomme.
    m.tpFindMany.mockResolvedValue([
      { id: "p1", advancements: JSON.stringify([{ skillSlug: "block" }]) },
    ]);
    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "advancement-consumed",
    });
  });

  it("reverse les standings (decrement) + eco + supprime + re-ouvre", async () => {
    m.matchFind.mockResolvedValue(buildMatch());

    const r = await reverseOfflineLeagueResult("m-1");
    expect(r).toEqual({ reversed: true, matchId: "m-1", pairingId: "pair-1" });

    // Standings home decrementes (victoire 2-1 -> wins-1, points-3, td...).
    const homeUpd = m.partUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "ph",
    )?.[0] as { data: Record<string, unknown> };
    expect(homeUpd.data.wins).toEqual({ decrement: 1 });
    expect(homeUpd.data.points).toEqual({ decrement: 3 });
    expect(homeUpd.data.touchdownsFor).toEqual({ decrement: 2 });
    expect(homeUpd.data.casualtiesFor).toEqual({ decrement: 3 });

    // Eco : treasury decrement + dedicatedFans restaure a la pre-valeur.
    const homeTeam = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-home",
    )?.[0] as { data: Record<string, unknown> };
    expect(homeTeam.data.treasury).toEqual({ decrement: 50000 });
    expect(homeTeam.data.dedicatedFans).toBe(1);

    // Suppression selections puis match ; pairing + round re-ouverts.
    expect(m.selDelete).toHaveBeenCalledWith({ where: { matchId: "m-1" } });
    expect(m.matchDelete).toHaveBeenCalledWith({ where: { id: "m-1" } });
    expect(m.pairUpdate).toHaveBeenCalledWith({
      where: { id: "pair-1" },
      data: { status: "scheduled" },
    });
    expect(m.roundUpdate).toHaveBeenCalledWith({
      where: { id: "round-1" },
      data: { status: "scheduled" },
    });
  });

  it("reverse le SPP bonus Nuffle et le bonus au classement", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          playerStats: [],
          sppBonus: [{ teamPlayerId: "p1", spp: 4 }],
          rankingBonusHome: 2,
          rankingBonusAway: -1,
        }),
      }),
    );

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    // SPP bonus -> decrement spp du joueur.
    const sppUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p1",
    ) as [{ data: Record<string, unknown> }] | undefined;
    expect(sppUpd![0].data.spp).toEqual({ decrement: 4 });

    // Bonus classement -> decrement points (annule l'increment de la saisie).
    const homeP = m.partUpdate.mock.calls.find(
      (c) =>
        (c[0] as { where: { id: string }; data: Record<string, unknown> }).where
          .id === "ph" &&
        "points" in
          (c[0] as { data: Record<string, unknown> }).data &&
        ((c[0] as { data: { points?: { decrement?: number } } }).data.points
          ?.decrement === 2),
    );
    expect(homeP).toBeTruthy();
  });

  it("reverse le net treasury applique (gains - depenses)", async () => {
    // home : 60k gains - 50k depenses = +10k net applique -> reversion -10k.
    // away : 0 gains - 30k depenses = -30k net applique -> reversion +30k.
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          winningsHome: 60000,
          treasuryDebitHome: 50000,
          winningsAway: 0,
          treasuryDebitAway: 30000,
        }),
      }),
    );

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    const homeTeam = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-home",
    )?.[0] as { data: Record<string, unknown> };
    expect(homeTeam.data.treasury).toEqual({ decrement: 10000 });

    const awayTeam = m.teamUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "team-away",
    )?.[0] as { data: Record<string, unknown> };
    expect(awayTeam.data.treasury).toEqual({ increment: 30000 });
  });

  it("reverse le SPP par joueur (decrement exact) et les blessures", async () => {
    m.matchFind.mockResolvedValue(
      buildMatch({
        offlineResultInput: buildSnapshot({
          playerStats: [{ teamPlayerId: "p1", touchdowns: 1, casualties: 1 }],
          injuries: [{ teamPlayerId: "p2", type: "niggling" }],
        }),
      }),
    );
    m.tpFindMany.mockResolvedValue([{ id: "p1", teamId: "team-home" }]);

    await reverseOfflineLeagueResult("m-1");

    const sppUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p1",
    )?.[0] as { data: Record<string, unknown> };
    expect(sppUpd.data.spp).toEqual({ decrement: 6 }); // mock calculatePlayerSPP
    expect(sppUpd.data.totalTouchdowns).toEqual({ decrement: 1 });
    expect(sppUpd.data.matchesPlayed).toEqual({ decrement: 1 });

    const injUpd = m.tpUpdate.mock.calls.find(
      (c) => (c[0] as { where: { id: string } }).where.id === "p2",
    )?.[0] as { data: Record<string, unknown> };
    expect(injUpd.data).toEqual({
      missNextMatch: false,
      nigglingInjuries: { decrement: 1 },
    });
  });

  it("reverse les achats : supprime les joueurs crees + decremente les compteurs", async () => {
    const snapshot = {
      ...buildSnapshot(),
      rosterMutations: {
        home: {
          createdPlayerIds: ["np-1", "np-2"],
          rerollsAdded: 1,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: true,
          dedicatedFansAdded: 0,
        },
        away: {
          createdPlayerIds: [],
          rerollsAdded: 0,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: false,
          dedicatedFansAdded: 0,
        },
      },
    };
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: snapshot }));
    // Garde-fou achats : les joueurs crees sont intacts (non consommes).
    m.tpFindMany.mockResolvedValue([
      { id: "np-1", spp: 0, matchesPlayed: 0, dead: false, advancements: "[]" },
      { id: "np-2", spp: 0, matchesPlayed: 0, dead: false, advancements: "[]" },
    ]);

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    // Joueurs crees supprimes.
    expect(m.tpDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["np-1", "np-2"] } },
    });
    // Compteurs home decrementes + apothicaire annule (update dedie aux achats).
    const counterUpd = m.teamUpdate.mock.calls.find(
      (c) =>
        (c[0] as { where: { id: string }; data: Record<string, unknown> }).where
          .id === "team-home" &&
        "rerolls" in (c[0] as { data: Record<string, unknown> }).data,
    )?.[0] as { data: Record<string, unknown> };
    expect(counterUpd.data).toEqual({
      rerolls: { decrement: 1 },
      apothecary: false,
    });
  });

  it("refuse la reversion si un joueur achete a deja joue (purchase-consumed)", async () => {
    const snapshot = {
      ...buildSnapshot(),
      rosterMutations: {
        home: {
          createdPlayerIds: ["np-1"],
          rerollsAdded: 0,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: false,
          dedicatedFansAdded: 0,
        },
        away: {
          createdPlayerIds: [],
          rerollsAdded: 0,
          assistantsAdded: 0,
          cheerleadersAdded: 0,
          apothecaryAdded: false,
          dedicatedFansAdded: 0,
        },
      },
    };
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: snapshot }));
    // np-1 a joue un match ulterieur -> consomme.
    m.tpFindMany.mockResolvedValue([
      { id: "np-1", spp: 6, matchesPlayed: 1, dead: false, advancements: "[]" },
    ]);

    expect(await reverseOfflineLeagueResult("m-1")).toEqual({
      skipped: true,
      reason: "purchase-consumed",
    });
    // Aucune suppression : la reversion est refusee avant la transaction.
    expect(m.tpDeleteMany).not.toHaveBeenCalled();
    expect(m.matchDelete).not.toHaveBeenCalled();
  });

  it("reverse les licenciements : re-active firedAt=null + recalcule TV", async () => {
    const snapshot = { ...buildSnapshot(), firedApplied: ["p1", "p2"] };
    m.matchFind.mockResolvedValue(buildMatch({ offlineResultInput: snapshot }));

    const r = await reverseOfflineLeagueResult("m-1");
    expect("reversed" in r && r.reversed).toBe(true);

    // Re-activation des joueurs licencies par ce match.
    expect(m.tpUpdateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p1", "p2"] } },
      data: { firedAt: null },
    });
    // TV recalculee pour les 2 equipes (licenciements touchent home + away).
    expect(m.updateTv).toHaveBeenCalledWith(expect.anything(), "team-home");
    expect(m.updateTv).toHaveBeenCalledWith(expect.anything(), "team-away");
  });
});

describe("editOfflineLeagueResult (W-B3)", () => {
  const recordMock = recordOfflineLeagueResult as MockFn;

  beforeEach(() => {
    vi.clearAllMocks();
    m.roundCount.mockResolvedValue(0);
    m.pairFind.mockResolvedValue(buildPairing());
    m.tpFindMany.mockResolvedValue([]);
    m.partUpdate.mockResolvedValue({});
    m.teamUpdate.mockResolvedValue({});
    m.selDelete.mockResolvedValue({ count: 2 });
    m.matchDelete.mockResolvedValue({});
    m.pairUpdate.mockResolvedValue({});
    m.roundUpdate.mockResolvedValue({});
  });

  it("skip si aucun resultat offline existant pour ce pairing", async () => {
    m.matchFindFirst.mockResolvedValue(null);
    const r = await editOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({ skipped: true, reason: "no-existing-result" });
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("propage le refus de reversion (ex: level-up consomme) sans re-saisir", async () => {
    m.matchFindFirst.mockResolvedValue({ id: "m-1" });
    m.matchFind.mockResolvedValue(
      buildMatch({
        leaguePostMatchSequence: {
          pendingChoices: JSON.stringify([
            { teamPlayerId: "p1", advancementsTaken: 0 },
          ]),
        },
      }),
    );
    m.tpFindMany.mockResolvedValue([
      { id: "p1", advancements: JSON.stringify([{ skillSlug: "block" }]) },
    ]);

    const r = await editOfflineLeagueResult({
      pairingId: "pair-1",
      scoreHome: 1,
      scoreAway: 0,
      casualtiesHome: 0,
      casualtiesAway: 0,
    });
    expect(r).toEqual({ skipped: true, reason: "advancement-consumed" });
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("annule puis re-saisit quand la reversion reussit", async () => {
    m.matchFindFirst.mockResolvedValue({ id: "m-1" });
    m.matchFind.mockResolvedValue(buildMatch());
    recordMock.mockResolvedValue({
      recorded: true,
      pairingId: "pair-1",
      matchId: "m-2",
      winner: "home",
      sppPlayersUpdated: 0,
    });

    const newInput = {
      pairingId: "pair-1",
      scoreHome: 3,
      scoreAway: 3,
      casualtiesHome: 0,
      casualtiesAway: 0,
    };
    const r = await editOfflineLeagueResult(newInput);

    // reversion effectuee (match supprime) PUIS re-saisie avec le nouvel input.
    expect(m.matchDelete).toHaveBeenCalledWith({ where: { id: "m-1" } });
    expect(recordMock).toHaveBeenCalledWith(newInput);
    expect(r).toMatchObject({ recorded: true, matchId: "m-2" });
  });
});
