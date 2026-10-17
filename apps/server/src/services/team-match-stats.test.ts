import { describe, it, expect } from "vitest";
import {
  EMPTY_RECORD,
  buildTeamMatchStats,
  summarizeLeagueRecord,
  summarizeLocalMatchRecords,
  summarizeLocalMatchStats,
  type LocalMatchRow,
} from "./team-match-stats";

const TEAM = "team-1";

function local(
  partial: Partial<LocalMatchRow> & Pick<LocalMatchRow, "status">,
): LocalMatchRow {
  return {
    teamAId: TEAM,
    teamBId: "other",
    scoreTeamA: 0,
    scoreTeamB: 0,
    cupId: null,
    cupPairingId: null,
    ...partial,
  };
}

describe("summarizeLeagueRecord", () => {
  it("lit les sommes de toutes les participations (V + N + D = joués)", () => {
    expect(
      summarizeLeagueRecord({
        wins: 4,
        draws: 1,
        losses: 2,
        touchdownsFor: 11,
        touchdownsAgainst: 6,
      }),
    ).toEqual({
      played: 7,
      wins: 4,
      draws: 1,
      losses: 2,
      touchdownsFor: 11,
      touchdownsAgainst: 6,
    });
  });

  it("rend un bilan vide sans participation (sommes null) ou sans lecture", () => {
    const nullSums = {
      wins: null,
      draws: null,
      losses: null,
      touchdownsFor: null,
      touchdownsAgainst: null,
    };
    expect(summarizeLeagueRecord(nullSums)).toEqual(EMPTY_RECORD);
    expect(summarizeLeagueRecord(null)).toEqual(EMPTY_RECORD);
  });
});

describe("summarizeLocalMatchRecords", () => {
  it("sépare coupe (cupId ou cupPairingId) et amical, côté A comme côté B", () => {
    const { cup, friendly } = summarizeLocalMatchRecords(TEAM, [
      local({ status: "completed", cupPairingId: "cp-1", scoreTeamA: 2, scoreTeamB: 1 }),
      // Coupe dont la ronde a été supprimée : cupId reste.
      local({
        status: "completed",
        cupId: "cup-1",
        teamAId: "other",
        teamBId: TEAM,
        scoreTeamA: 3,
        scoreTeamB: 0,
      }),
      local({ status: "completed", scoreTeamA: 1, scoreTeamB: 1 }),
    ]);
    expect(cup).toEqual({
      played: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      touchdownsFor: 2,
      touchdownsAgainst: 4,
    });
    expect(friendly).toEqual({
      played: 1,
      wins: 0,
      draws: 1,
      losses: 0,
      touchdownsFor: 1,
      touchdownsAgainst: 1,
    });
  });

  it("ignore les matchs sans résultat (en attente, en cours, annulés)", () => {
    const { cup, friendly } = summarizeLocalMatchRecords(TEAM, [
      local({ status: "pending" }),
      local({ status: "in_progress", scoreTeamA: 2 }),
      local({ status: "cancelled", cupId: "cup-1" }),
    ]);
    expect(cup.played + friendly.played).toBe(0);
  });

  it("lit un score absent comme 0", () => {
    const { friendly } = summarizeLocalMatchRecords(TEAM, [
      local({ status: "completed", scoreTeamA: null, scoreTeamB: 2 }),
    ]);
    expect(friendly).toMatchObject({ losses: 1, touchdownsFor: 0, touchdownsAgainst: 2 });
  });
});

describe("summarizeLocalMatchStats (contrat historique localMatchStats)", () => {
  it("compte chaque statut et le bilan des seuls complétés", () => {
    const stats = summarizeLocalMatchStats(TEAM, [
      local({ status: "completed", scoreTeamA: 3, scoreTeamB: 1 }),
      local({ status: "completed", cupPairingId: "cp", scoreTeamA: 0, scoreTeamB: 2 }),
      local({ status: "pending" }),
      local({ status: "waiting_for_player" }),
      local({ status: "in_progress" }),
      local({ status: "cancelled" }),
    ]);
    expect(stats).toEqual({
      total: 6,
      pending: 1,
      waitingForPlayer: 1,
      inProgress: 1,
      completed: 2,
      cancelled: 1,
      matchesPlayed: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      touchdownsFor: 3,
      touchdownsAgainst: 3,
      touchdownDiff: 0,
    });
  });
});

describe("buildTeamMatchStats", () => {
  it("compte les rencontres de LIGUE, absentes des LocalMatch (bug d'origine)", () => {
    const stats = buildTeamMatchStats({
      teamId: TEAM,
      localMatches: [],
      leagueSums: { wins: 2, draws: 1, losses: 1, touchdownsFor: 7, touchdownsAgainst: 4 },
    });
    expect(stats).toMatchObject({
      played: 4,
      wins: 2,
      draws: 1,
      losses: 1,
      touchdownsFor: 7,
      touchdownsAgainst: 4,
      touchdownDiff: 3,
    });
  });

  it("additionne ligue, coupe et amical, et garde le détail par source", () => {
    const stats = buildTeamMatchStats({
      teamId: TEAM,
      localMatches: [
        local({ status: "completed", cupPairingId: "cp", scoreTeamA: 1, scoreTeamB: 0 }),
        local({ status: "completed", scoreTeamA: 0, scoreTeamB: 3 }),
        local({ status: "in_progress" }),
      ],
      leagueSums: { wins: 1, draws: 1, losses: 0, touchdownsFor: 3, touchdownsAgainst: 2 },
    });
    expect(stats.bySource.league.played).toBe(2);
    expect(stats.bySource.cup.played).toBe(1);
    expect(stats.bySource.friendly.played).toBe(1);
    expect(stats).toMatchObject({
      played: 4,
      wins: 2,
      draws: 1,
      losses: 1,
      touchdownsFor: 4,
      touchdownsAgainst: 5,
      touchdownDiff: -1,
    });
  });

  it("invariant : joués = V + N + D", () => {
    const stats = buildTeamMatchStats({
      teamId: TEAM,
      localMatches: [
        local({ status: "completed", scoreTeamA: 2, scoreTeamB: 2 }),
        local({ status: "completed", cupId: "c", scoreTeamA: 1, scoreTeamB: 0 }),
      ],
      leagueSums: { wins: 4, draws: 2, losses: 3, touchdownsFor: 12, touchdownsAgainst: 10 },
    });
    expect(stats.played).toBe(stats.wins + stats.draws + stats.losses);
  });
});
