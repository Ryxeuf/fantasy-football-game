import { describe, it, expect } from "vitest";
import {
  computeCupStandings,
  type CupWithParticipantsAndScoring,
  type LocalMatchWithRelations,
} from "./cupScoring";

const TEAMS = [
  { id: "t1", name: "Orques de Gouffre", roster: "orc" },
  { id: "t2", name: "Elfes Noirs", roster: "dark_elf" },
];

function cup(
  tieBreakRules?: unknown,
): CupWithParticipantsAndScoring {
  return {
    id: "cup-1",
    name: "Coupe",
    // Barème neutre : seules les victoires font des points, pour que le
    // départage soit ce que le test observe.
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    forfeitPoints: 0,
    touchdownPoints: 0,
    blockCasualtyPoints: 0,
    foulCasualtyPoints: 0,
    passPoints: 0,
    ...(tieBreakRules === undefined ? {} : { tieBreakRules }),
    participants: TEAMS.map((team) => ({ team })),
  };
}

/** Match nul 1-1 où l'équipe A sort un joueur au contact. */
const DRAW_WITH_ONE_CASUALTY_FOR_A: LocalMatchWithRelations = {
  id: "m1",
  status: "completed",
  teamA: TEAMS[0],
  teamB: TEAMS[1],
  scoreTeamA: 1,
  scoreTeamB: 1,
  actions: [
    {
      actionType: "blocage",
      playerTeam: "A",
      armorBroken: true,
      opponentState: "elimine",
    },
  ],
};

describe("computeCupStandings — critères de départage", () => {
  it("garde l'ordre historique quand la coupe ne configure rien", () => {
    // Égalité parfaite (1-1, mêmes points, même diff) : le nom tranche.
    const out = computeCupStandings(cup(), [DRAW_WITH_ONE_CASUALTY_FOR_A]);
    expect(out.teamStats.map((s) => s.teamName)).toEqual([
      "Elfes Noirs",
      "Orques de Gouffre",
    ]);
  });

  it("applique les critères configurés (départage à la BASH)", () => {
    const out = computeCupStandings(cup('["points","cas_for"]'), [
      DRAW_WITH_ONE_CASUALTY_FOR_A,
    ]);
    expect(out.teamStats.map((s) => s.teamName)).toEqual([
      "Orques de Gouffre",
      "Elfes Noirs",
    ]);
  });

  it("lit aussi un tableau natif (colonne PostgreSQL déjà désérialisée)", () => {
    const out = computeCupStandings(cup(["points", "cas_for"]), [
      DRAW_WITH_ONE_CASUALTY_FOR_A,
    ]);
    expect(out.teamStats[0].teamName).toBe("Orques de Gouffre");
  });

  it("retombe sur l'ordre historique si la colonne est illisible", () => {
    for (const raw of ["{oops", '["inconnu"]', null, 42]) {
      const out = computeCupStandings(cup(raw), [
        DRAW_WITH_ONE_CASUALTY_FOR_A,
      ]);
      expect(out.teamStats[0].teamName).toBe("Elfes Noirs");
    }
  });

  it("les points priment toujours sur le critère suivant", () => {
    const win: LocalMatchWithRelations = {
      ...DRAW_WITH_ONE_CASUALTY_FOR_A,
      scoreTeamA: 0,
      scoreTeamB: 2,
    };
    // A sort un joueur mais perd : `cas_for` ne doit pas le faire passer
    // devant, il n'intervient qu'à égalité de points.
    const out = computeCupStandings(cup('["points","cas_for"]'), [win]);
    expect(out.teamStats[0].teamName).toBe("Elfes Noirs");
  });
});
