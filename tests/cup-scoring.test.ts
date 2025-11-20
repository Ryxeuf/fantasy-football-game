import {
  computeCupStandings,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "../apps/server/src/cupScoring";

describe("computeCupStandings", () => {
  it("calcule les points et le classement d'une coupe simple", () => {
    const cup: CupWithParticipantsAndScoring = {
      id: "cup1",
      name: "Kraken Cup Test",
      winPoints: 1000,
      drawPoints: 400,
      lossPoints: 0,
      forfeitPoints: -100,
      touchdownPoints: 5,
      blockCasualtyPoints: 3,
      foulCasualtyPoints: 2,
      passPoints: 2,
      participants: [
        {
          team: {
            id: "teamA",
            name: "Hollywood Slashers",
            roster: "orc",
          },
        },
        {
          team: {
            id: "teamB",
            name: "Black Fang",
            roster: "human",
          },
        },
      ],
    };

    const matches: LocalMatchWithRelations[] = [
      {
        id: "match1",
        status: "completed",
        teamA: {
          id: "teamA",
          name: "Hollywood Slashers",
          roster: "orc",
        },
        teamB: {
          id: "teamB",
          name: "Black Fang",
          roster: "human",
        },
        scoreTeamA: 2,
        scoreTeamB: 1,
        actions: [
          {
            actionType: "passe",
            playerTeam: "A",
            armorBroken: false,
            opponentState: null,
          },
          {
            actionType: "blocage",
            playerTeam: "A",
            armorBroken: true,
            opponentState: "elimine",
          },
          {
            actionType: "aggression",
            playerTeam: "B",
            armorBroken: true,
            opponentState: "elimine",
          },
        ],
      },
    ];

    const { scoringConfig, teamStats } = computeCupStandings(cup, matches);

    expect(scoringConfig.winPoints).toBe(1000);
    expect(teamStats).toHaveLength(2);

    const first = teamStats[0];
    const second = teamStats[1];

    // Équipe A gagne 2-1, avec 1 passe et 1 sortie sur bloc
    expect(first.teamId).toBe("teamA");
    expect(first.matchesPlayed).toBe(1);
    expect(first.wins).toBe(1);
    expect(first.draws).toBe(0);
    expect(first.losses).toBe(0);
    expect(first.touchdownsFor).toBe(2);
    expect(first.touchdownsAgainst).toBe(1);
    expect(first.touchdownDiff).toBe(1);
    expect(first.passes).toBe(1);
    expect(first.blockCasualties).toBe(1);
    expect(first.foulCasualties).toBe(0);

    const expectedResultPointsA = 1 * 1000;
    const expectedActionPointsA = 2 * 5 + 1 * 3 + 0 * 2 + 1 * 2; // TD + sorties bloc + agressions + passes
    expect(first.resultPoints).toBe(expectedResultPointsA);
    expect(first.actionPoints).toBe(expectedActionPointsA);
    expect(first.totalPoints).toBe(expectedResultPointsA + expectedActionPointsA);

    // Équipe B perd 1-2 et fait une sortie sur agression
    expect(second.teamId).toBe("teamB");
    expect(second.matchesPlayed).toBe(1);
    expect(second.wins).toBe(0);
    expect(second.draws).toBe(0);
    expect(second.losses).toBe(1);
    expect(second.touchdownsFor).toBe(1);
    expect(second.touchdownsAgainst).toBe(2);
    expect(second.touchdownDiff).toBe(-1);
    expect(second.passes).toBe(0);
    expect(second.blockCasualties).toBe(0);
    expect(second.foulCasualties).toBe(1);

    const expectedResultPointsB = 0; // défaite
    const expectedActionPointsB = 1 * 5 + 0 * 3 + 1 * 2 + 0 * 2;
    expect(second.resultPoints).toBe(expectedResultPointsB);
    expect(second.actionPoints).toBe(expectedActionPointsB);
    expect(second.totalPoints).toBe(expectedResultPointsB + expectedActionPointsB);
  });
});
