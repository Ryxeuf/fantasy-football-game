/**
 * S27.3.17 — Parite stricte FR/EN pour le namespace `starPlayers.*`
 * (ecrans `apps/mobile/app/star-players/index.tsx` et
 * `apps/mobile/app/star-players/[slug].tsx`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN),
 *  - les interpolations declarees fonctionnent comme attendu.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  "starPlayers.megaStarBadge",
  "starPlayers.list.title",
  "starPlayers.list.subtitleSingular",
  "starPlayers.list.subtitlePlural",
  "starPlayers.list.subtitleFiltered",
  "starPlayers.list.search.placeholder",
  "starPlayers.list.ruleset.season3",
  "starPlayers.list.ruleset.season2",
  "starPlayers.list.megaToggle.on",
  "starPlayers.list.megaToggle.off",
  "starPlayers.list.empty",
  "starPlayers.list.row.hirable",
  "starPlayers.list.errors.loadError",
  "starPlayers.list.errors.prefix",
  "starPlayers.detail.notFound",
  "starPlayers.detail.imageA11y",
  "starPlayers.detail.sections.stats",
  "starPlayers.detail.sections.skills",
  "starPlayers.detail.sections.hirable",
  "starPlayers.detail.sections.specialRule",
  "starPlayers.detail.skills.empty",
  "starPlayers.detail.actions.back",
  "starPlayers.detail.actions.backToCatalog",
  "starPlayers.detail.errors.loadError",
] as const;

// Cles ou FR != EN doit etre strictement different (texte traduit).
// "Mega Star" et "Star Player" sont legitimement identiques FR/EN
// (termes de domaine Blood Bowl conserves en anglais) ; idem
// "Mega stars ({{count}})" qui partage la meme structure FR/EN.
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "starPlayers.list.title",
  "starPlayers.list.subtitleSingular",
  "starPlayers.list.subtitlePlural",
  "starPlayers.list.subtitleFiltered",
  "starPlayers.list.search.placeholder",
  "starPlayers.list.ruleset.season3",
  "starPlayers.list.ruleset.season2",
  "starPlayers.list.megaToggle.on",
  "starPlayers.list.empty",
  "starPlayers.list.row.hirable",
  "starPlayers.list.errors.loadError",
  "starPlayers.list.errors.prefix",
  "starPlayers.detail.notFound",
  "starPlayers.detail.imageA11y",
  "starPlayers.detail.sections.stats",
  "starPlayers.detail.sections.skills",
  "starPlayers.detail.sections.hirable",
  "starPlayers.detail.sections.specialRule",
  "starPlayers.detail.skills.empty",
  "starPlayers.detail.actions.back",
  "starPlayers.detail.actions.backToCatalog",
  "starPlayers.detail.errors.loadError",
];

describe("S27.3.17 — namespace starPlayers.* (FR + EN)", () => {
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

  it("interpolation {{count}} pour subtitleSingular (FR)", () => {
    const out = t(
      "starPlayers.list.subtitleSingular",
      { count: 1 },
      "fr",
    );
    expect(out).toContain("1");
  });

  it("interpolation {{count}} pour subtitlePlural (EN)", () => {
    const out = t(
      "starPlayers.list.subtitlePlural",
      { count: 5 },
      "en",
    );
    expect(out).toContain("5");
  });

  it("interpolation {{total}} pour subtitleFiltered (FR)", () => {
    const out = t(
      "starPlayers.list.subtitleFiltered",
      { total: 42 },
      "fr",
    );
    expect(out).toContain("42");
  });

  it("interpolation {{count}} pour megaToggle.off (FR)", () => {
    const out = t(
      "starPlayers.list.megaToggle.off",
      { count: 9 },
      "fr",
    );
    expect(out).toContain("9");
  });

  it("interpolation {{hirable}} pour list.row.hirable (FR)", () => {
    const out = t(
      "starPlayers.list.row.hirable",
      { hirable: "Skaven" },
      "fr",
    );
    expect(out).toContain("Skaven");
  });

  it("interpolation {{message}} pour list.errors.prefix (EN)", () => {
    const out = t(
      "starPlayers.list.errors.prefix",
      { message: "boom" },
      "en",
    );
    expect(out).toContain("boom");
  });

  it("interpolation {{name}} pour detail.imageA11y (FR)", () => {
    const out = t(
      "starPlayers.detail.imageA11y",
      { name: "Griff Oberwald" },
      "fr",
    );
    expect(out).toContain("Griff Oberwald");
  });
});
