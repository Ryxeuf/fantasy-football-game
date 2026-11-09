import { describe, it, expect } from "vitest";
import {
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
