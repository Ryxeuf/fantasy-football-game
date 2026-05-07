/**
 * S27.3.18 — Parite stricte FR/EN pour les namespaces `match.*` et
 * `replay.*` (ecrans `apps/mobile/app/match/[id].tsx` et
 * `apps/mobile/app/replay/[id].tsx`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN),
 *  - les interpolations declarees fonctionnent comme attendu.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  // match
  "match.history.title",
  "match.history.back",
  "match.history.empty",
  "match.history.scoreFinal",
  "match.history.stats.actions",
  "match.history.stats.movesPlayed",
  "match.history.errors.loadError",
  "match.history.errors.prefix",
  "match.history.turnRound",
  "match.history.actionFallback",
  "match.history.turnTypes.start",
  "match.history.turnTypes.accept",
  "match.history.turnTypes.coinToss",
  "match.history.turnTypes.selectKickTeam",
  "match.history.turnTypes.validateSetup",
  "match.history.turnTypes.kickoffSequence",
  "match.history.turnTypes.kickoffScatter",
  "match.history.turnTypes.kickoffEventResolved",
  "match.history.moveTypes.move",
  "match.history.moveTypes.block",
  "match.history.moveTypes.blitz",
  "match.history.moveTypes.pass",
  "match.history.moveTypes.handoff",
  "match.history.moveTypes.foul",
  "match.history.moveTypes.endTurn",
  "match.history.moveTypes.select",
  "match.history.moveTypes.chooseBlockResult",
  "match.history.moveTypes.choosePushDirection",
  "match.history.moveTypes.followUp",
  // replay
  "replay.loading",
  "replay.empty",
  "replay.back",
  "replay.errors.loadError",
  "replay.halfTurn",
  "replay.transport.start",
  "replay.transport.previous",
  "replay.transport.next",
  "replay.transport.end",
  "replay.transport.play",
  "replay.transport.pause",
  "replay.speed.label",
  "replay.speed.a11y",
  "replay.actionLabel",
] as const;

// Cles ou FR != EN doit etre strictement different (texte traduit).
// "Blitz", "Selection" et "Pause" sont legitimement identiques FR/EN
// (termes universels conserves dans les deux langues).
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "match.history.title",
  "match.history.back",
  "match.history.empty",
  "match.history.scoreFinal",
  "match.history.stats.actions",
  "match.history.stats.movesPlayed",
  "match.history.errors.loadError",
  "match.history.errors.prefix",
  "match.history.turnRound",
  "match.history.actionFallback",
  "match.history.turnTypes.start",
  "match.history.turnTypes.accept",
  "match.history.turnTypes.coinToss",
  "match.history.turnTypes.selectKickTeam",
  "match.history.turnTypes.validateSetup",
  "match.history.turnTypes.kickoffSequence",
  "match.history.turnTypes.kickoffScatter",
  "match.history.turnTypes.kickoffEventResolved",
  "match.history.moveTypes.move",
  "match.history.moveTypes.block",
  "match.history.moveTypes.pass",
  "match.history.moveTypes.handoff",
  "match.history.moveTypes.foul",
  "match.history.moveTypes.endTurn",
  "match.history.moveTypes.chooseBlockResult",
  "match.history.moveTypes.choosePushDirection",
  "match.history.moveTypes.followUp",
  "replay.loading",
  "replay.empty",
  "replay.back",
  "replay.errors.loadError",
  "replay.halfTurn",
  "replay.transport.start",
  "replay.transport.previous",
  "replay.transport.next",
  "replay.transport.end",
  "replay.transport.play",
  "replay.speed.label",
  "replay.speed.a11y",
  "replay.actionLabel",
];

describe("S27.3.18 — namespaces match.* et replay.* (FR + EN)", () => {
  for (const key of REQUIRED_KEYS) {
    it(`FR non-vide pour ${key}`, () => {
      const fr = t(key, undefined, "fr");
      expect(fr).not.toEqual(key);
      expect(fr.length).toBeGreaterThan(0);
    });
    it(`EN non-vide pour ${key}`, () => {
      const en = t(key, undefined, "en");
      expect(en).not.toEqual(key);
      expect(en.length).toBeGreaterThan(0);
    });
  }

  for (const key of DISTINCT_FR_EN) {
    it(`FR != EN pour ${key}`, () => {
      const fr = t(key, undefined, "fr");
      const en = t(key, undefined, "en");
      expect(fr).not.toEqual(en);
    });
  }

  it("interpolation {{teamA}}+{{teamB}} pour match.history.scoreFinal (FR)", () => {
    const out = t(
      "match.history.scoreFinal",
      { teamA: 2, teamB: 1 },
      "fr",
    );
    expect(out).toContain("2");
    expect(out).toContain("1");
  });

  it("interpolation {{half}}+{{turn}} pour match.history.turnRound (EN)", () => {
    const out = t("match.history.turnRound", { half: 1, turn: 8 }, "en");
    expect(out).toContain("1");
    expect(out).toContain("8");
  });

  it("interpolation {{message}} pour match.history.errors.prefix (FR)", () => {
    const out = t("match.history.errors.prefix", { message: "boom" }, "fr");
    expect(out).toContain("boom");
  });

  it("interpolation {{half}}+{{turn}} pour replay.halfTurn (FR)", () => {
    const out = t("replay.halfTurn", { half: 2, turn: 4 }, "fr");
    expect(out).toContain("2");
    expect(out).toContain("4");
  });

  it("interpolation {{label}} pour replay.speed.a11y (EN)", () => {
    const out = t("replay.speed.a11y", { label: "x2" }, "en");
    expect(out).toContain("x2");
  });

  it("interpolation {{label}} pour replay.actionLabel (FR)", () => {
    const out = t("replay.actionLabel", { label: "Blitz" }, "fr");
    expect(out).toContain("Blitz");
  });
});
