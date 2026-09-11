/**
 * `buildSheetSummaryOptions` — les options du summarizer d'une feuille,
 * partagées entre la feuille, les classements de saison et la
 * resynchronisation : compétences du coup d'envoi + Prières.
 */
import { describe, it, expect } from "vitest";
import { buildSheetSummaryOptions } from "./league-sheet-summary-options";
import { summarizeMatchSheet } from "./league-match-summary";

const live = (id: string, number: number, name: string, skills: string | null) => ({
  id,
  number,
  name,
  skills,
});

describe("buildSheetSummaryOptions", () => {
  it("sans gel ni prière : compétences live, aucun côté sous Frénésie", () => {
    const options = buildSheetSummaryOptions(
      {
        home: [live("h1", 1, "Griff", "violent-innovator"), live("h2", 2, "Zug", "")],
        away: [live("a1", 1, "Ork", "fatal-flight")],
      },
      {},
    );
    expect([...(options.violentInnovators ?? [])]).toEqual(["h1"]);
    expect([...(options.fatalFlighters ?? [])]).toEqual(["a1"]);
    expect(options.foulingFrenzy).toEqual({ home: false, away: false });
  });

  it("chaque côté est rapproché de SON gel (les numéros se répètent)", () => {
    // Le n°1 domicile a Innovateur Violent au coup d'envoi, pas le n°1
    // extérieur — même numéro, gels distincts.
    const options = buildSheetSummaryOptions(
      {
        home: [live("h1", 1, "Griff", "")],
        away: [live("a1", 1, "Ork", "")],
      },
      {
        rosterSnapshotHome: {
          players: [{ number: 1, name: "Griff", skills: "violent-innovator" }],
        },
        rosterSnapshotAway: JSON.stringify({
          players: [{ number: 1, name: "Ork", skills: "block" }],
        }),
      },
    );
    expect([...(options.violentInnovators ?? [])]).toEqual(["h1"]);
  });

  it("les Prières ne bénissent que leur côté", () => {
    const options = buildSheetSummaryOptions(
      { home: [], away: [] },
      { prayersAway: [{ roll: 13, prayerId: "fouling-frenzy" }] },
    );
    expect(options.foulingFrenzy).toEqual({ home: false, away: true });
  });

  it("alimente le summarizer : l'agression bénie devient une sortie", () => {
    const options = buildSheetSummaryOptions(
      { home: [live("h1", 1, "Griff", "")], away: [] },
      { prayersHome: [{ roll: 13 }] },
    );
    const out = summarizeMatchSheet(
      [
        {
          kind: "aggression",
          team: "home",
          actorPlayerId: "h1",
          targetPlayerId: "a9",
          injurySeverity: "mng",
        },
      ],
      options,
    );
    expect(out.casualtiesHome).toBe(1);
    expect(out.playerStats[0]?.casualtiesInflicted).toBe(1);
  });
});
