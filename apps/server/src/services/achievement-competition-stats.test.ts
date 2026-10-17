import { describe, expect, it } from "vitest";
import { summarizeCompetitionAchievementStats } from "./achievement-competition-stats";

const teams = [
  { id: "T1", roster: "bretonnian" },
  { id: "T2", roster: "orc" },
];

describe("summarizeCompetitionAchievementStats", () => {
  it("additionne la ligue (compteurs du classement) par équipe", () => {
    const stats = summarizeCompetitionAchievementStats({
      teams,
      leagueSums: [
        { teamId: "T1", _sum: { wins: 3, draws: 1, losses: 2, touchdownsFor: 9, casualtiesFor: 4 } },
        { teamId: "T2", _sum: { wins: 0, draws: 0, losses: 1, touchdownsFor: 1, casualtiesFor: 0 } },
      ],
      cupMatches: [],
    });
    expect(stats).toMatchObject({
      matchesPlayed: 7,
      wins: 3,
      draws: 1,
      losses: 3,
      touchdowns: 10,
      casualties: 4,
    });
    expect([...stats.rostersPlayed].sort()).toEqual(["bretonnian", "orc"]);
    expect(stats.winsByRoster.get("bretonnian")).toBe(3);
    expect(stats.winsByRoster.has("orc")).toBe(false);
  });

  it("compte chaque rencontre de coupe matérialisée, côté A ou B", () => {
    const stats = summarizeCompetitionAchievementStats({
      teams,
      leagueSums: [],
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
      leagueSums: [
        { teamId: "ETRANGERE", _sum: { wins: 5, draws: 0, losses: 0, touchdownsFor: 10, casualtiesFor: 3 } },
        { teamId: "T2", _sum: null },
      ],
      cupMatches: [
        { teamAId: "X", teamBId: "Y", scoreTeamA: 3, scoreTeamB: 0, actions: [] },
      ],
    });
    expect(stats.matchesPlayed).toBe(0);
    expect(stats.touchdowns).toBe(0);
    expect(stats.rostersPlayed.size).toBe(0);
  });
});
