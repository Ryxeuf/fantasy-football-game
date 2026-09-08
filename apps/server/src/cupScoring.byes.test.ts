/**
 * Exempts de ronde suisse dans le classement de coupe : les points d'une
 * victoire, sans match joué ni TD ; une équipe inconnue est ignorée.
 */
import { describe, it, expect } from "vitest";
import { computeCupStandings } from "./cupScoring";

const cup = {
  id: "cup",
  name: "Swiss Cup",
  winPoints: 1000,
  drawPoints: 400,
  lossPoints: 0,
  forfeitPoints: -100,
  touchdownPoints: 5,
  blockCasualtyPoints: 3,
  foulCasualtyPoints: 2,
  passPoints: 2,
  participants: [
    { team: { id: "a", name: "A", roster: "orc" } },
    { team: { id: "b", name: "B", roster: "skaven" } },
    { team: { id: "c", name: "C", roster: "lizardmen" } },
  ],
};

describe("computeCupStandings — exempts", () => {
  it("compte un exempt comme les points d'une victoire", () => {
    const { teamStats } = computeCupStandings(cup, [], { byesByTeamId: { c: 1, zz: 4 } });
    const c = teamStats.find((t) => t.teamId === "c")!;
    expect(c.byes).toBe(1);
    expect(c.matchesPlayed).toBe(0);
    expect(c.wins).toBe(0);
    expect(c.resultPoints).toBe(1000);
    expect(c.totalPoints).toBe(1000);
    // L'exempt classe C devant les équipes sans point.
    expect(teamStats[0].teamId).toBe("c");
    expect(teamStats.every((t) => t.teamId !== "zz")).toBe(true);
  });

  it("n'ajoute rien sans option (compatibilité)", () => {
    const { teamStats } = computeCupStandings(cup, []);
    expect(teamStats.every((t) => t.byes === 0 && t.totalPoints === 0)).toBe(true);
  });
});
