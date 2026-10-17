import { describe, expect, it } from "vitest";
import {
  leagueResultFromOfflineSnapshot,
  summarizeCompetitionAchievementStats,
} from "./achievement-competition-stats";

function leagueMatch(
  homeTeamId: string | null,
  awayTeamId: string | null,
  scoreHome: number,
  scoreAway: number,
  casualtiesHome = 0,
  casualtiesAway = 0,
) {
  return {
    homeTeamId,
    awayTeamId,
    offlineResultInput: {
      input: { scoreHome, scoreAway, casualtiesHome, casualtiesAway, playerStats: [] },
    },
  };
}

const teams = [
  { id: "T1", roster: "bretonnian" },
  { id: "T2", roster: "orc" },
];

describe("summarizeCompetitionAchievementStats", () => {
  it("additionne chaque résultat de ligue validé (Match offline), côté domicile ou extérieur", () => {
    const stats = summarizeCompetitionAchievementStats({
      teams,
      leagueMatches: [
        leagueMatch("T1", "X", 2, 1, 3, 0),
        leagueMatch("Y", "T1", 1, 1, 0, 1),
        leagueMatch("T2", "Z", 0, 2),
      ],
      cupMatches: [],
    });
    expect(stats).toMatchObject({
      matchesPlayed: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      touchdowns: 3,
      casualties: 4,
    });
    expect([...stats.rostersPlayed].sort()).toEqual(["bretonnian", "orc"]);
    expect(stats.winsByRoster.get("bretonnian")).toBe(1);
    expect(stats.winsByRoster.has("orc")).toBe(false);
  });

  it("ignore un résultat sans score lisible (pas de match prouvé)", () => {
    const stats = summarizeCompetitionAchievementStats({
      teams,
      leagueMatches: [{ homeTeamId: "T1", awayTeamId: "X", offlineResultInput: null }],
      cupMatches: [],
    });
    expect(stats.matchesPlayed).toBe(0);
  });

  it("compte chaque rencontre de coupe matérialisée, côté A ou B", () => {
    const stats = summarizeCompetitionAchievementStats({
      teams,
      leagueMatches: [],
      cupMatches: [
        {
          teamAId: "T1",
          teamBId: "X",
          scoreTeamA: 2,
          scoreTeamB: 1,
          actions: [
            { playerTeam: "A", actionType: "blocage", armorBroken: true, opponentState: "elimine" },
            // Agression : pas une sortie (règle des sorties).
            { playerTeam: "A", actionType: "aggression", armorBroken: true, opponentState: "elimine" },
            // Sortie ADVERSE : pas la nôtre.
            { playerTeam: "B", actionType: "blitz", armorBroken: true, opponentState: "elimine" },
          ],
        },
        { teamAId: "X", teamBId: "T1", scoreTeamA: 1, scoreTeamB: 1, actions: [] },
      ],
    });
    expect(stats).toMatchObject({
      matchesPlayed: 2,
      wins: 1,
      draws: 1,
      losses: 0,
      touchdowns: 3,
      casualties: 1,
    });
    expect(stats.winsByRoster.get("bretonnian")).toBe(1);
  });

  it("ignore les équipes qui ne sont pas au coach et une équipe sans match", () => {
    const stats = summarizeCompetitionAchievementStats({
      teams,
      leagueMatches: [leagueMatch("ETRANGERE", "AUTRE", 5, 0, 3, 0)],
      cupMatches: [
        { teamAId: "X", teamBId: "Y", scoreTeamA: 3, scoreTeamB: 0, actions: [] },
      ],
    });
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.touchdowns).toBe(0);
    expect(stats.rostersPlayed.size).toBe(0);
  });
});

describe("leagueResultFromOfflineSnapshot", () => {
  it("lit score et sorties, objet natif ou chaîne", () => {
    const snap = { input: { scoreHome: 2, scoreAway: 1, casualtiesHome: 3 } };
    expect(leagueResultFromOfflineSnapshot(snap)).toEqual({
      scoreHome: 2,
      scoreAway: 1,
      casualtiesHome: 3,
      casualtiesAway: 0,
    });
    expect(leagueResultFromOfflineSnapshot(JSON.stringify(snap))?.scoreHome).toBe(2);
  });

  it("rend null sans score", () => {
    expect(leagueResultFromOfflineSnapshot(null)).toBeNull();
    expect(leagueResultFromOfflineSnapshot("{oops")).toBeNull();
    expect(leagueResultFromOfflineSnapshot({ input: { scoreHome: 1 } })).toBeNull();
  });
});
