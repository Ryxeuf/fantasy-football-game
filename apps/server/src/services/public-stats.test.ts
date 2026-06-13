import { describe, it, expect, vi } from "vitest";
import { gatherPublicStats, type StatsCountClient } from "./public-stats";

function makeDb(values: Record<string, number>): StatsCountClient {
  const c = (n: number) => vi.fn().mockResolvedValue(n);
  return {
    roster: { count: c(values.roster ?? 0) },
    starPlayer: { count: c(values.starPlayer ?? 0) },
    skill: { count: c(values.skill ?? 0) },
    team: { count: c(values.team ?? 0) },
    user: { count: c(values.user ?? 0) },
    localMatch: { count: c(values.localMatch ?? 0) },
  };
}

describe("gatherPublicStats", () => {
  it("mappe chaque compteur sur le bon champ", async () => {
    const db = makeDb({
      roster: 30,
      starPlayer: 64,
      skill: 137,
      team: 412,
      user: 188,
      localMatch: 256,
    });
    const stats = await gatherPublicStats(db);
    expect(stats).toEqual({
      rosters: 30,
      starPlayers: 64,
      skills: 137,
      teamsCreated: 412,
      coaches: 188,
      matchesTracked: 256,
    });
  });

  it("filtre catalogue (roster/starPlayer/skill) sur l'édition courante season_3", async () => {
    const db = makeDb({});
    await gatherPublicStats(db);
    const expected = { where: { ruleset: "season_3" } };
    expect(db.roster.count).toHaveBeenCalledWith(expected);
    expect(db.starPlayer.count).toHaveBeenCalledWith(expected);
    expect(db.skill.count).toHaveBeenCalledWith(expected);
  });

  it("ne filtre pas les compteurs d'activité (team/user/localMatch)", async () => {
    const db = makeDb({});
    await gatherPublicStats(db);
    expect(db.team.count).toHaveBeenCalledWith();
    expect(db.user.count).toHaveBeenCalledWith();
    expect(db.localMatch.count).toHaveBeenCalledWith();
  });
});
