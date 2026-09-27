import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn() },
    competitionPrediction: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  computeSeasonPredictionLeaderboard,
  computeUserPredictionStats,
  isLeagueMember,
  isMember,
  membershipOf,
} from "./league-predictions-core";

type MockFn = ReturnType<typeof vi.fn>;
const db = prisma as unknown as {
  leagueSeason: { findUnique: MockFn };
  competitionPrediction: { findMany: MockFn };
};

const COMMISH = "commish";
const HOME_COACH = "coach-home";
const OTHER_COACH = "coach-other";
const RETIRED = "coach-retired";
const FAN = "fan";

function leaderboardSeason() {
  return {
    id: "season-1",
    league: {
      id: "league-1",
      creatorId: COMMISH,
      isPublic: true,
      status: "in_progress",
      predictionsScope: "members",
    },
    participants: [
      { status: "active", team: { ownerId: HOME_COACH } },
      { status: "active", team: { ownerId: OTHER_COACH } },
      { status: "withdrawn", team: { ownerId: RETIRED } },
    ],
  };
}

function boardRow(userId: string, grade: "exact" | "outcome" | "wrong") {
  const exact = grade === "exact";
  return {
    userId,
    pick: grade === "wrong" ? "away" : "home",
    homeScore: exact ? 2 : null,
    awayScore: exact ? 0 : null,
    result: "home",
    resultHomeScore: 2,
    resultAwayScore: 0,
    user: { coachName: userId.toUpperCase(), privateProfile: false },
    pairing: { status: "played" },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("appartenance", () => {
  const m = membershipOf(leaderboardSeason());

  it("tient pour membres le commissaire et les coachs ACTIFS", () => {
    expect(isMember(m, COMMISH)).toBe(true);
    expect(isMember(m, HOME_COACH)).toBe(true);
    expect(isMember(m, RETIRED)).toBe(false);
    expect(isMember(m, FAN)).toBe(false);
    expect(isMember(m, null)).toBe(false);
  });

  it("nomme tout coach de la saison, retiré compris", () => {
    expect(isLeagueMember(m, RETIRED)).toBe(true);
    expect(isLeagueMember(m, FAN)).toBe(false);
  });
});

describe("computeSeasonPredictionLeaderboard", () => {
  it("classe une saison sans lecteur, sans anonymiser", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(leaderboardSeason());
    db.competitionPrediction.findMany.mockResolvedValueOnce([
      boardRow(OTHER_COACH, "exact"),
      {
        ...boardRow(FAN, "outcome"),
        user: { coachName: "Fan", privateProfile: true },
      },
    ]);
    const board = await computeSeasonPredictionLeaderboard("season-1");
    expect(board.coach.map((e) => [e.userId, e.points])).toEqual([
      [OTHER_COACH, 5],
    ]);
    // Profil privé : anonyme pour un client, mais ce classement-ci ne sort
    // pas vers un client et le palmarès ne retient que les coachs.
    expect(board.stands.map((e) => e.userId)).toEqual([FAN]);
  });

  it("rend un classement vide pour une saison inconnue", async () => {
    db.leagueSeason.findUnique.mockResolvedValueOnce(null);
    await expect(computeSeasonPredictionLeaderboard("x")).resolves.toEqual({
      coach: [],
      stands: [],
    });
  });
});

describe("computeUserPredictionStats", () => {
  it("compte bons résultats, scores exacts et titres des saisons clôturées", async () => {
    db.competitionPrediction.findMany.mockResolvedValueOnce([
      {
        ...boardRow(OTHER_COACH, "exact"),
        pairing: { status: "played", round: { seasonId: "s-done", season: { status: "completed" } } },
      },
      {
        ...boardRow(OTHER_COACH, "outcome"),
        pairing: { status: "played", round: { seasonId: "s-live", season: { status: "in_progress" } } },
      },
      {
        ...boardRow(OTHER_COACH, "wrong"),
        pairing: { status: "played", round: { seasonId: "s-live", season: { status: "in_progress" } } },
      },
    ]);
    // Classement de la saison clôturée : il y est premier des coachs.
    db.leagueSeason.findUnique.mockResolvedValueOnce(leaderboardSeason());
    db.competitionPrediction.findMany.mockResolvedValueOnce([
      boardRow(OTHER_COACH, "exact"),
      boardRow(HOME_COACH, "outcome"),
    ]);
    await expect(computeUserPredictionStats(OTHER_COACH)).resolves.toEqual({
      correct: 2,
      exact: 1,
      oracleTitles: 1,
      standsOracleTitles: 0,
    });
  });
});
