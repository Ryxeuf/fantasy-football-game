/**
 * E45 — PSP accordés par les Prières à Nuffle liées à la passe.
 *
 * Le réceptionneur d'une passe est saisi sur la feuille (et compté par le
 * summarizer) mais ne gagnait AUCUN PSP : c'est la Prière « Réception
 * Étourdissante » qui doit lui en accorder un. « Passe Parfaite » double
 * de son côté la Réussite du lanceur.
 */

import { describe, it, expect } from "vitest";
import {
  applyPrayerSppBonuses,
  computePrayerSppBonuses,
  parseSheetPrayers,
  prayerSppEffects,
  PERFECT_PASSING_ROLL,
  STUNNING_CATCH_ROLL,
} from "./league-sheet-prayer-spp";
import type { MatchSummary, PlayerStatLine } from "./league-match-summary";

function stat(
  over: Partial<PlayerStatLine> & { playerId: string },
): PlayerStatLine {
  return {
    side: "home",
    touchdowns: 0,
    casualtiesInflicted: 0,
    completions: 0,
    receptions: 0,
    interceptions: 0,
    aggressions: 0,
    ttmLandings: 0,
    ...over,
  };
}

function summary(playerStats: PlayerStatLine[]): MatchSummary {
  return {
    scoreHome: 0,
    scoreAway: 0,
    casualtiesHome: 0,
    casualtiesAway: 0,
    injuries: [],
    playerStats,
  };
}

describe("parseSheetPrayers", () => {
  it("lit le tableau natif (PG)", () => {
    expect(
      parseSheetPrayers([{ roll: 11, prayerId: "stunning-catch" }]),
    ).toEqual([{ roll: 11, prayerId: "stunning-catch" }]);
  });

  it("lit la chaîne JSON du miroir sqlite", () => {
    expect(parseSheetPrayers(JSON.stringify([{ roll: 10 }]))).toEqual([
      { roll: 10, prayerId: null },
    ]);
  });

  it("reste tolérant : null, chaîne illisible, entrées non-objet", () => {
    expect(parseSheetPrayers(null)).toEqual([]);
    expect(parseSheetPrayers("{oops")).toEqual([]);
    expect(parseSheetPrayers([null, 3, { roll: "x" }])).toEqual([
      { roll: null, prayerId: null },
    ]);
  });
});

describe("prayerSppEffects", () => {
  it("reconnaît la prière par son JET (la donnée saisie fait foi)", () => {
    expect(prayerSppEffects([{ roll: STUNNING_CATCH_ROLL }])).toEqual({
      perfectPassing: false,
      stunningCatch: true,
    });
    expect(prayerSppEffects([{ roll: PERFECT_PASSING_ROLL }])).toEqual({
      perfectPassing: true,
      stunningCatch: false,
    });
  });

  it("reconnaît aussi la prière par son identifiant seul", () => {
    expect(
      prayerSppEffects([{ prayerId: "stunning-catch" }]).stunningCatch,
    ).toBe(true);
  });

  it("une prière sans effet sur les PSP ne change rien", () => {
    expect(
      prayerSppEffects([{ roll: 9, prayerId: "moles-under-the-pitch" }]),
    ).toEqual({ perfectPassing: false, stunningCatch: false });
  });
});

describe("computePrayerSppBonuses", () => {
  const lanceur = stat({ playerId: "p-lanceur", completions: 2 });
  const receveur = stat({ playerId: "p-receveur", receptions: 2 });

  it("aucune prière : aucun bonus", () => {
    expect(
      computePrayerSppBonuses({
        summary: summary([lanceur, receveur]),
        prayersHome: null,
        prayersAway: null,
      }),
    ).toEqual([]);
  });

  it("« Réception Étourdissante » : 1 PSP par réception", () => {
    const out = computePrayerSppBonuses({
      summary: summary([lanceur, receveur]),
      prayersHome: [{ roll: STUNNING_CATCH_ROLL }],
      prayersAway: null,
    });
    expect(out).toEqual([
      {
        playerId: "p-receveur",
        side: "home",
        spp: 2,
        prayerIds: ["stunning-catch"],
      },
    ]);
  });

  it("« Passe Parfaite » : +1 PSP par Réussite (2 au lieu de 1)", () => {
    const out = computePrayerSppBonuses({
      summary: summary([lanceur, receveur]),
      prayersHome: [{ roll: PERFECT_PASSING_ROLL }],
      prayersAway: null,
    });
    expect(out).toEqual([
      {
        playerId: "p-lanceur",
        side: "home",
        spp: 2,
        prayerIds: ["perfect-passing"],
      },
    ]);
  });

  it("les deux prières se cumulent sur un joueur qui lance ET réceptionne", () => {
    const out = computePrayerSppBonuses({
      summary: summary([
        stat({ playerId: "p1", completions: 1, receptions: 3 }),
      ]),
      prayersHome: [
        { roll: PERFECT_PASSING_ROLL },
        { roll: STUNNING_CATCH_ROLL },
      ],
      prayersAway: null,
    });
    expect(out).toEqual([
      {
        playerId: "p1",
        side: "home",
        spp: 4,
        prayerIds: ["perfect-passing", "stunning-catch"],
      },
    ]);
  });

  // Une prière est payée par UNE équipe : elle ne récompense qu'elle.
  it("la prière du domicile ne récompense pas l'extérieur", () => {
    const out = computePrayerSppBonuses({
      summary: summary([
        stat({ playerId: "home-1", side: "home", receptions: 1 }),
        stat({ playerId: "away-1", side: "away", receptions: 1 }),
      ]),
      prayersHome: [{ roll: STUNNING_CATCH_ROLL }],
      prayersAway: null,
    });
    expect(out.map((b) => b.playerId)).toEqual(["home-1"]);
  });

  it("chaque côté applique SES prières", () => {
    const out = computePrayerSppBonuses({
      summary: summary([
        stat({ playerId: "home-1", side: "home", receptions: 1 }),
        stat({ playerId: "away-1", side: "away", completions: 1 }),
      ]),
      prayersHome: [{ roll: STUNNING_CATCH_ROLL }],
      prayersAway: [{ roll: PERFECT_PASSING_ROLL }],
    });
    expect(out).toEqual([
      {
        playerId: "home-1",
        side: "home",
        spp: 1,
        prayerIds: ["stunning-catch"],
      },
      {
        playerId: "away-1",
        side: "away",
        spp: 1,
        prayerIds: ["perfect-passing"],
      },
    ]);
  });

  it("un joueur sans passe ni réception n'entre pas dans la liste", () => {
    const out = computePrayerSppBonuses({
      summary: summary([stat({ playerId: "p-td", touchdowns: 3 })]),
      prayersHome: [
        { roll: PERFECT_PASSING_ROLL },
        { roll: STUNNING_CATCH_ROLL },
      ],
      prayersAway: null,
    });
    expect(out).toEqual([]);
  });
});

describe("applyPrayerSppBonuses", () => {
  it("ajoute le bonus sans muter la table d'entrée", () => {
    const base = Object.freeze({ "p-lanceur": 3 });
    const out = applyPrayerSppBonuses(base, [
      {
        playerId: "p-lanceur",
        side: "home",
        spp: 2,
        prayerIds: ["perfect-passing"],
      },
    ]);
    expect(out).toEqual({ "p-lanceur": 5 });
    expect(base).toEqual({ "p-lanceur": 3 });
  });

  // Le réceptionneur pur n'a ni TD ni Réussite : sans cette entrée, il
  // resterait absent de la table des PSP du match.
  it("fait entrer un joueur qui n'avait aucun PSP au barème", () => {
    expect(
      applyPrayerSppBonuses({}, [
        {
          playerId: "p-receveur",
          side: "home",
          spp: 1,
          prayerIds: ["stunning-catch"],
        },
      ]),
    ).toEqual({ "p-receveur": 1 });
  });
});
