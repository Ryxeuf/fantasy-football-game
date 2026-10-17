import { describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({ prisma: {} }));

import {
  buildPlayerCareerTotals,
  loadCompetitionCareerAdjustments,
  type CareerLoaderDb,
} from "./player-career-loader";

const HOME = "team-home";
const AWAY = "team-away";

function fakeDb(input: {
  players?: unknown[];
  sheets?: unknown[];
  matches?: unknown[];
}): CareerLoaderDb & {
  teamPlayer: { findMany: ReturnType<typeof vi.fn> };
  leagueMatchSheet: { findMany: ReturnType<typeof vi.fn> };
  match: { findMany: ReturnType<typeof vi.fn> };
} {
  return {
    teamPlayer: { findMany: vi.fn(async () => input.players ?? []) },
    leagueMatchSheet: { findMany: vi.fn(async () => input.sheets ?? []) },
    match: { findMany: vi.fn(async () => input.matches ?? []) },
  };
}

const players = [
  { id: "h1", teamId: HOME, number: 1, name: "Bohémond", position: "grail-knight" },
  { id: "h2", teamId: HOME, number: 2, name: "Gauvain", position: "blitzer" },
];

const cupSheet = {
  pairingId: null,
  cupPairingId: "cp-1",
  forfeitSide: null,
  motmPlayerIds: "[]",
  rosterSnapshotHome: JSON.stringify({ players: [{ id: "h1" }, { id: "h2" }] }),
  rosterSnapshotAway: null,
  pairing: null,
  cupPairing: { homeTeamId: HOME, awayTeamId: AWAY },
  events: [{ kind: "touchdown", team: "home", actorPlayerId: "h1", meta: null }],
};

const leagueSheet = {
  pairingId: "lp-1",
  cupPairingId: null,
  forfeitSide: null,
  motmPlayerIds: [],
  rosterSnapshotHome: JSON.stringify({ players: [{ id: "h1" }, { id: "h2" }] }),
  rosterSnapshotAway: null,
  pairing: {
    homeParticipant: { teamId: HOME },
    awayParticipant: { teamId: AWAY },
  },
  cupPairing: null,
  events: [{ kind: "touchdown", team: "home", actorPlayerId: "h1" }],
};

describe("loadCompetitionCareerAdjustments", () => {
  it("ne lit rien sans équipe", async () => {
    const db = fakeDb({});
    expect((await loadCompetitionCareerAdjustments([], db)).size).toBe(0);
    expect(db.leagueMatchSheet.findMany).not.toHaveBeenCalled();
  });

  it("ne lit que les feuilles VALIDÉES des équipes demandées, ligue et coupe", async () => {
    const db = fakeDb({ players });
    await loadCompetitionCareerAdjustments([HOME, HOME], db);
    const args = db.leagueMatchSheet.findMany.mock.calls[0][0] as {
      where: { status: string; OR: unknown[] };
    };
    expect(args.where.status).toBe("validated");
    expect(args.where.OR).toEqual([
      { pairing: { homeParticipant: { teamId: { in: [HOME] } } } },
      { pairing: { awayParticipant: { teamId: { in: [HOME] } } } },
      { cupPairing: { homeTeamId: { in: [HOME] } } },
      { cupPairing: { awayTeamId: { in: [HOME] } } },
    ]);
    // Aucune feuille : pas de lecture des matchs offline.
    expect(db.match.findMany).not.toHaveBeenCalled();
  });

  it("dérive la coupe et le match de ligue d'un joueur sans évènement", async () => {
    const db = fakeDb({
      players,
      sheets: [cupSheet, leagueSheet],
      matches: [
        // Le plus récent fait foi (revalidation).
        {
          leaguePairingId: "lp-1",
          offlineResultInput: { input: { playerStats: [{ teamPlayerId: "h1" }] } },
        },
        {
          leaguePairingId: "lp-1",
          offlineResultInput: { input: { playerStats: [] } },
        },
      ],
    });
    const adjustments = await loadCompetitionCareerAdjustments([HOME], db);
    expect(db.match.findMany.mock.calls[0][0]).toMatchObject({
      where: { leaguePairingId: { in: ["lp-1"] }, leagueScoredAt: { not: null } },
    });
    expect(adjustments.get("h1")).toEqual({
      leagueMatchesNotPersisted: 0,
      cup: {
        matchesPlayed: 1,
        touchdowns: 1,
        casualties: 0,
        completions: 0,
        interceptions: 0,
        mvpAwards: 0,
      },
    });
    expect(adjustments.get("h2")?.leagueMatchesNotPersisted).toBe(1);
    expect(adjustments.get("h2")?.cup.matchesPlayed).toBe(1);
  });
});

describe("buildPlayerCareerTotals", () => {
  it("additionne compteurs persistés et feuilles", async () => {
    const db = fakeDb({ players, sheets: [cupSheet] });
    const totals = await buildPlayerCareerTotals(
      [HOME],
      [{ id: "h1", matchesPlayed: 4, totalTouchdowns: 2, spp: 3 }],
      undefined,
      db,
    );
    expect(totals.get("h1")).toMatchObject({
      matchesPlayed: 5,
      touchdowns: 3,
      spp: 3,
      cup: { matchesPlayed: 1, touchdowns: 1 },
    });
  });

  it("retombe sur les compteurs persistés si les feuilles sont illisibles", async () => {
    const db = fakeDb({ players });
    db.leagueMatchSheet.findMany.mockRejectedValueOnce(new Error("db down"));
    const onError = vi.fn();
    const totals = await buildPlayerCareerTotals(
      [HOME],
      [{ id: "h1", matchesPlayed: 4, totalTouchdowns: 2 }],
      onError,
      db,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(totals.get("h1")).toMatchObject({ matchesPlayed: 4, touchdowns: 2 });
  });
});
