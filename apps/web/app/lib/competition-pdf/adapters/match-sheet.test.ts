import { describe, expect, it } from "vitest";
import { matchSheetToPdf, sheetRoundLabel, type SheetPdfInput, type SheetPdfTeam } from "./match-sheet";

const stats = { ma: 6, st: 3, ag: 3, pa: 4, av: 9 };

function team(prefix: string, name: string): SheetPdfTeam {
  return {
    name,
    roster: "dwarf",
    raceName: "Nains",
    coachName: `coach-${prefix}`,
    teamValue: 1_000_000,
    currentValue: 950_000,
    treasury: 50_000,
    dedicatedFans: 3,
    staff: { rerolls: 2, cheerleaders: 0, assistants: 1, apothecary: true },
    players: [
      { id: `${prefix}2`, number: 2, name: "Deux", position: "blocker", positionName: "Bloqueur", spp: 4, skills: "block", stats },
      { id: `${prefix}1`, number: 1, name: "Un", position: "runner", spp: 9, skills: "", stats },
      { id: `${prefix}3`, number: 3, name: "Blessé", position: "blocker", missNextMatch: true, stats },
      { id: `${prefix}4`, number: 4, name: "Mort", position: "blocker", dead: true, stats },
    ],
    journeymen: [{ id: `journeyman-${prefix}-1`, number: 12, name: "Journalier", position: "lineman", positionName: "Trois-quart", stats }],
  };
}

function input(over: Partial<SheetPdfInput> = {}): SheetPdfInput {
  return {
    sheet: { status: "draft", events: [] },
    summary: { scoreHome: 0, scoreAway: 0, injuries: [], playerStats: [] },
    leagueName: "Ligue test",
    teams: { home: team("h", "Karak"), away: team("a", "Morr") },
    reference: {
      weatherTables: [
        { id: "classique", name: "Classique", results: [{ roll: 2, condition: "Chaleur" }, { roll: 3, condition: "Parfait" }, { roll: 4, condition: "Parfait" }] },
      ],
    },
    computedSpp: {},
    ...over,
  };
}

describe("matchSheetToPdf", () => {
  it("liste les joueurs par numéro, grise les absents, écarte les morts, ajoute les journaliers", () => {
    const doc = matchSheetToPdf(input(), { now: new Date(2026, 0, 1) });
    const names = doc.home.players.map((p) => p.name);
    expect(names).toEqual(["Un", "Deux", "Blessé", "Journalier"]);
    expect(doc.home.players[1]).toMatchObject({ position: "Bloqueur", skills: "Blocage", spp: 4 });
    expect(doc.home.players[2]).toMatchObject({ unavailable: true, note: "Absent : blessé" });
    expect(doc.home.players[3].note).toBe("Journalier");
    expect(doc.home.team).toEqual({ name: "Karak", coach: "coach-h", rosterName: "Nains" });
    expect(doc.meta.competitionKind).toBe("league");
    expect(doc.rules).toEqual({ spp: true, economy: true, advancements: true, purchases: true, firings: true });
    expect(doc.weatherTable?.results).toEqual([
      { roll: "2", condition: "Chaleur" },
      { roll: "3-4", condition: "Parfait" },
    ]);
  });

  it("feuille vierge : ni score, ni évènement, ni PSP de match", () => {
    const doc = matchSheetToPdf(input({ computedSpp: { h1: 3 } }));
    expect(doc.prefill?.score).toBeNull();
    expect(doc.prefill?.events).toEqual([]);
    expect(doc.home.players[0].tally).toBeNull();
  });

  it("reporte la saisie déjà faite : avant-match, compteurs, journal, JDM", () => {
    const doc = matchSheetToPdf(
      input({
        sheet: {
          status: "validated",
          weather: "Chaleur",
          tossWinner: "away",
          tossChoice: "receive",
          popularityHome: 4,
          inducementsAway: JSON.stringify([{ name: "Pot-de-vin", qty: 2, cost: 100_000 }]),
          prayersHome: [{ roll: 10 }, { roll: 99 }],
          motmPlayerIds: ["h1"],
          events: [
            { kind: "touchdown", team: "home", actorPlayerId: "h1", targetPlayerId: null, causeDetail: null, injurySeverity: null, meta: { half: 1, turn: 5 } },
            { kind: "casualty", team: "home", actorPlayerId: "h2", targetPlayerId: "a1", causeDetail: null, injurySeverity: "stat_loss", meta: { half: 2, stat: "av" } },
            { kind: "kickoff", team: null, actorPlayerId: null, targetPlayerId: null, causeDetail: null, injurySeverity: null, meta: { kickoffEvent: "blitz" } },
            { kind: "aggression", team: "away", actorPlayerId: "a2", targetPlayerId: "h2", causeDetail: null, injurySeverity: null },
          ],
        },
        summary: {
          scoreHome: 1,
          scoreAway: 0,
          injuries: [{ playerId: "a1", severity: "stat_loss" }],
          playerStats: [
            { playerId: "h1", touchdowns: 1, casualtiesInflicted: 0, completions: 0, interceptions: 0 },
            { playerId: "h2", touchdowns: 0, casualtiesInflicted: 1, completions: 0, interceptions: 0 },
          ],
        },
        computedSpp: { h1: 7, h2: 2 },
      }),
    );
    const p = doc.prefill!;
    expect(p).toMatchObject({ weather: "Chaleur", tossWinner: "away", tossChoice: "receive", popularityHome: 4 });
    expect(p.inducementsAway).toEqual([{ name: "Pot-de-vin", qty: 2, cost: 100_000 }]);
    expect(p.prayersHome).toEqual(["10"]);
    expect(p.score).toEqual({ home: 1, away: 0 });
    expect(p.motm).toEqual({ home: ["1"], away: [] });
    expect(p.events).toEqual([
      { half: 1, turn: 5, side: "home", kind: "TD", actor: "n°1", target: null, injury: null, detail: null },
      { half: 2, turn: null, side: "home", kind: "SOR", actor: "n°2", target: "n°1", injury: "S (AR)", detail: "Séquelle AR" },
      { half: null, turn: null, side: null, kind: "CE", actor: null, target: null, injury: null, detail: "10 - Charge !" },
      { half: null, turn: null, side: "away", kind: "AGR", actor: "n°2", target: "n°2", injury: null, detail: null },
    ]);
    const [un, deux] = doc.home.players;
    expect(un.tally).toEqual({ td: 1, motm: true, spp: 7 });
    expect(deux.tally).toEqual({ cas: 1, spp: 2 });
    expect(doc.away.players.find((x) => x.name === "Un")?.tally).toEqual({ injury: "S" });
    expect(doc.away.players.find((x) => x.name === "Deux")?.tally).toEqual({ agg: 1 });
  });

  it("applique les règles de coupe : pas de PSP, pas d'économie", () => {
    const doc = matchSheetToPdf(
      input({
        competitionKind: "cup",
        competitionRules: { sppEnabled: false, economyEnabled: false, advancementsEnabled: false, purchasesEnabled: false, firingsEnabled: false },
      }),
    );
    expect(doc.meta.competitionKind).toBe("cup");
    expect(doc.rules).toEqual({ spp: false, economy: false, advancements: false, purchases: false, firings: false });
    expect(doc.home.players[0].spp).toBeNull();
  });

  it("déduit les règles d'une coupe quand le serveur ne les sert pas", () => {
    expect(matchSheetToPdf(input({ competitionKind: "cup" })).rules.economy).toBe(false);
  });
});

describe("en-tête de la feuille : journée, saison, date", () => {
  const fixture = { roundNumber: 5, roundName: null, bracketSlot: null, seasonName: "Saison 3", scheduledAt: "2026-10-04T18:30:00.000Z" };

  it("nomme la journée d'une ligue et la ronde d'une coupe", () => {
    expect(sheetRoundLabel(fixture, false)).toBe("Journée 5");
    expect(sheetRoundLabel({ ...fixture, roundName: "Les Jardins de Morr" }, false)).toBe("Journée 5 - Les Jardins de Morr");
    expect(sheetRoundLabel(fixture, true)).toBe("Ronde 5");
    expect(sheetRoundLabel({ ...fixture, bracketSlot: "final" }, true)).toBe("Play-offs - Finale");
    expect(sheetRoundLabel({ ...fixture, roundNumber: null, roundName: "Amicale" }, false)).toBe("Amicale");
    expect(sheetRoundLabel(null, false)).toBeNull();
  });

  it("reporte journée, saison et date prévue dans le document", () => {
    const doc = matchSheetToPdf(input({ fixture }));
    expect(doc.roundLabel).toBe("Journée 5");
    expect(doc.meta.seasonName).toBe("Saison 3");
    expect(doc.scheduledLabel).toMatch(/^04\/10\/2026 \d{2}:30$/);
  });

  it("retombe sur « Rencontre » sans placement servi (serveur antérieur)", () => {
    const doc = matchSheetToPdf(input());
    expect(doc.roundLabel).toBe("Rencontre");
    expect(doc.scheduledLabel).toBeNull();
    expect(doc.meta.seasonName).toBeNull();
  });
});

describe("matchSheetToPdf — mode de saisie", () => {
  it("garde la feuille complète en ligue (légendes et colonnes par défaut)", () => {
    const doc = matchSheetToPdf(input());
    expect(doc.entry).toEqual({
      preMatch: "full",
      halfAndTurn: true,
      injuryDetails: true,
      kickoffDetails: true,
      passReceiver: true,
      eventLegend: null,
      tally: null,
    });
  });

  it("garde la feuille complète d'une coupe sans mode servi", () => {
    const doc = matchSheetToPdf(input({ competitionKind: "cup" }));
    expect(doc.entry?.preMatch).toBe("full");
    expect(doc.entry?.eventLegend).toBeNull();
  });

  it("réduit la feuille d'une coupe en saisie simplifiée à ce que demande le formulaire", () => {
    const doc = matchSheetToPdf(
      input({
        competitionKind: "cup",
        competitionRules: { sppEnabled: false, entryMode: "simplified" },
      }),
    );
    expect(doc.entry).toMatchObject({
      preMatch: "forfeit-only",
      halfAndTurn: false,
      injuryDetails: false,
      kickoffDetails: false,
      passReceiver: false,
    });
    expect(doc.entry?.eventLegend).toEqual([
      { code: "TD", label: "Touchdown" },
      { code: "SOR", label: "Élimination sur Blocage" },
      { code: "PAS", label: "Passe réussie" },
      { code: "INT", label: "Interception" },
      { code: "AGR", label: "Élimination sur Agression" },
    ]);
    expect(doc.entry?.tally?.map((c) => c.key).sort()).toEqual(
      ["agg", "cas", "int", "pass", "td"].sort(),
    );
    expect(doc.entry?.tally?.find((c) => c.key === "agg")?.legend).toBe(
      "Élimination sur Agression",
    );
  });

  it("reporte le forfait déjà saisi", () => {
    const doc = matchSheetToPdf(
      input({ sheet: { status: "draft", events: [], forfeitSide: "away" } }),
    );
    expect(doc.prefill?.forfeitSide).toBe("away");
  });
});
