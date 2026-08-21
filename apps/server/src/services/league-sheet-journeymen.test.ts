/**
 * Journaliers de la feuille de match — dérivation pure.
 *
 * Règle : une équipe qui aligne moins de 11 joueurs disponibles (morts,
 * absents missNextMatch exclus) engage un journalier par joueur manquant,
 * au poste lineman du roster (choix possible entre plusieurs linemen,
 * défaut = lineman de base), avec Solitaire (4+).
 */

import { describe, it, expect } from "vitest";
import {
  deriveJourneymen,
  isJourneymanId,
  linemanPositionsForRoster,
  parseJourneymenChoice,
  JOURNEYMAN_ID_PREFIX,
} from "./league-sheet-journeymen";

function players(
  count: number,
  overrides: Array<Partial<{ dead: boolean; missNextMatch: boolean }>> = [],
) {
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    dead: overrides[i]?.dead ?? false,
    missNextMatch: overrides[i]?.missNextMatch ?? false,
  }));
}

describe("isJourneymanId", () => {
  it("reconnait le préfixe synthétique", () => {
    expect(isJourneymanId(`${JOURNEYMAN_ID_PREFIX}home-1`)).toBe(true);
    expect(isJourneymanId("cku123abc")).toBe(false);
    expect(isJourneymanId(null)).toBe(false);
    expect(isJourneymanId(undefined)).toBe(false);
  });
});

describe("linemanPositionsForRoster", () => {
  it("retourne les postes 0-12+ (skaven : un seul lineman)", () => {
    const options = linemanPositionsForRoster("skaven", "season_3");
    expect(options.map((o) => o.slug)).toEqual(["skaven_rat_des_clans_skaven"]);
  });

  it("retourne plusieurs choix quand le roster a plusieurs linemen (undead)", () => {
    const options = linemanPositionsForRoster("undead", "season_3");
    expect(options.length).toBeGreaterThan(1);
    expect(options.map((o) => o.slug)).toContain("undead_trois_quart_squelette");
    expect(options.map((o) => o.slug)).toContain("undead_trois_quart_zombie");
  });

  it("roster inconnu -> aucune option", () => {
    expect(linemanPositionsForRoster("roster-inconnu")).toEqual([]);
  });
});

describe("deriveJourneymen", () => {
  it("aucun journalier quand 11 joueurs sont disponibles", () => {
    expect(
      deriveJourneymen({
        side: "home",
        roster: "skaven",
        ruleset: "season_3",
        players: players(11),
      }),
    ).toEqual([]);
  });

  it("un journalier par joueur manquant (morts + absents exclus)", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      // 11 joueurs mais 1 mort + 1 absent -> 9 disponibles -> 2 journaliers.
      players: players(11, [{ dead: true }, { missNextMatch: true }]),
    });
    expect(out).toHaveLength(2);
    expect(out.map((j) => j.id)).toEqual([
      "journeyman-home-1",
      "journeyman-home-2",
    ]);
    // Numeros a la suite du roster, noms lisibles.
    expect(out.map((j) => j.number)).toEqual([12, 13]);
    expect(out[0].name).toBe("Journalier 1");
    // Poste lineman du roster + Solitaire (4+).
    expect(out[0].position).toBe("skaven_rat_des_clans_skaven");
    expect(out[0].skills.split(",")).toContain("loner-4");
    expect(out[0].stats.ma).toBeGreaterThan(0);
  });

  it("respecte le choix du coach entre plusieurs linemen (undead)", () => {
    const out = deriveJourneymen({
      side: "away",
      roster: "undead",
      ruleset: "season_3",
      players: players(10),
      chosenPosition: "undead_trois_quart_zombie",
    });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("journeyman-away-1");
    expect(out[0].position).toBe("undead_trois_quart_zombie");
    expect(out[0].positionName).toContain("Journalier");
  });

  it("ignore un choix qui n'est pas un poste de lineman", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(10),
      chosenPosition: "skaven_blitzer", // pas un lineman
    });
    expect(out[0].position).toBe("skaven_rat_des_clans_skaven");
  });

  it("roster inconnu -> stats de repli (lineman humain)", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "roster-inconnu",
      players: players(10),
    });
    expect(out).toHaveLength(1);
    expect(out[0].stats).toEqual({ ma: 6, st: 3, ag: 3, pa: 4, av: 9 });
    expect(out[0].skills).toBe("loner-4");
    // Valeur de repli : lineman à 50k po.
    expect(out[0].cost).toBe(50_000);
  });

  it("porte la valeur du poste en po (règle BB : le journalier compte dans la CTV)", () => {
    const out = deriveJourneymen({
      side: "home",
      roster: "skaven",
      ruleset: "season_3",
      players: players(9),
    });
    expect(out).toHaveLength(2);
    // Rat des clans skaven : 50 kpo -> 50 000 po chacun.
    for (const j of out) {
      expect(j.cost).toBe(50_000);
    }
  });
});

describe("parseJourneymenChoice", () => {
  it("tolère objet natif (PG), string JSON (sqlite) et null", () => {
    expect(parseJourneymenChoice({ position: "x" })).toBe("x");
    expect(parseJourneymenChoice(JSON.stringify({ position: "y" }))).toBe("y");
    expect(parseJourneymenChoice(null)).toBeNull();
    expect(parseJourneymenChoice(undefined)).toBeNull();
    expect(parseJourneymenChoice("not-json")).toBeNull();
    expect(parseJourneymenChoice({ position: "" })).toBeNull();
  });
});
