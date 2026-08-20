/**
 * Classements par equipe (totaux de saison) — logique PURE
 * `buildTeamLeaderboards` : tops descendants filtres a zero, meilleure
 * defense ascendante (0 legitime, equipes ayant joue), retrait des
 * equipes withdrawn, clamp du top-N.
 */
import { describe, it, expect } from "vitest";
import {
  buildTeamLeaderboards,
  clampTopN,
  TEAM_LEADERBOARD_CATEGORIES,
} from "./league-team-stats";
import type { StandingRow } from "./league";

function row(over: Partial<StandingRow> & { participantId: string }): StandingRow {
  return {
    teamId: `${over.participantId}-team`,
    teamName: over.participantId,
    roster: "humans",
    logoUrl: null,
    ownerId: `${over.participantId}-owner`,
    coachName: null,
    played: 1,
    wins: 0,
    draws: 0,
    losses: 0,
    points: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDifference: 0,
    casualtiesFor: 0,
    casualtiesAgainst: 0,
    seasonElo: 1000,
    status: "active",
    ...over,
  };
}

describe("buildTeamLeaderboards", () => {
  it("classe les equipes par TD marques (desc), valeurs a zero exclues", () => {
    const out = buildTeamLeaderboards(
      [
        row({ participantId: "A", touchdownsFor: 2 }),
        row({ participantId: "B", touchdownsFor: 7 }),
        row({ participantId: "C", touchdownsFor: 0 }),
      ],
      { seasonId: "S1", topN: 5 },
    );
    expect(out.topScorers.map((r) => [r.rank, r.teamName, r.value])).toEqual([
      [1, "B", 7],
      [2, "A", 2],
    ]);
  });

  it("limite chaque top au topN demande", () => {
    const standings = ["A", "B", "C", "D"].map((id, i) =>
      row({ participantId: id, touchdownsFor: i + 1 }),
    );
    const out = buildTeamLeaderboards(standings, { seasonId: "S1", topN: 2 });
    expect(out.topScorers).toHaveLength(2);
    expect(out.topScorers[0].teamName).toBe("D");
  });

  it("meilleure defense : ascendant, 0 encaisse legitime, sans les equipes a 0 match", () => {
    const out = buildTeamLeaderboards(
      [
        row({ participantId: "A", touchdownsAgainst: 3 }),
        row({ participantId: "B", touchdownsAgainst: 0 }),
        // Pas encore joue : 0 encaisse ne veut rien dire.
        row({ participantId: "C", touchdownsAgainst: 0, played: 0 }),
      ],
      { seasonId: "S1", topN: 5 },
    );
    expect(out.bestDefenses.map((r) => [r.rank, r.teamName, r.value])).toEqual([
      [1, "B", 0],
      [2, "A", 3],
    ]);
  });

  it("ignore les equipes retirees (withdrawn)", () => {
    const out = buildTeamLeaderboards(
      [
        row({ participantId: "A", touchdownsFor: 9, status: "withdrawn" }),
        row({ participantId: "B", touchdownsFor: 1 }),
      ],
      { seasonId: "S1", topN: 5 },
    );
    expect(out.topScorers.map((r) => r.teamName)).toEqual(["B"]);
  });

  it("tolere les champs optionnels absents (API pre-F1) : tops vides", () => {
    const out = buildTeamLeaderboards(
      [row({ participantId: "A", passes: undefined })],
      { seasonId: "S1", topN: 5 },
    );
    expect(out.topPassers).toEqual([]);
    expect(out.topInterceptors).toEqual([]);
  });

  it("expose passes / interceptions / agressions / sorties public", () => {
    const out = buildTeamLeaderboards(
      [
        row({
          participantId: "A",
          passes: 4,
          interceptions: 2,
          aggressions: 3,
          crowdSurges: 1,
        }),
      ],
      { seasonId: "S1", topN: 5 },
    );
    expect(out.topPassers[0].value).toBe(4);
    expect(out.topInterceptors[0].value).toBe(2);
    expect(out.topAggressors[0].value).toBe(3);
    expect(out.topCrowdSurges[0].value).toBe(1);
  });

  it("departage les ex-aequo par nom d'equipe (deterministe)", () => {
    const out = buildTeamLeaderboards(
      [
        row({ participantId: "Zebres", touchdownsFor: 3 }),
        row({ participantId: "Aigles", touchdownsFor: 3 }),
      ],
      { seasonId: "S1", topN: 5 },
    );
    expect(out.topScorers.map((r) => [r.rank, r.teamName])).toEqual([
      [1, "Aigles"],
      [2, "Zebres"],
    ]);
  });

  it("porte le coach et les matchs joues sur chaque ligne", () => {
    const out = buildTeamLeaderboards(
      [
        row({
          participantId: "A",
          touchdownsFor: 1,
          coachName: "Coach Griff",
          played: 4,
        }),
      ],
      { seasonId: "S1", topN: 5 },
    );
    expect(out.topScorers[0].coachName).toBe("Coach Griff");
    expect(out.topScorers[0].played).toBe(4);
  });
});

describe("clampTopN", () => {
  it("borne 1..50, defaut 5", () => {
    expect(clampTopN(undefined)).toBe(5);
    expect(clampTopN(Number.NaN)).toBe(5);
    expect(clampTopN(0)).toBe(1);
    expect(clampTopN(99)).toBe(50);
    expect(clampTopN(7.9)).toBe(7);
  });
});

describe("TEAM_LEADERBOARD_CATEGORIES", () => {
  it("couvre exactement les cles du catalogue", () => {
    expect(TEAM_LEADERBOARD_CATEGORIES.map((c) => c.key)).toEqual([
      "topScorers",
      "bestDefenses",
      "topBashers",
      "topMartyrs",
      "topPassers",
      "topInterceptors",
      "topAggressors",
      "topCrowdSurges",
    ]);
  });
});
