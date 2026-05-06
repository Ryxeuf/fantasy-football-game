/**
 * S27.3.13 — Parite stricte FR/EN pour le namespace `play.*`
 * (ecran `apps/mobile/app/play/[id].tsx`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN),
 *  - les interpolations declarees ({{message}}) fonctionnent comme
 *    attendu.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  "play.loading",
  "play.noState",
  "play.errors.loadError",
  "play.errors.actionError",
  "play.errors.prefix",
  "play.banner.myTurn",
  "play.banner.opponentTurn",
  "play.banner.offline",
  "play.actions.throwTeamMate",
  "play.actions.cancelTarget",
  "play.actions.cancelThrower",
  "play.actions.endTurn",
  "play.actions.back",
  "play.hint",
] as const;

// Cles ou FR != EN doit etre strictement different (texte traduit).
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "play.loading",
  "play.noState",
  "play.errors.loadError",
  "play.errors.actionError",
  "play.errors.prefix",
  "play.banner.myTurn",
  "play.banner.opponentTurn",
  "play.banner.offline",
  "play.actions.throwTeamMate",
  "play.actions.cancelTarget",
  "play.actions.cancelThrower",
  "play.actions.endTurn",
  "play.actions.back",
  "play.hint",
];

describe("S27.3.13 — namespace play.* (FR + EN)", () => {
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

  it("interpolation {{message}} pour play.errors.prefix (FR)", () => {
    const out = t("play.errors.prefix", { message: "boom" }, "fr");
    expect(out).toContain("boom");
  });

  it("interpolation {{message}} pour play.errors.prefix (EN)", () => {
    const out = t("play.errors.prefix", { message: "boom" }, "en");
    expect(out).toContain("boom");
  });
});
