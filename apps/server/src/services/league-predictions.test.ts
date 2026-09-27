import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: { findUnique: vi.fn(), update: vi.fn() },
    leagueSeason: { findUnique: vi.fn() },
    leagueRound: { findUnique: vi.fn(), updateMany: vi.fn() },
    leaguePairing: { findUnique: vi.fn(), updateMany: vi.fn() },
    leagueParticipant: { count: vi.fn() },
    competitionPrediction: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));
vi.mock("./league-access", () => ({ canViewLeagueRow: vi.fn() }));
vi.mock("./league-playoffs", () => ({
  isPlayoffBracketVisible: (published: boolean | null | undefined) =>
    published !== false,
}));
vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from "../prisma";
import { canViewLeagueRow } from "./league-access";
import {
  LeaguePredictionError,
  closePairingPredictions,
  closeRoundPredictions,
  deletePrediction,
  getSeasonPredictionLeaderboard,
  getSeasonPredictions,
  setLeaguePredictionsScope,
  upsertPrediction,
} from "./league-predictions";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  league: { findUnique: MockFn; update: MockFn };
  leagueSeason: { findUnique: MockFn };
  leagueRound: { findUnique: MockFn; updateMany: MockFn };
  leaguePairing: { findUnique: MockFn; updateMany: MockFn };
  leagueParticipant: { count: MockFn };
  competitionPrediction: {
    upsert: MockFn;
    deleteMany: MockFn;
    updateMany: MockFn;
    findMany: MockFn;
  };
};
const canView = canViewLeagueRow as unknown as MockFn;

const NOW = new Date("2026-10-01T12:00:00Z");
const PAST = new Date("2026-09-30T12:00:00Z");
const FUTURE = new Date("2026-10-05T12:00:00Z");

const COMMISH = "commish";
const HOME_COACH = "coach-home";
const AWAY_COACH = "coach-away";
const OTHER_COACH = "coach-other";
const FAN = "fan";
const RETIRED = "coach-retired";

function league(overrides: Record<string, unknown> = {}) {
  return {
    id: "league-1",
    creatorId: COMMISH,
    isPublic: true,
    status: "in_progress",
    predictionsScope: "members",
    ...overrides,
  };
}

function participant(id: string, ownerId: string, name: string) {
  return {
    id,
    teamId: `team-${id}`,
    team: {
      id: `team-${id}`,
      name,
      roster: "skaven",
      logoUrl: null,
      ownerId,
      owner: { coachName: `Coach ${name}` },
    },
  };
}

function prediction(userId: string, overrides: Record<string, unknown> = {}) {
  return {
    userId,
    pick: "home",
    homeScore: null,
    awayScore: null,
    result: null,
    resultHomeScore: null,
    resultAwayScore: null,
    user: { coachName: userId.toUpperCase(), privateProfile: false },
    ...overrides,
  };
}

function pairingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pairing-1",
    status: "scheduled",
    scheduledAt: null,
    predictionsClosedAt: null,
    homeParticipantId: "p-home",
    awayParticipantId: "p-away",
    homeParticipant: participant("p-home", HOME_COACH, "Rats"),
    awayParticipant: participant("p-away", AWAY_COACH, "Lézards"),
    matchSheet: null,
    predictions: [] as unknown[],
    ...overrides,
  };
}

function seasonRow(overrides: {
  league?: Record<string, unknown>;
  rounds?: unknown[];
  playoffsPublished?: boolean | null;
} = {}) {
  return {
    id: "season-1",
    status: "in_progress",
    playoffsPublished: overrides.playoffsPublished ?? null,
    league: league(overrides.league),
    participants: [
      { status: "active", team: { ownerId: HOME_COACH } },
      { status: "active", team: { ownerId: AWAY_COACH } },
      { status: "active", team: { ownerId: OTHER_COACH } },
      { status: "withdrawn", team: { ownerId: RETIRED } },
    ],
    rounds: overrides.rounds ?? [
      {
        id: "round-1",
        roundNumber: 1,
        name: "Journée 1",
        status: "in_progress",
        kind: "regular",
        bracketSlot: null,
        startDate: null,
        pairings: [pairingRow()],
      },
    ],
  };
}

function viewer(userId: string | null, isAdmin = false) {
  return { userId, isAdmin };
}

beforeEach(() => {
  vi.resetAllMocks();
  canView.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------

describe("getSeasonPredictions", () => {
  it("répond saison introuvable quand la ligue est invisible au lecteur", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(seasonRow());
    canView.mockResolvedValueOnce(false);
    await expect(
      getSeasonPredictions({ seasonId: "season-1", viewer: viewer("x"), now: NOW }),
    ).rejects.toMatchObject({ code: "season_not_found" });
  });

  it("ne sert aucune journée quand les pronostics sont coupés (ligue antérieure)", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(
      seasonRow({ league: { predictionsScope: null } }),
    );
    const view = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(COMMISH),
      now: NOW,
    });
    expect(view.scope).toBe("off");
    expect(view.scopeConfigured).toBe(false);
    expect(view.rounds).toEqual([]);
    expect(view.viewer.isCommissioner).toBe(true);
  });

  it("ne livre RIEN des pronostics des autres sur une rencontre ouverte", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(
      seasonRow({
        rounds: [
          {
            id: "round-1",
            roundNumber: 1,
            name: null,
            status: "in_progress",
            kind: "regular",
            bracketSlot: null,
            startDate: null,
            pairings: [
              pairingRow({
                scheduledAt: FUTURE,
                predictions: [
                  prediction(OTHER_COACH, { pick: "away" }),
                  prediction(COMMISH, { pick: "home", homeScore: 2, awayScore: 0 }),
                ],
              }),
            ],
          },
        ],
      }),
    );
    const view = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(OTHER_COACH),
      now: NOW,
    });
    const pairing = view.rounds[0].pairings[0];
    expect(pairing.closed).toBe(false);
    expect(pairing.predictions).toBeNull();
    expect(pairing.distribution).toBeNull();
    expect(pairing.myPrediction).toMatchObject({ pick: "away", grade: "pending" });
    expect(pairing.eligibility).toBe("ok");
    expect(JSON.stringify(view)).not.toContain(COMMISH.toUpperCase());
  });

  it("livre tous les pronostics, notés, une fois la rencontre jouée", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(
      seasonRow({
        rounds: [
          {
            id: "round-1",
            roundNumber: 1,
            name: null,
            status: "completed",
            kind: "regular",
            bracketSlot: null,
            startDate: null,
            pairings: [
              pairingRow({
                status: "played",
                predictions: [
                  prediction(OTHER_COACH, {
                    pick: "home",
                    homeScore: 2,
                    awayScore: 0,
                    result: "home",
                    resultHomeScore: 2,
                    resultAwayScore: 0,
                  }),
                  prediction(FAN, {
                    pick: "away",
                    result: "home",
                    resultHomeScore: 2,
                    resultAwayScore: 0,
                    user: { coachName: "Fan", privateProfile: true },
                  }),
                ],
              }),
            ],
          },
        ],
      }),
    );
    const view = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(OTHER_COACH),
      now: NOW,
    });
    const pairing = view.rounds[0].pairings[0];
    expect(pairing.closed).toBe(true);
    expect(pairing.result).toEqual({ outcome: "home", homeScore: 2, awayScore: 0 });
    expect(pairing.distribution).toEqual({ home: 1, draw: 0, away: 1, total: 2 });
    expect(pairing.predictions).toEqual([
      expect.objectContaining({
        userId: OTHER_COACH,
        grade: "exact",
        points: 5,
        group: "coach",
        isViewer: true,
      }),
      expect.objectContaining({
        userId: FAN,
        displayName: "Coach anonyme",
        grade: "wrong",
        group: "stands",
      }),
    ]);
  });

  it("explique pourquoi un lecteur ne peut pas pronostiquer", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(seasonRow());
    const own = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(HOME_COACH),
      now: NOW,
    });
    expect(own.rounds[0].pairings[0].eligibility).toBe("own-match");
    expect(own.rounds[0].pairings[0].canClose).toBe(true);

    const fan = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(FAN),
      now: NOW,
    });
    expect(fan.rounds[0].pairings[0].eligibility).toBe("not-member");
    expect(fan.rounds[0].pairings[0].canClose).toBe(false);
    expect(fan.viewer.group).toBe("stands");

    const retired = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(RETIRED),
      now: NOW,
    });
    expect(retired.rounds[0].pairings[0].eligibility).toBe("not-member");

    const anonymous = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(null),
      now: NOW,
    });
    expect(anonymous.rounds[0].pairings[0].eligibility).toBe("anonymous");
    expect(anonymous.viewer.group).toBeNull();
  });

  it("masque une journée de play-off non publiée, sauf au commissaire qui la voit fermée", async () => {
    const rounds = [
      {
        id: "po-1",
        roundNumber: 5,
        name: "Demi-finale",
        status: "pending",
        kind: "playoff",
        bracketSlot: "sf1",
        startDate: null,
        pairings: [pairingRow({ id: "po-pairing" })],
      },
    ];
    db.leagueSeason.findUnique.mockResolvedValue(
      seasonRow({ rounds, playoffsPublished: false }),
    );
    const coach = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(OTHER_COACH),
      now: NOW,
    });
    expect(coach.rounds).toEqual([]);

    const commish = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(COMMISH),
      now: NOW,
    });
    expect(commish.rounds).toHaveLength(1);
    expect(commish.rounds[0].pairings[0].closed).toBe(true);
    expect(commish.rounds[0].canClose).toBe(false);
  });

  it("lit le résultat sur la feuille validée quand personne n'a pronostiqué", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(
      seasonRow({
        rounds: [
          {
            id: "round-1",
            roundNumber: 1,
            name: null,
            status: "completed",
            kind: "regular",
            bracketSlot: null,
            startDate: null,
            pairings: [
              pairingRow({
                status: "played",
                matchSheet: { status: "validated", scoreHome: 1, scoreAway: 1 },
              }),
              pairingRow({ id: "pairing-2", status: "forfeit_home" }),
            ],
          },
        ],
      }),
    );
    const view = await getSeasonPredictions({
      seasonId: "season-1",
      viewer: viewer(OTHER_COACH),
      now: NOW,
    });
    expect(view.rounds[0].pairings[0].result).toEqual({
      outcome: "draw",
      homeScore: 1,
      awayScore: 1,
    });
    expect(view.rounds[0].pairings[1].result).toEqual({
      outcome: "void",
      homeScore: null,
      awayScore: null,
    });
  });
});

// ---------------------------------------------------------------------------

function pairingContext(overrides: Record<string, unknown> = {}) {
  return {
    id: "pairing-1",
    status: "scheduled",
    scheduledAt: null,
    predictionsClosedAt: null,
    homeParticipantId: "p-home",
    awayParticipantId: "p-away",
    homeParticipant: { team: { ownerId: HOME_COACH } },
    awayParticipant: { team: { ownerId: AWAY_COACH } },
    round: {
      id: "round-1",
      kind: "regular",
      bracketSlot: null,
      season: {
        id: "season-1",
        playoffsPublished: null,
        league: league((overrides.league as Record<string, unknown>) ?? {}),
      },
    },
    ...overrides,
  };
}

describe("upsertPrediction", () => {
  it("enregistre le pronostic d'un coach sur la rencontre des autres", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    db.leagueParticipant.count.mockResolvedValueOnce(1);
    db.competitionPrediction.upsert.mockResolvedValueOnce({});
    const out = await upsertPrediction({
      pairingId: "pairing-1",
      viewer: { userId: OTHER_COACH },
      pick: "home",
      homeScore: 2,
      awayScore: 1,
      now: NOW,
    });
    expect(out).toEqual({ pick: "home", homeScore: 2, awayScore: 1 });
    expect(db.competitionPrediction.upsert).toHaveBeenCalledWith({
      where: { pairingId_userId: { pairingId: "pairing-1", userId: OTHER_COACH } },
      create: {
        pairingId: "pairing-1",
        userId: OTHER_COACH,
        pick: "home",
        homeScore: 2,
        awayScore: 1,
      },
      update: { pick: "home", homeScore: 2, awayScore: 1 },
    });
    expect(db.leagueParticipant.count).toHaveBeenCalledWith({
      where: {
        seasonId: "season-1",
        status: "active",
        team: { ownerId: OTHER_COACH },
      },
    });
  });

  it("laisse pronostiquer le commissaire sans équipe", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    db.competitionPrediction.upsert.mockResolvedValueOnce({});
    await upsertPrediction({
      pairingId: "pairing-1",
      viewer: { userId: COMMISH },
      pick: "draw",
      now: NOW,
    });
    expect(db.leagueParticipant.count).not.toHaveBeenCalled();
    expect(db.competitionPrediction.upsert).toHaveBeenCalled();
  });

  it("répond rencontre introuvable sur une ligue invisible", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    canView.mockResolvedValueOnce(false);
    await expect(
      upsertPrediction({
        pairingId: "pairing-1",
        viewer: { userId: FAN },
        pick: "home",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "pairing_not_found" });
    expect(db.competitionPrediction.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["pronostics coupés", { league: { predictionsScope: "off" } }, OTHER_COACH, 1, "predictions_off"],
    ["ligue antérieure", { league: { predictionsScope: null } }, OTHER_COACH, 1, "predictions_off"],
    ["spectateur en portée membres", {}, FAN, 0, "not_member"],
    ["sa propre rencontre", {}, HOME_COACH, 1, "own_match"],
    ["placeholder de bracket", { awayParticipantId: "p-home" }, OTHER_COACH, 1, "placeholder"],
    ["clôture posée", { predictionsClosedAt: PAST }, OTHER_COACH, 1, "closed"],
    ["date prévue passée", { scheduledAt: PAST }, OTHER_COACH, 1, "closed"],
    ["rencontre jouée", { status: "played" }, OTHER_COACH, 1, "closed"],
    ["ligue archivée", { league: { status: "archived" } }, OTHER_COACH, 1, "closed"],
  ])("refuse : %s", async (_label, overrides, userId, count, code) => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext(overrides));
    db.leagueParticipant.count.mockResolvedValueOnce(count);
    await expect(
      upsertPrediction({
        pairingId: "pairing-1",
        viewer: { userId },
        pick: "home",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code });
    expect(db.competitionPrediction.upsert).not.toHaveBeenCalled();
  });

  it("ouvre la portée `open` à un spectateur", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(
      pairingContext({ league: { predictionsScope: "open" } }),
    );
    db.competitionPrediction.upsert.mockResolvedValueOnce({});
    await upsertPrediction({
      pairingId: "pairing-1",
      viewer: { userId: FAN },
      pick: "away",
      now: NOW,
    });
    expect(db.competitionPrediction.upsert).toHaveBeenCalled();
  });

  it("refuse un score incohérent avec le vainqueur", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    db.leagueParticipant.count.mockResolvedValueOnce(1);
    const err = await upsertPrediction({
      pairingId: "pairing-1",
      viewer: { userId: OTHER_COACH },
      pick: "away",
      homeScore: 2,
      awayScore: 1,
      now: NOW,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LeaguePredictionError);
    expect(err).toMatchObject({ code: "invalid_prediction" });
    expect((err as Error).message).toContain("vainqueur");
  });
});

describe("deletePrediction", () => {
  it("retire son pronostic tant que la rencontre est ouverte", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    db.competitionPrediction.deleteMany.mockResolvedValueOnce({ count: 1 });
    await expect(
      deletePrediction({ pairingId: "pairing-1", viewer: { userId: OTHER_COACH }, now: NOW }),
    ).resolves.toEqual({ deleted: true });
    expect(db.competitionPrediction.deleteMany).toHaveBeenCalledWith({
      where: { pairingId: "pairing-1", userId: OTHER_COACH },
    });
  });

  it("refuse une rencontre fermée, et un pronostic absent", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(
      pairingContext({ predictionsClosedAt: PAST }),
    );
    await expect(
      deletePrediction({ pairingId: "pairing-1", viewer: { userId: OTHER_COACH }, now: NOW }),
    ).rejects.toMatchObject({ code: "closed" });

    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    db.competitionPrediction.deleteMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      deletePrediction({ pairingId: "pairing-1", viewer: { userId: OTHER_COACH }, now: NOW }),
    ).rejects.toMatchObject({ code: "prediction_not_found" });
  });
});

// ---------------------------------------------------------------------------

describe("setLeaguePredictionsScope", () => {
  it("laisse le commissaire régler la portée, sans consulter le verrou", async () => {
    db.league.findUnique.mockResolvedValueOnce(league());
    db.league.update.mockResolvedValueOnce({});
    await expect(
      setLeaguePredictionsScope({
        leagueId: "league-1",
        viewer: { userId: COMMISH },
        scope: "open",
      }),
    ).resolves.toEqual({ predictionsScope: "open" });
    expect(db.league.update).toHaveBeenCalledWith({
      where: { id: "league-1" },
      data: { predictionsScope: "open" },
    });
  });

  it("l'ouvre aussi à un administrateur", async () => {
    db.league.findUnique.mockResolvedValueOnce(league());
    db.league.update.mockResolvedValueOnce({});
    await setLeaguePredictionsScope({
      leagueId: "league-1",
      viewer: { userId: "admin-1", isAdmin: true },
      scope: "off",
    });
    expect(db.league.update).toHaveBeenCalled();
  });

  it("refuse un coach (403) et cache une ligue invisible (404)", async () => {
    db.league.findUnique.mockResolvedValueOnce(league());
    await expect(
      setLeaguePredictionsScope({
        leagueId: "league-1",
        viewer: { userId: OTHER_COACH },
        scope: "open",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    db.league.findUnique.mockResolvedValueOnce(league({ isPublic: false }));
    canView.mockResolvedValueOnce(false);
    await expect(
      setLeaguePredictionsScope({
        leagueId: "league-1",
        viewer: { userId: FAN },
        scope: "open",
      }),
    ).rejects.toMatchObject({ code: "league_not_found" });
    expect(db.league.update).not.toHaveBeenCalled();
  });
});

describe("clôtures manuelles", () => {
  it("un coach de la rencontre la ferme (coup d'envoi)", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    db.leaguePairing.updateMany.mockResolvedValueOnce({ count: 1 });
    await expect(
      closePairingPredictions({
        pairingId: "pairing-1",
        viewer: { userId: AWAY_COACH },
        now: NOW,
      }),
    ).resolves.toEqual({ closedAt: NOW });
    expect(db.leaguePairing.updateMany).toHaveBeenCalledWith({
      where: { id: "pairing-1", predictionsClosedAt: null },
      data: { predictionsClosedAt: NOW },
    });
  });

  it("garde la première clôture et refuse un tiers", async () => {
    db.leaguePairing.findUnique.mockResolvedValueOnce(
      pairingContext({ predictionsClosedAt: PAST }),
    );
    await expect(
      closePairingPredictions({ pairingId: "pairing-1", viewer: { userId: COMMISH }, now: NOW }),
    ).resolves.toEqual({ closedAt: PAST });
    expect(db.leaguePairing.updateMany).not.toHaveBeenCalled();

    db.leaguePairing.findUnique.mockResolvedValueOnce(pairingContext());
    await expect(
      closePairingPredictions({ pairingId: "pairing-1", viewer: { userId: OTHER_COACH }, now: NOW }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("le commissaire ferme une journée entière, pas un coach", async () => {
    db.leagueRound.findUnique.mockResolvedValue({
      id: "round-1",
      season: { league: league() },
    });
    db.leaguePairing.updateMany.mockResolvedValueOnce({ count: 3 });
    await expect(
      closeRoundPredictions({ roundId: "round-1", viewer: { userId: COMMISH }, now: NOW }),
    ).resolves.toEqual({ closed: 3 });
    expect(db.leaguePairing.updateMany).toHaveBeenCalledWith({
      where: { roundId: "round-1", predictionsClosedAt: null },
      data: { predictionsClosedAt: NOW },
    });

    await expect(
      closeRoundPredictions({ roundId: "round-1", viewer: { userId: HOME_COACH }, now: NOW }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

function leaderboardSeason(overrides: Record<string, unknown> = {}) {
  return {
    id: "season-1",
    league: league(overrides),
    participants: [
      { status: "active", team: { ownerId: HOME_COACH } },
      { status: "active", team: { ownerId: OTHER_COACH } },
      { status: "withdrawn", team: { ownerId: RETIRED } },
    ],
  };
}

function boardRow(userId: string, grade: "exact" | "outcome" | "wrong", status = "played") {
  const pick = grade === "wrong" ? "away" : "home";
  const exact = grade === "exact";
  return {
    ...prediction(userId, {
      pick,
      homeScore: exact ? 2 : null,
      awayScore: exact ? 0 : null,
      result: "home",
      resultHomeScore: 2,
      resultAwayScore: 0,
    }),
    pairing: { status },
  };
}

describe("getSeasonPredictionLeaderboard", () => {
  it("sépare les coachs actifs des tribunes (commissaire, retiré, spectateurs)", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(leaderboardSeason());
    db.competitionPrediction.findMany.mockResolvedValueOnce([
      boardRow(OTHER_COACH, "exact"),
      boardRow(HOME_COACH, "outcome"),
      boardRow(COMMISH, "outcome"),
      boardRow(RETIRED, "exact"),
      boardRow(FAN, "wrong"),
    ]);
    const board = await getSeasonPredictionLeaderboard({
      seasonId: "season-1",
      viewer: viewer(HOME_COACH),
    });
    expect(board.coach.map((e) => [e.userId, e.rank, e.points, e.isViewer])).toEqual([
      [OTHER_COACH, 1, 5, false],
      [HOME_COACH, 2, 3, true],
    ]);
    expect(board.stands.map((e) => e.userId)).toEqual([RETIRED, COMMISH, FAN]);
  });

  it("est vide quand les pronostics sont coupés, introuvable quand la ligue est invisible", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(
      leaderboardSeason({ predictionsScope: "off" }),
    );
    db.competitionPrediction.findMany.mockResolvedValueOnce([
      boardRow(OTHER_COACH, "exact"),
    ]);
    await expect(
      getSeasonPredictionLeaderboard({ seasonId: "season-1", viewer: viewer(COMMISH) }),
    ).resolves.toEqual({ seasonId: "season-1", scope: "off", coach: [], stands: [] });

    db.leagueSeason.findUnique.mockResolvedValueOnce(leaderboardSeason());
    db.competitionPrediction.findMany.mockResolvedValueOnce([]);
    canView.mockResolvedValueOnce(false);
    await expect(
      getSeasonPredictionLeaderboard({ seasonId: "season-1", viewer: viewer(FAN) }),
    ).rejects.toMatchObject({ code: "season_not_found" });
  });
});
