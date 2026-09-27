import { describe, expect, it } from "vitest";
import {
  cupBracketToPdf,
  cupCalendarToPdf,
  cupLeaderboardsToPdf,
  cupPairingScore,
  cupRoundToPdf,
  cupStandingsToPdf,
  cupStatsToPdf,
  parseScoreLabel,
  selectNextCupRound,
  type CupPdfInput,
  type CupPdfPairing,
  type CupPdfStanding,
} from "./cup";

const rosterName = (slug: string) => `R:${slug}`;
const ctx = { now: new Date(2026, 0, 1), rosterName };

const team = (id: string, name: string) => ({ id, name, roster: "dwarf", coachName: `c-${id}` });

function pairing(over: Partial<CupPdfPairing> = {}): CupPdfPairing {
  return {
    id: "cp1",
    tableNumber: 1,
    status: "scheduled",
    scheduledAt: null,
    homeTeam: team("a", "Nains"),
    awayTeam: team("b", "Orcs"),
    localMatch: null,
    ...over,
  };
}

function standing(over: Partial<CupPdfStanding> = {}): CupPdfStanding {
  return {
    teamId: "a",
    teamName: "Nains",
    roster: "dwarf",
    matchesPlayed: 2,
    wins: 2,
    draws: 0,
    losses: 0,
    touchdownsFor: 3,
    touchdownsAgainst: 1,
    touchdownDiff: 2,
    passes: 1,
    blockCasualties: 4,
    foulCasualties: 0,
    totalPoints: 2040,
    ...over,
  };
}

const base: CupPdfInput = { name: "Coupe test" };

describe("rencontres de coupe", () => {
  it("oriente le score du match local selon le côté A", () => {
    expect(
      cupPairingScore(pairing({ localMatch: { status: "completed", teamAId: "b", scoreTeamA: 3, scoreTeamB: 1 } })),
    ).toEqual({ home: 1, away: 3 });
    expect(cupPairingScore(pairing({ localMatch: { status: "in_progress", teamAId: "a", scoreTeamA: 1, scoreTeamB: 0 } }))).toBeNull();
  });

  it("titre une ronde avec son système et marque les exempts", () => {
    const r = cupRoundToPdf(
      {
        roundNumber: 2,
        name: null,
        system: "swiss",
        status: "in_progress",
        scheduledAt: null,
        pairings: [pairing({ tableNumber: 2 }), pairing({ id: "bye", tableNumber: 1, awayTeam: null, status: "bye" })],
      },
      base,
      ctx,
    );
    expect(r.title).toBe("Ronde 2");
    expect(r.subtitle).toBe("Système suisse");
    const [first, second] = r.groups[0].fixtures;
    expect(first.away).toBeNull();
    expect(first.statusLabel).toBe("Exempt");
    expect(second.home?.rosterName).toBe("R:dwarf");
  });

  it("groupe par poule de l'équipe à domicile, jamais une ronde de bracket", () => {
    const cup: CupPdfInput = {
      ...base,
      pools: [{ id: "p2", name: "B", order: 2 }, { id: "p1", name: "A", order: 1 }],
      participantPools: { a: "p1", c: "p2" },
    };
    const round = {
      roundNumber: 1,
      name: null,
      system: "random",
      status: "in_progress",
      scheduledAt: null,
      pairings: [pairing({ homeTeam: team("c", "Elfes") }), pairing()],
    };
    expect(cupRoundToPdf(round, cup).groups.map((g) => g.label)).toEqual(["A", "B"]);
    expect(cupRoundToPdf({ ...round, bracketSlot: "final" }, cup).groups.map((g) => g.label)).toEqual([null]);
  });

  it("sélectionne la première ronde ouverte et trie le calendrier", () => {
    const done = { roundNumber: 1, name: null, system: "random", status: "completed", scheduledAt: null, pairings: [pairing({ status: "played" })] };
    const open = { ...done, roundNumber: 2, status: "in_progress", pairings: [pairing()] };
    const cup = { ...base, rounds: [open, done] };
    expect(selectNextCupRound(cup)?.roundNumber).toBe(2);
    expect(cupCalendarToPdf(cup, ctx).rounds.map((r) => r.title)).toEqual(["Ronde 1", "Ronde 2"]);
    expect(selectNextCupRound(base)).toBeNull();
  });
});

describe("classement, tops et stats de coupe", () => {
  const cup: CupPdfInput = {
    ...base,
    playoffSize: 4,
    participants: [{ id: "a", owner: { coachName: "Thorgrim" } }],
    standings: [standing(), standing({ teamId: "b", teamName: "Orcs", roster: "orc", touchdownsFor: 1, totalPoints: 0, matchesPlayed: 2 })],
    scoringConfig: { winPoints: 1000, drawPoints: 500, lossPoints: 0, forfeitPoints: -100, touchdownPoints: 5, blockCasualtyPoints: 5, foulCasualtyPoints: 3, passPoints: 2 },
    tieBreakRules: ["points", "td_diff"],
    actionAwards: {
      topScorers: [
        { teamName: "Nains", roster: "dwarf", value: 3 },
        { teamName: "Elfes", roster: "elf", value: 3 },
        { teamName: "Orcs", roster: "orc", value: 1 },
      ],
      bashers: [],
    },
    playerLeaderboardCategories: [{ key: "topScorers", label: "Marqueurs", description: "TD" }],
    playerLeaderboards: { topScorers: [{ rank: 1, playerName: "Bofur", teamName: "Nains", value: 2 }] },
  };

  it("classement général avec quota de play-offs et coach relu dans les inscrits", () => {
    const doc = cupStandingsToPdf(cup, ctx);
    expect(doc.tables).toHaveLength(1);
    expect(doc.tables[0].qualifies).toBe(4);
    expect(doc.tables[0].rows[0].team.coach).toBe("Thorgrim");
    expect(doc.tables[0].rows[0].cells).toEqual([2040, 2, 2, 0, 0, 3, 1, "+2", 1, 4, 0]);
    expect(doc.tieBreakNote).toBe("Points > Différence de TD");
    expect(doc.scoringNote).toContain("Victoire 1000");
  });

  it("préfère les classements par poule quand ils existent", () => {
    const doc = cupStandingsToPdf(
      { ...cup, poolStandings: [{ poolName: "A", poolOrder: 1, qualifiesForPlayoffs: 2, standings: [standing()] }] },
      ctx,
    );
    expect(doc.tables.map((t) => [t.title, t.qualifies])).toEqual([["A", 2]]);
  });

  it("donne un rang partagé aux ex-aequo des podiums", () => {
    const doc = cupLeaderboardsToPdf(cup, ctx);
    expect(doc.sections.map((s) => s.title)).toEqual(["Joueurs", "Équipes"]);
    expect(doc.sections[1].categories).toHaveLength(1); // podium vide ignoré
    expect(doc.sections[1].categories[0].rows.map((r) => r.rank)).toEqual([1, 1, 3]);
  });

  it("résume les stats sans la colonne de points", () => {
    const doc = cupStatsToPdf(cup, ctx);
    expect(doc.keyFigures[0]).toEqual({ label: "Rencontres jouées", value: 2 });
    expect(doc.awards[0]).toMatchObject({ winners: "Nains, Elfes", value: 3 });
    expect(doc.teamTable.columns[0].label).toBe("MJ");
    expect(doc.teamTable.rows[0].cells[0]).toBe(2);
  });
});

describe("bracket de coupe", () => {
  it("parse le score servi et désigne le vainqueur", () => {
    expect(parseScoreLabel("2 – 1")).toEqual({ home: 2, away: 1 });
    expect(parseScoreLabel(null)).toBeNull();
    const doc = cupBracketToPdf(
      base,
      {
        playoffSize: 2,
        playoffsPublished: true,
        rounds: [{ roundNumber: 5, slot: "final", placeholder: false, pairingStatus: "played", homeTeam: team("a", "Nains"), awayTeam: team("b", "Orcs"), scoreLabel: "0 – 2" }],
      },
      ctx,
    );
    expect(doc.stages[0].label).toBe("Finale");
    expect(doc.champion?.name).toBe("Orcs");
    expect(doc.note).toBe("Bracket à 2");
  });
});
