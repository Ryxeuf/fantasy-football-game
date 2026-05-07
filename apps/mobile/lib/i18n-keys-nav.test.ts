/**
 * S27.3.19 — Parite stricte FR/EN pour le namespace `nav.*`
 * (titres de Stack.Screen dans `apps/mobile/app/_layout.tsx`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN).
 *
 * Cloture S27.3 (i18n complet mobile) : audit baseline a 0.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  "nav.appName",
  "nav.lobby",
  "nav.matchmaking",
  "nav.leaderboard",
  "nav.login",
  "nav.register",
  "nav.matchHistory",
  "nav.replay",
  "nav.teamsList",
  "nav.teamsNew",
  "nav.teamsDetail",
  "nav.cupsList",
  "nav.cupsArchived",
  "nav.cupsDetail",
  "nav.leaguesList",
  "nav.leaguesDetail",
  "nav.starPlayersList",
  "nav.starPlayersDetail",
  "nav.settings",
] as const;

// Cles ou FR != EN doit etre strictement different (texte traduit).
// "Nuffle Arena" et "Star Players" / "Star Player" sont legitimement
// identiques FR/EN (noms propres / termes de domaine Blood Bowl) ;
// idem "Replay" (terme universel).
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "nav.lobby",
  "nav.matchmaking",
  "nav.leaderboard",
  "nav.login",
  "nav.register",
  "nav.matchHistory",
  "nav.teamsList",
  "nav.teamsNew",
  "nav.teamsDetail",
  "nav.cupsList",
  "nav.cupsArchived",
  "nav.cupsDetail",
  "nav.leaguesList",
  "nav.leaguesDetail",
  "nav.settings",
];

describe("S27.3.19 — namespace nav.* (FR + EN)", () => {
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
});
