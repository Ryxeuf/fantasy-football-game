import { describe, expect, it } from "vitest";
import type {
  LeaguePairingDetail,
  LeagueRoundDetail,
  StandingRow,
} from "../../../leagues/[id]/types";
import {
  leagueAwardsToPdf,
  leagueBracketToPdf,
  leagueCalendarToPdf,
  leagueLeaderboardsToPdf,
  leaguePairingStatusLabel,
  leagueRoundToPdf,
  leagueStandingsToPdf,
  leagueStatsToPdf,
  selectNextLeagueRound,
} from "./league";

const rosterName = (slug: string) => `R:${slug}`;
const ctx = { leagueName: "Ligue test", seasonName: "Saison 1", now: new Date(2026, 0, 1), rosterName };

function participant(id: string, name: string, coach = `coach-${id}`) {
  return {
    id,
    teamId: `t-${id}`,
    team: { id: `t-${id}`, name, roster: "orc", ownerId: `o-${id}`, owner: { coachName: coach } },
  };
}

function pairing(over: Partial<LeaguePairingDetail> = {}): LeaguePairingDetail {
  return {
    id: "p1",
    status: "scheduled",
    scheduledAt: null,
    deadlineAt: null,
    homeParticipant: participant("a", "Orcs"),
    awayParticipant: participant("b", "Elfes"),
    match: null,
    ...over,
  };
}

function round(n: number, status: string, pairings: LeaguePairingDetail[] = [pairing()]): LeagueRoundDetail {
  return { id: `r${n}`, roundNumber: n, name: null, status, startDate: null, endDate: null, pairings };
}

function standing(over: Partial<StandingRow>): StandingRow {
  return {
    participantId: "pa",
    teamId: "ta",
    teamName: "Orcs",
    roster: "orc",
    ownerId: "o",
    coachName: "Grukk",
    played: 2,
    wins: 1,
    draws: 1,
    losses: 0,
    points: 4,
    touchdownsFor: 3,
    touchdownsAgainst: 1,
    touchdownDifference: 2,
    casualtiesFor: 4,
    casualtiesAgainst: 5,
    seasonElo: 1500,
    status: "active",
    ...over,
  };
}

describe("rencontres de ligue", () => {
  it("lit le score VALIDÉ de la feuille et traduit les statuts", () => {
    const played = pairing({
      status: "played",
      matchSheet: { status: "validated", scoreHome: 2, scoreAway: 1 },
    });
    const r = leagueRoundToPdf(round(1, "completed", [played]), null, rosterName);
    expect(r.title).toBe("Journée 1");
    expect(r.statusLabel).toBe("Terminée");
    const f = r.groups[0].fixtures[0];
    expect(f.score).toEqual({ home: 2, away: 1 });
    expect(f.home).toEqual({ name: "Orcs", coach: "coach-a", rosterName: "R:orc" });
    expect(leaguePairingStatusLabel(pairing({ status: "forfeit_away" }))).toBe("Forfait extérieur");
    expect(
      leaguePairingStatusLabel(pairing({ matchSheet: { status: "both_submitted" } })),
    ).toBe("Validation en attente");
  });

  it("n'utilise pas un score de feuille non validée", () => {
    const f = leagueRoundToPdf(
      round(1, "in_progress", [pairing({ matchSheet: { status: "submitted_home", scoreHome: 3, scoreAway: 0 } })]),
      null,
    ).groups[0].fixtures[0];
    expect(f.score).toBeNull();
  });

  it("groupe par poule quand plusieurs poules sont représentées", () => {
    const p1 = pairing({ id: "x" });
    const p2 = pairing({ id: "y", homeParticipant: participant("c", "Nains"), awayParticipant: participant("d", "Skavens") });
    const r = leagueRoundToPdf(round(2, "pending", [p2, p1]), {
      poolIdByParticipantId: { a: "north", b: "north", c: "south", d: "south" },
      poolNamesById: { north: "Nord", south: "Sud" },
      poolOrder: ["north", "south"],
    });
    expect(r.groups.map((g) => g.label)).toEqual(["Nord", "Sud"]);
    expect(r.groups[1].fixtures[0].home?.name).toBe("Nains");
  });

  it("nomme un tour de bracket par son stade", () => {
    const r = leagueRoundToPdf({ ...round(7, "pending"), bracketSlot: "sf1" }, null);
    expect(r.title).toBe("Play-offs - Demi-finales");
  });

  it("choisit la première journée non terminée comme prochaine journée", () => {
    const rounds = [round(2, "pending"), round(1, "completed"), round(3, "pending")];
    expect(selectNextLeagueRound(rounds)?.roundNumber).toBe(2);
    expect(selectNextLeagueRound([round(1, "completed"), round(2, "completed")])?.roundNumber).toBe(2);
    expect(selectNextLeagueRound([])).toBeNull();
  });

  it("trie le calendrier par numéro de journée", () => {
    const doc = leagueCalendarToPdf([round(3, "pending"), round(1, "completed")], null, ctx);
    expect(doc.rounds.map((r) => r.title)).toEqual(["Journée 1", "Journée 3"]);
    expect(doc.meta).toMatchObject({ competitionName: "Ligue test", seasonName: "Saison 1", competitionKind: "league" });
  });
});

describe("classement de ligue", () => {
  it("produit un tableau par poule, dans l'ordre des poules", () => {
    const doc = leagueStandingsToPdf(
      {
        standings: [],
        pools: [
          { poolId: "s", poolName: "Sud", poolOrder: 2, qualifiesForPlayoffs: 1, standings: [standing({})] },
          { poolId: "n", poolName: "Nord", poolOrder: 1, qualifiesForPlayoffs: 2, standings: [standing({ teamName: "Nains" })] },
        ],
        scoring: { winPoints: 3, drawPoints: 1, lossPoints: 0, forfeitPoints: -1 },
        tieBreakRules: ["points", "td_diff", "inconnu"],
      },
      ctx,
    );
    expect(doc.tables.map((t) => [t.title, t.qualifies])).toEqual([["Nord", 2], ["Sud", 1]]);
    expect(doc.scoringNote).toBe("Victoire 3 - Nul 1 - Défaite 0 - Forfait -1");
    expect(doc.tieBreakNote).toBe("Points (Pts) > Différence de TD > inconnu");
  });

  it("retombe sur le classement général sans poule et grise un retrait", () => {
    const doc = leagueStandingsToPdf(
      { standings: [standing({ bonusPoints: 2, forfeitPoints: -1, status: "withdrawn" })] },
      ctx,
    );
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].title).toBeNull();
    const row = doc.tables[0].rows[0];
    expect(row.muted).toBe(true);
    // Pts, Bo, MJ, V, N, D, For, TD+, TD-, Diff, Sor+, Sor-, DSor
    expect(row.cells).toEqual([4, 2, 2, 1, 1, 0, -1, 3, 1, "+2", 4, 5, -1]);
  });
});

describe("tops, stats et bracket de ligue", () => {
  it("convertit les catalogues joueurs et équipes", () => {
    const doc = leagueLeaderboardsToPdf(
      {
        players: {
          categories: [{ key: "topScorers", label: "Marqueurs", description: "TD" }],
          topScorers: [{ rank: 1, playerName: "Griff", position: "Blitzeur", teamName: "Reavers", value: 4 }],
        },
        teams: {
          categories: [{ key: "topBashers", label: "Cogneurs", description: "Sorties" }],
          topBashers: [{ rank: 1, teamName: "Orcs", roster: "orc", coachName: "Grukk", value: 9 }],
        },
      },
      ctx,
    );
    expect(doc.sections.map((s) => s.title)).toEqual(["Joueurs", "Équipes"]);
    expect(doc.sections[0].categories[0].rows[0]).toEqual({ rank: 1, name: "Griff", detail: "Blitzeur - Reavers", value: 4 });
    expect(doc.sections[1].categories[0].rows[0].detail).toBe("R:orc - coach Grukk");
  });

  it("résume les awards, ex-aequo compris, et l'Oracle par coach", () => {
    const awards = leagueAwardsToPdf({
      topScorer: [{ teamName: "A", value: 5 }, { teamName: "B", value: 5 }],
      oracle: [{ teamName: "A", coachName: "Thorgrim", value: 27 }],
      basher: [],
    });
    expect(awards).toEqual([
      { label: "Top Scorer", description: "Plus de touchdowns marqués", winners: "A, B", value: "5" },
      { label: "Oracle", description: "Meilleur pronostiqueur (coachs)", winners: "Thorgrim", value: "27 pts" },
    ]);
  });

  it("calcule les chiffres clés depuis le classement", () => {
    const doc = leagueStatsToPdf(
      { standings: [standing({ passes: 3 }), standing({ teamName: "B", touchdownsFor: 1, passes: 1 })] },
      ctx,
    );
    expect(doc.keyFigures.slice(0, 3)).toEqual([
      { label: "Rencontres jouées", value: 2 },
      { label: "Touchdowns", value: 4 },
      { label: "TD par match", value: "2,0" },
    ]);
    expect(doc.teamTable.rows[0].cells[5]).toBe(3);
  });

  it("range le bracket par stade et désigne le vainqueur de la finale", () => {
    const sf = (id: string) => ({ ...pairing({ id }), status: "played", matchSheet: { status: "validated", scoreHome: 1, scoreAway: 0 } });
    const fin = { ...pairing({ id: "f" }), status: "played", matchSheet: { status: "validated", scoreHome: 0, scoreAway: 2 } };
    const doc = leagueBracketToPdf(
      {
        playoffSize: 4,
        playoffsPublished: false,
        rounds: [
          { roundNumber: 9, bracketSlot: "final", pairings: [fin] },
          { roundNumber: 7, bracketSlot: "sf1", pairings: [sf("s1")] },
          { roundNumber: 8, bracketSlot: "sf2", pairings: [sf("s2")] },
        ],
      },
      ctx,
    );
    expect(doc.stages.map((s) => [s.label, s.fixtures.length])).toEqual([["Demi-finales", 2], ["Finale", 1]]);
    expect(doc.champion?.name).toBe("Elfes");
    expect(doc.note).toBe("Bracket à 4 - provisoire (non publié)");
  });

  it("traite un placeholder (home === away) comme adversaire inconnu", () => {
    const same = pairing({ awayParticipant: participant("a", "Orcs") });
    const doc = leagueBracketToPdf({ playoffSize: 2, rounds: [{ roundNumber: 1, bracketSlot: "final", pairings: [same] }] }, ctx);
    const f = doc.stages[0].fixtures[0];
    expect(f.placeholder).toBe(true);
    expect(f.away).toBeNull();
    expect(doc.champion).toBeNull();
  });
});
