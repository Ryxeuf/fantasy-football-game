import { describe, it, expect } from "vitest";
import {
  formatTouchdownDiff,
  resolveTeamMatchStats,
} from "./team-match-stats";

describe("resolveTeamMatchStats", () => {
  it("lit matchStats (toutes compétitions) avec le détail par source", () => {
    const stats = resolveTeamMatchStats({
      matchStats: {
        played: 7,
        wins: 4,
        draws: 1,
        losses: 2,
        touchdownsFor: 11,
        touchdownsAgainst: 7,
        touchdownDiff: 4,
        bySource: {
          league: { played: 5 },
          cup: { played: 1 },
          friendly: { played: 1 },
        },
      },
      // Les seuls LocalMatch : ignorés dès que matchStats est servi.
      localMatchStats: { completed: 2, wins: 1 },
    });
    expect(stats).toEqual({
      played: 7,
      wins: 4,
      draws: 1,
      losses: 2,
      touchdownsFor: 11,
      touchdownsAgainst: 7,
      touchdownDiff: 4,
      breakdown: { league: 5, cup: 1, friendly: 1 },
    });
  });

  it("retombe sur localMatchStats face à une API antérieure (sans détail)", () => {
    const stats = resolveTeamMatchStats({
      localMatchStats: {
        total: 5,
        completed: 3,
        wins: 1,
        draws: 1,
        losses: 1,
        touchdownsFor: 6,
        touchdownsAgainst: 4,
      },
    });
    expect(stats).toEqual({
      played: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      touchdownsFor: 6,
      touchdownsAgainst: 4,
      touchdownDiff: 2,
      breakdown: null,
    });
  });

  it("rend null sans aucune statistique servie", () => {
    expect(resolveTeamMatchStats({ localMatchStats: null })).toBeNull();
    expect(resolveTeamMatchStats(null)).toBeNull();
  });

  it("tolère des champs absents ou non numériques", () => {
    const stats = resolveTeamMatchStats({
      matchStats: { played: "7", wins: 2, bySource: { league: null } },
    });
    expect(stats).toMatchObject({
      played: 0,
      wins: 2,
      touchdownDiff: 0,
      breakdown: { league: 0, cup: 0, friendly: 0 },
    });
  });
});

describe("formatTouchdownDiff", () => {
  it("affiche toujours le signe d'un différentiel non nul", () => {
    expect(formatTouchdownDiff(3)).toBe("+3");
    expect(formatTouchdownDiff(0)).toBe("0");
    expect(formatTouchdownDiff(-2)).toBe("-2");
  });
});
