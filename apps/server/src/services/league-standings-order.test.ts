/**
 * Critères de classement d'une ligue — module PUR.
 *
 * Couvre l'ordre par DÉFAUT (points → bonus → forfaits → diff TD → diff
 * sorties), le parse tolérant de la colonne, la normalisation du chemin
 * d'écriture et chaque slug du comparateur.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_LEAGUE_TIE_BREAK_RULES,
  LEAGUE_TIE_BREAK_SLUGS,
  isSeasonEloRanked,
  makeLeagueStandingsComparator,
  normalizeLeagueTieBreakRules,
  parseLeagueTieBreakRules,
  serializeLeagueTieBreakRules,
  type LeagueStandingRowForOrder,
} from "./league-standings-order";

function row(
  over: Partial<LeagueStandingRowForOrder>,
): LeagueStandingRowForOrder {
  return {
    teamName: "Team",
    played: 3,
    wins: 0,
    points: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDifference: 0,
    casualtiesFor: 0,
    casualtiesAgainst: 0,
    seasonElo: 1000,
    ...over,
  };
}

/** Ordre demandé : nb points, bonus, forfait décroissant, diff TD, diff sorties. */
const EXPECTED_DEFAULT = [
  "points",
  "bonus_points",
  "forfeit_points",
  "td_diff",
  "cas_diff",
  "name",
];

describe("DEFAULT_LEAGUE_TIE_BREAK_RULES", () => {
  it("classe points → bonus → forfaits → diff TD → diff sorties → nom", () => {
    expect(DEFAULT_LEAGUE_TIE_BREAK_RULES).toEqual(EXPECTED_DEFAULT);
  });

  it("ne contient pas l'ELO (neutralisé en ligue)", () => {
    expect(DEFAULT_LEAGUE_TIE_BREAK_RULES).not.toContain("season_elo");
  });
});

describe("parseLeagueTieBreakRules", () => {
  it("retombe sur le défaut quand la colonne est null", () => {
    expect(parseLeagueTieBreakRules(null)).toEqual(EXPECTED_DEFAULT);
  });

  it("retombe sur le défaut quand la colonne est absente", () => {
    expect(parseLeagueTieBreakRules(undefined)).toEqual(EXPECTED_DEFAULT);
  });

  it("retombe sur le défaut sur JSON corrompu", () => {
    expect(parseLeagueTieBreakRules("{not-json")).toEqual(EXPECTED_DEFAULT);
  });

  it("retombe sur le défaut sur chaîne vide", () => {
    expect(parseLeagueTieBreakRules("   ")).toEqual(EXPECTED_DEFAULT);
  });

  it("retombe sur le défaut quand le JSON n'est pas un tableau", () => {
    expect(parseLeagueTieBreakRules('{"foo":"bar"}')).toEqual(
      EXPECTED_DEFAULT,
    );
  });

  it("accepte un tableau déjà désérialisé (miroir PG)", () => {
    expect(parseLeagueTieBreakRules(["points", "cas_for"])).toEqual([
      "points",
      "cas_for",
      "name",
    ]);
  });

  it("filtre les slugs inconnus en gardant l'ordre des valides", () => {
    expect(
      parseLeagueTieBreakRules(
        JSON.stringify(["points", "unknown", "wins", "foo", "name"]),
      ),
    ).toEqual(["points", "wins", "name"]);
  });

  it("déduplique en gardant la première occurrence", () => {
    expect(
      parseLeagueTieBreakRules(
        JSON.stringify(["points", "wins", "points", "name", "wins"]),
      ),
    ).toEqual(["points", "wins", "name"]);
  });

  it("ajoute « name » en sentinelle de queue quand il manque", () => {
    const out = parseLeagueTieBreakRules(JSON.stringify(["points", "wins"]));
    expect(out[out.length - 1]).toBe("name");
  });

  it("retombe sur le défaut quand rien de connu ne subsiste", () => {
    expect(parseLeagueTieBreakRules(JSON.stringify(["foo", "bar"]))).toEqual(
      EXPECTED_DEFAULT,
    );
  });

  it("accepte tous les slugs du catalogue", () => {
    expect(
      parseLeagueTieBreakRules(JSON.stringify([...LEAGUE_TIE_BREAK_SLUGS])),
    ).toEqual(LEAGUE_TIE_BREAK_SLUGS);
  });
});

describe("normalizeLeagueTieBreakRules / serializeLeagueTieBreakRules", () => {
  it("null quand rien n'est fourni", () => {
    expect(normalizeLeagueTieBreakRules(null)).toBeNull();
    expect(normalizeLeagueTieBreakRules(undefined)).toBeNull();
    expect(serializeLeagueTieBreakRules(null)).toBeNull();
  });

  it("null quand aucun slug connu ne subsiste (= ordre par défaut)", () => {
    expect(normalizeLeagueTieBreakRules(["foo", "bar"])).toBeNull();
    expect(serializeLeagueTieBreakRules([])).toBeNull();
  });

  it("garde l'ordre saisi et pousse « name » en queue", () => {
    expect(
      normalizeLeagueTieBreakRules(["cas_for", "points", "cas_for"]),
    ).toEqual(["cas_for", "points", "name"]);
  });

  it("sérialise en JSON relisible par le parseur", () => {
    const raw = serializeLeagueTieBreakRules(["points", "cas_for"]);
    expect(raw).toBe(JSON.stringify(["points", "cas_for", "name"]));
    expect(parseLeagueTieBreakRules(raw)).toEqual([
      "points",
      "cas_for",
      "name",
    ]);
  });
});

describe("makeLeagueStandingsComparator — ordre par défaut", () => {
  const cmp = makeLeagueStandingsComparator(DEFAULT_LEAGUE_TIE_BREAK_RULES);

  it("les points priment sur tout le reste", () => {
    const a = row({ teamName: "A", points: 10, bonusPoints: 0 });
    const b = row({ teamName: "B", points: 9, bonusPoints: 99 });
    expect([b, a].sort(cmp).map((r) => r.teamName)).toEqual(["A", "B"]);
  });

  it("à points égaux, le bonus départage avant la diff de TD", () => {
    const a = row({
      teamName: "A",
      points: 6,
      bonusPoints: 1,
      touchdownDifference: 20,
    });
    const b = row({
      teamName: "B",
      points: 6,
      bonusPoints: 4,
      touchdownDifference: 0,
    });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("à points et bonus égaux, moins de forfaits passe devant", () => {
    const a = row({
      teamName: "A",
      points: 6,
      forfeitPoints: -3,
      touchdownDifference: 20,
    });
    const b = row({ teamName: "B", points: 6, forfeitPoints: 0 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("deux forfaits passent derrière un seul", () => {
    const a = row({ teamName: "A", points: 6, forfeitPoints: -6 });
    const b = row({ teamName: "B", points: 6, forfeitPoints: -3 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("puis la différence de TD", () => {
    const a = row({ teamName: "A", points: 6, touchdownDifference: 1 });
    const b = row({ teamName: "B", points: 6, touchdownDifference: 5 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("puis la différence de sorties", () => {
    const a = row({
      teamName: "A",
      points: 6,
      casualtiesFor: 2,
      casualtiesAgainst: 1,
    });
    const b = row({
      teamName: "B",
      points: 6,
      casualtiesFor: 9,
      casualtiesAgainst: 1,
    });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("puis le nom, en dernier recours", () => {
    const a = row({ teamName: "Beta", points: 6 });
    const b = row({ teamName: "Alpha", points: 6 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["Alpha", "Beta"]);
  });

  it("une ligne sans bonus ni forfait (API pré-F1) vaut zéro, pas NaN", () => {
    const a = row({ teamName: "A", points: 6 });
    const b = row({ teamName: "B", points: 6, bonusPoints: 2 });
    expect(cmp(a, b)).toBeGreaterThan(0);
    expect(Number.isNaN(cmp(a, b))).toBe(false);
  });
});

describe("makeLeagueStandingsComparator — slugs", () => {
  it("l'ordre des slugs change le vainqueur", () => {
    const a = row({ teamName: "A", wins: 5, touchdownsFor: 3 });
    const b = row({ teamName: "B", wins: 3, touchdownsFor: 10 });
    expect(
      [a, b]
        .sort(makeLeagueStandingsComparator(["wins", "td_for", "name"]))
        .map((r) => r.teamName),
    ).toEqual(["A", "B"]);
    expect(
      [a, b]
        .sort(makeLeagueStandingsComparator(["td_for", "wins", "name"]))
        .map((r) => r.teamName),
    ).toEqual(["B", "A"]);
  });

  it("td_against : moins il y en a, mieux c'est", () => {
    const cmp = makeLeagueStandingsComparator(["td_against", "name"]);
    const a = row({ teamName: "A", touchdownsAgainst: 8 });
    const b = row({ teamName: "B", touchdownsAgainst: 2 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("cas_against : moins il y en a, mieux c'est", () => {
    const cmp = makeLeagueStandingsComparator(["cas_against", "name"]);
    const a = row({ teamName: "A", casualtiesAgainst: 8 });
    const b = row({ teamName: "B", casualtiesAgainst: 2 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("cas_diff utilise le différentiel pré-calculé quand il est fourni", () => {
    const cmp = makeLeagueStandingsComparator(["cas_diff", "name"]);
    const a = row({
      teamName: "A",
      casualtiesFor: 0,
      casualtiesAgainst: 0,
      casualtyDifference: 7,
    });
    const b = row({
      teamName: "B",
      casualtiesFor: 10,
      casualtiesAgainst: 0,
      casualtyDifference: 2,
    });
    expect([b, a].sort(cmp).map((r) => r.teamName)).toEqual(["A", "B"]);
  });

  it("season_elo DESC", () => {
    const cmp = makeLeagueStandingsComparator(["season_elo", "name"]);
    const a = row({ teamName: "A", seasonElo: 1100 });
    const b = row({ teamName: "B", seasonElo: 1000 });
    expect([b, a].sort(cmp).map((r) => r.teamName)).toEqual(["A", "B"]);
  });

  it("played DESC : l'équipe en retard ne double pas", () => {
    const cmp = makeLeagueStandingsComparator(["played", "name"]);
    const a = row({ teamName: "A", played: 2 });
    const b = row({ teamName: "B", played: 5 });
    expect([a, b].sort(cmp).map((r) => r.teamName)).toEqual(["B", "A"]);
  });

  it("renvoie 0 quand tous les critères sont à égalité", () => {
    const cmp = makeLeagueStandingsComparator(["points"]);
    expect(cmp(row({ teamName: "A", points: 5 }), row({ teamName: "B", points: 5 }))).toBe(0);
  });
});

describe("isSeasonEloRanked", () => {
  it("faux par défaut (colonne ELO masquée)", () => {
    expect(isSeasonEloRanked(null)).toBe(false);
  });

  it("vrai dès que season_elo fait partie des critères", () => {
    expect(
      isSeasonEloRanked(JSON.stringify(["points", "season_elo", "name"])),
    ).toBe(true);
  });

  it("faux quand season_elo est absent des critères configurés", () => {
    expect(isSeasonEloRanked(JSON.stringify(["points", "wins"]))).toBe(false);
  });
});
