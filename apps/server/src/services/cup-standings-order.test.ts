import { describe, it, expect } from "vitest";
import {
  CUP_TIE_BREAK_SLUGS,
  DEFAULT_CUP_TIE_BREAK_RULES,
  makeCupStandingsComparator,
  normalizeCupTieBreakRules,
  parseCupTieBreakRules,
  type CupStandingRowForOrder,
} from "./cup-standings-order";

function row(
  teamName: string,
  over: Partial<CupStandingRowForOrder> = {},
): CupStandingRowForOrder {
  return {
    teamName,
    wins: 0,
    draws: 0,
    losses: 0,
    byes: 0,
    matchesPlayed: 0,
    touchdownsFor: 0,
    touchdownsAgainst: 0,
    touchdownDiff: 0,
    passes: 0,
    totalCasualtiesFor: 0,
    totalCasualtiesAgainst: 0,
    resultPoints: 0,
    actionPoints: 0,
    totalPoints: 0,
    ...over,
  };
}

describe("parseCupTieBreakRules", () => {
  it("retombe sur l'ordre historique quand la colonne est absente", () => {
    expect(parseCupTieBreakRules(null)).toEqual(DEFAULT_CUP_TIE_BREAK_RULES);
    expect(parseCupTieBreakRules(undefined)).toEqual(
      DEFAULT_CUP_TIE_BREAK_RULES,
    );
    expect(parseCupTieBreakRules("")).toEqual(DEFAULT_CUP_TIE_BREAK_RULES);
  });

  it("retombe sur l'ordre historique sur JSON corrompu ou non-tableau", () => {
    expect(parseCupTieBreakRules("{oops")).toEqual(
      DEFAULT_CUP_TIE_BREAK_RULES,
    );
    expect(parseCupTieBreakRules('{"a":1}')).toEqual(
      DEFAULT_CUP_TIE_BREAK_RULES,
    );
  });

  it("lit la chaîne JSON stockée", () => {
    expect(parseCupTieBreakRules('["cas_for","td_diff"]')).toEqual([
      "cas_for",
      "td_diff",
      "name",
    ]);
  });

  it("lit aussi un tableau natif (colonne déjà désérialisée)", () => {
    expect(parseCupTieBreakRules(["wins", "name"])).toEqual(["wins", "name"]);
  });

  it("ignore les slugs inconnus et les doublons", () => {
    expect(
      parseCupTieBreakRules('["points","nope","points","cas_for"]'),
    ).toEqual(["points", "cas_for", "name"]);
  });

  it("retombe sur le défaut si aucun slug n'est reconnu", () => {
    expect(parseCupTieBreakRules('["nope","nada"]')).toEqual(
      DEFAULT_CUP_TIE_BREAK_RULES,
    );
  });

  it("pousse toujours `name` en sentinelle de queue", () => {
    const rules = parseCupTieBreakRules('["name","points"]');
    expect(rules).toEqual(["name", "points"]);
    expect(parseCupTieBreakRules('["points"]').at(-1)).toBe("name");
  });
});

describe("normalizeCupTieBreakRules", () => {
  it("retourne null quand rien n'est exploitable", () => {
    expect(normalizeCupTieBreakRules(null)).toBeNull();
    expect(normalizeCupTieBreakRules([])).toBeNull();
    expect(normalizeCupTieBreakRules(["inconnu"])).toBeNull();
  });

  it("conserve l'ordre saisi, dédoublonne et ajoute `name`", () => {
    expect(
      normalizeCupTieBreakRules(["cas_for", "cas_for", "points"]),
    ).toEqual(["cas_for", "points", "name"]);
  });
});

describe("makeCupStandingsComparator", () => {
  it("applique les critères dans l'ordre déclaré", () => {
    const rows = [
      row("Alpha", { totalPoints: 10, touchdownDiff: 5 }),
      row("Bravo", { totalPoints: 10, touchdownDiff: 9 }),
    ];
    rows.sort(makeCupStandingsComparator(["points", "td_diff", "name"]));
    expect(rows.map((r) => r.teamName)).toEqual(["Bravo", "Alpha"]);
  });

  it("départage à la BASH quand la coupe le demande", () => {
    const rows = [
      row("Elfes", { totalPoints: 10, touchdownDiff: 3, totalCasualtiesFor: 0 }),
      row("Orques", { totalPoints: 10, touchdownDiff: 3, totalCasualtiesFor: 7 }),
    ];
    rows.sort(makeCupStandingsComparator(["points", "cas_for", "name"]));
    expect(rows.map((r) => r.teamName)).toEqual(["Orques", "Elfes"]);
  });

  it("classe mieux qui encaisse le moins sur `td_against` / `cas_against`", () => {
    const byTd = [
      row("Passoire", { touchdownsAgainst: 9 }),
      row("Muraille", { touchdownsAgainst: 1 }),
    ];
    byTd.sort(makeCupStandingsComparator(["td_against", "name"]));
    expect(byTd[0].teamName).toBe("Muraille");

    const byCas = [
      row("Fragiles", { totalCasualtiesAgainst: 6 }),
      row("Blindés", { totalCasualtiesAgainst: 2 }),
    ];
    byCas.sort(makeCupStandingsComparator(["cas_against", "name"]));
    expect(byCas[0].teamName).toBe("Blindés");
  });

  it("sépare points de résultat et points d'action", () => {
    const rows = [
      row("Bourrins", { totalPoints: 10, resultPoints: 2, actionPoints: 8 }),
      row("Gagnants", { totalPoints: 10, resultPoints: 8, actionPoints: 2 }),
    ];
    rows.sort(makeCupStandingsComparator(["points", "result_points", "name"]));
    expect(rows[0].teamName).toBe("Gagnants");
  });

  it("`played` favorise l'équipe qui a joué le plus de matchs", () => {
    const rows = [
      row("Retard", { totalPoints: 10, matchesPlayed: 1 }),
      row("Avance", { totalPoints: 10, matchesPlayed: 3 }),
    ];
    rows.sort(makeCupStandingsComparator(["points", "played", "name"]));
    expect(rows[0].teamName).toBe("Avance");
  });

  it("reste déterministe sur une égalité stricte (nom ASC)", () => {
    const rows = [row("Zulu"), row("Alpha")];
    rows.sort(makeCupStandingsComparator(DEFAULT_CUP_TIE_BREAK_RULES));
    expect(rows.map((r) => r.teamName)).toEqual(["Alpha", "Zulu"]);
  });

  it("chaque slug déclaré est comparable (aucun trou dans le switch)", () => {
    for (const slug of CUP_TIE_BREAK_SLUGS) {
      const cmp = makeCupStandingsComparator([slug]);
      expect(typeof cmp(row("A"), row("B"))).toBe("number");
    }
  });
});
