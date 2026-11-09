import { describe, it, expect } from "vitest";
import {
  decidePlayoffReplacement,
  decidePlayoffReset,
  isPlaceholderPairing,
  isPlayoffPairingEngaged,
  type PlayoffPairingState,
} from "./league-playoff-edit-rules";

function pairing(over: Partial<PlayoffPairingState> = {}): PlayoffPairingState {
  return {
    id: "p1",
    status: "scheduled",
    homeParticipantId: "a",
    awayParticipantId: "b",
    matchId: null,
    sheetStatus: null,
    sheetEventCount: 0,
    ...over,
  };
}

describe("isPlayoffPairingEngaged", () => {
  it.each([
    ["rencontre à jouer, sans feuille", {}, false],
    ["rencontre annulée", { status: "cancelled" }, false],
    ["feuille en brouillon vide", { sheetStatus: "draft" }, false],
    ["rencontre jouée", { status: "played" }, true],
    ["forfait", { status: "forfeit_home" }, true],
    ["en cours", { status: "in_progress" }, true],
    ["match en ligne lancé", { matchId: "m1" }, true],
    ["feuille soumise par un coach", { sheetStatus: "submitted_home" }, true],
    ["feuille soumise par les deux", { sheetStatus: "both_submitted" }, true],
    ["feuille validée", { sheetStatus: "validated" }, true],
    ["feuille en correction", { sheetStatus: "invalidated" }, true],
    [
      "brouillon qui porte des évènements",
      { sheetStatus: "draft", sheetEventCount: 2 },
      true,
    ],
  ] as const)("%s ⇒ %s", (_label, over, expected) => {
    expect(isPlayoffPairingEngaged(pairing(over))).toBe(expected);
  });
});

describe("isPlaceholderPairing", () => {
  it("home === away est un placeholder", () => {
    expect(
      isPlaceholderPairing({ homeParticipantId: "a", awayParticipantId: "a" }),
    ).toBe(true);
    expect(
      isPlaceholderPairing({ homeParticipantId: "a", awayParticipantId: "b" }),
    ).toBe(false);
  });
});

describe("decidePlayoffReset", () => {
  it("accepte un bracket dont aucune rencontre n'est engagée", () => {
    const out = decidePlayoffReset({
      seasonStatus: "in_progress",
      rounds: [
        { pairings: [pairing({ id: "sf1" })] },
        { pairings: [pairing({ id: "sf2", sheetStatus: "draft" })] },
      ],
    });
    expect(out).toEqual({ ok: true, roundCount: 2 });
  });

  it("refuse une saison clôturée", () => {
    const out = decidePlayoffReset({
      seasonStatus: "completed",
      rounds: [{ pairings: [pairing()] }],
    });
    expect(out).toMatchObject({ ok: false, code: "season_completed" });
  });

  it("refuse quand il n'y a pas de bracket", () => {
    const out = decidePlayoffReset({ seasonStatus: "in_progress", rounds: [] });
    expect(out).toMatchObject({ ok: false, code: "no_bracket" });
  });

  it("refuse et désigne les rencontres engagées", () => {
    const out = decidePlayoffReset({
      seasonStatus: "in_progress",
      rounds: [
        { pairings: [pairing({ id: "sf1", status: "played" })] },
        { pairings: [pairing({ id: "sf2", sheetStatus: "submitted_away" })] },
        { pairings: [pairing({ id: "final" })] },
      ],
    });
    expect(out).toMatchObject({
      ok: false,
      code: "bracket_engaged",
      engagedPairingIds: ["sf1", "sf2"],
    });
  });
});

describe("decidePlayoffReplacement", () => {
  // Bracket à 4 : sf1 jouée (a bat b), sf2 jouée (c bat d), finale a vs c
  // à jouer. Le finaliste c quitte la ligue, le commissaire repêche d.
  const sf1 = pairing({
    id: "sf1",
    status: "played",
    homeParticipantId: "a",
    awayParticipantId: "b",
  });
  const sf2 = pairing({
    id: "sf2",
    status: "played",
    homeParticipantId: "c",
    awayParticipantId: "d",
  });
  const final = pairing({
    id: "final",
    homeParticipantId: "a",
    awayParticipantId: "c",
  });
  const bracketPairings = [sf1, sf2, final];
  type Input = Parameters<typeof decidePlayoffReplacement>[0];

  function decide(over: Partial<Input> = {}) {
    return decidePlayoffReplacement({
      seasonId: "s1",
      seasonStatus: "in_progress",
      pairing: { ...final, isBracket: true },
      side: "away",
      replacement: { id: "d", seasonId: "s1", status: "active" },
      bracketPairings,
      ...over,
    });
  }

  it("remplace un finaliste par une équipe éliminée plus tôt", () => {
    expect(decide()).toEqual({
      ok: true,
      replacedParticipantId: "c",
      data: { homeParticipantId: "a", awayParticipantId: "d" },
    });
  });

  it("côté domicile", () => {
    expect(
      decide({
        side: "home",
        replacement: { id: "b", seasonId: "s1", status: "active" },
      }),
    ).toMatchObject({
      ok: true,
      replacedParticipantId: "a",
      data: { homeParticipantId: "b", awayParticipantId: "c" },
    });
  });

  it("placeholder : remplace le qualifié connu sur LES DEUX côtés, quel que soit `side`", () => {
    const ph = pairing({
      id: "final",
      homeParticipantId: "a",
      awayParticipantId: "a",
    });
    for (const side of ["home", "away"] as const) {
      expect(
        decide({
          pairing: { ...ph, isBracket: true },
          side,
          bracketPairings: [sf1, ph],
          replacement: { id: "b", seasonId: "s1", status: "active" },
        }),
      ).toEqual({
        ok: true,
        replacedParticipantId: "a",
        data: { homeParticipantId: "b", awayParticipantId: "b" },
      });
    }
  });

  const refusals: ReadonlyArray<[string, Partial<Input>, string]> = [
    [
      "rencontre hors bracket",
      { pairing: { ...final, isBracket: false } },
      "not_a_bracket_pairing",
    ],
    ["saison clôturée", { seasonStatus: "completed" }, "season_completed"],
    [
      "rencontre jouée",
      { pairing: { ...final, status: "played", isBracket: true } },
      "pairing_closed",
    ],
    [
      "rencontre annulée",
      { pairing: { ...final, status: "cancelled", isBracket: true } },
      "pairing_closed",
    ],
    [
      "feuille soumise",
      {
        pairing: { ...final, sheetStatus: "submitted_home", isBracket: true },
      },
      "pairing_engaged",
    ],
    [
      "brouillon avec évènements",
      {
        pairing: {
          ...final,
          sheetStatus: "draft",
          sheetEventCount: 1,
          isBracket: true,
        },
      },
      "pairing_engaged",
    ],
    [
      "match en ligne lancé",
      { pairing: { ...final, matchId: "m1", isBracket: true } },
      "pairing_engaged",
    ],
    ["remplaçant introuvable", { replacement: null }, "participant_not_found"],
    [
      "remplaçant d'une autre saison",
      { replacement: { id: "d", seasonId: "s2", status: "active" } },
      "participant_not_found",
    ],
    [
      "remplaçant retiré",
      { replacement: { id: "d", seasonId: "s1", status: "withdrawn" } },
      "participant_not_active",
    ],
    [
      "même équipe",
      { replacement: { id: "c", seasonId: "s1", status: "active" } },
      "no_change",
    ],
    [
      "l'adversaire de la rencontre",
      { replacement: { id: "a", seasonId: "s1", status: "active" } },
      "participant_already_in_bracket",
    ],
  ];
  it.each(refusals)("refuse : %s", (_label, over, code) => {
    expect(decide(over)).toMatchObject({ ok: false, code });
  });

  it("refuse une équipe qui a déjà une autre rencontre de bracket à jouer", () => {
    const sf1Open = pairing({
      id: "sf1",
      homeParticipantId: "a",
      awayParticipantId: "b",
    });
    const sf2Open = pairing({
      id: "sf2",
      homeParticipantId: "c",
      awayParticipantId: "d",
    });
    expect(
      decide({
        pairing: { ...sf2Open, isBracket: true },
        side: "away",
        replacement: { id: "b", seasonId: "s1", status: "active" },
        bracketPairings: [sf1Open, sf2Open],
      }),
    ).toMatchObject({ ok: false, code: "participant_already_in_bracket" });
  });

  it("accepte qu'une rencontre SŒUR du bracket soit déjà jouée", () => {
    const sf1Played = pairing({
      id: "sf1",
      status: "played",
      homeParticipantId: "a",
      awayParticipantId: "b",
    });
    const sf2Open = pairing({
      id: "sf2",
      homeParticipantId: "c",
      awayParticipantId: "d",
    });
    expect(
      decide({
        pairing: { ...sf2Open, isBracket: true },
        side: "away",
        replacement: { id: "e", seasonId: "s1", status: "active" },
        bracketPairings: [sf1Played, sf2Open],
      }),
    ).toMatchObject({ ok: true, replacedParticipantId: "d" });
  });
});
