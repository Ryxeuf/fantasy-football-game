/**
 * S27.3.12 — Parite stricte FR/EN pour le namespace `players.detail.*`
 * (ecran `apps/mobile/app/player/[teamId]/[playerId].tsx`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN),
 *  - les interpolations declarees ({{count}}, {{value}}, {{stat}})
 *    fonctionnent comme attendu.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  "players.detail.notFound",
  "players.detail.teamNotFound",
  "players.detail.backToTeam",
  "players.detail.backButton",
  "players.detail.subtitle",
  "players.detail.statBase",
  "players.detail.status.dead",
  "players.detail.status.missNextMatch",
  "players.detail.status.injured",
  "players.detail.status.fit",
  "players.detail.sections.stats",
  "players.detail.sections.progression",
  "players.detail.sections.skills",
  "players.detail.sections.advancements",
  "players.detail.sections.nextAdvancement",
  "players.detail.sections.injuries",
  "players.detail.progression.spp",
  "players.detail.progression.matchesPlayed",
  "players.detail.progression.touchdowns",
  "players.detail.progression.casualties",
  "players.detail.progression.completions",
  "players.detail.progression.interceptions",
  "players.detail.progression.mvp",
  "players.detail.progression.advancementsCount",
  "players.detail.skills.empty",
  "players.detail.advancements.empty",
  "players.detail.advancements.deadPlayer",
  "players.detail.advancements.types.primary",
  "players.detail.advancements.types.secondary",
  "players.detail.advancements.types.randomPrimary",
  "players.detail.advancements.types.randomSecondary",
  "players.detail.advancements.types.characteristic",
  "players.detail.injuries.empty",
  "players.detail.injuries.niggling",
  "players.detail.injuries.statReduction",
  "players.detail.injuries.missNextMatch",
  "players.detail.errors.loadError",
] as const;

// Cles ou FR != EN doit etre strictement different (texte traduit).
// Les autres peuvent legitimement etre identiques (termes universels :
// "MVP", "Progression", "Interceptions" ; formats `{{...}}` purs).
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "players.detail.notFound",
  "players.detail.teamNotFound",
  "players.detail.backToTeam",
  "players.detail.status.dead",
  "players.detail.status.missNextMatch",
  "players.detail.status.injured",
  "players.detail.status.fit",
  "players.detail.sections.stats",
  "players.detail.sections.skills",
  "players.detail.sections.advancements",
  "players.detail.sections.nextAdvancement",
  "players.detail.sections.injuries",
  "players.detail.progression.matchesPlayed",
  "players.detail.progression.touchdowns",
  "players.detail.progression.casualties",
  "players.detail.progression.completions",
  "players.detail.progression.advancementsCount",
  "players.detail.skills.empty",
  "players.detail.advancements.empty",
  "players.detail.advancements.deadPlayer",
  "players.detail.advancements.types.primary",
  "players.detail.advancements.types.secondary",
  "players.detail.advancements.types.randomPrimary",
  "players.detail.advancements.types.randomSecondary",
  "players.detail.advancements.types.characteristic",
  "players.detail.injuries.empty",
  "players.detail.injuries.niggling",
  "players.detail.injuries.missNextMatch",
  "players.detail.errors.loadError",
];

describe("S27.3.12 — i18n players.detail (parite FR/EN)", () => {
  for (const key of REQUIRED_KEYS) {
    it(`FR has a non-empty value for ${key}`, () => {
      expect(t(key, undefined, "fr").length).toBeGreaterThan(0);
    });

    it(`EN has a non-empty value for ${key}`, () => {
      // S'il n'existe pas, le module retourne la cle FR brute.
      // On verifie que ce n'est pas la cle elle-meme (signal d'absence).
      const value = t(key, undefined, "en");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    });
  }

  for (const key of DISTINCT_FR_EN) {
    it(`FR != EN for ${key}`, () => {
      const fr = t(key, undefined, "fr");
      const en = t(key, undefined, "en");
      expect(fr).not.toBe(en);
    });
  }

  it("interpolates {{count}} on niggling injuries (FR)", () => {
    const value = t("players.detail.injuries.niggling", { count: 3 }, "fr");
    expect(value).toContain("3");
  });

  it("interpolates {{count}} on niggling injuries (EN)", () => {
    const value = t("players.detail.injuries.niggling", { count: 3 }, "en");
    expect(value).toContain("3");
  });

  it("interpolates {{stat}} and {{value}} on stat-reduction injuries", () => {
    const fr = t(
      "players.detail.injuries.statReduction",
      { stat: "MA", value: 2 },
      "fr",
    );
    expect(fr).toContain("MA");
    expect(fr).toContain("2");

    const en = t(
      "players.detail.injuries.statReduction",
      { stat: "MA", value: 2 },
      "en",
    );
    expect(en).toContain("MA");
    expect(en).toContain("2");
  });

});
