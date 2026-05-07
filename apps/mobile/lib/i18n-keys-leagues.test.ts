/**
 * S27.3.15 — Parite stricte FR/EN pour le namespace `leagues.*`
 * (ecrans `apps/mobile/app/leagues/index.tsx` et
 * `apps/mobile/app/leagues/[id].tsx`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN),
 *  - les interpolations declarees fonctionnent comme attendu.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  "leagues.public",
  "leagues.private",
  "leagues.list.title",
  "leagues.list.filters.all",
  "leagues.list.empty",
  "leagues.list.errors.loadError",
  "leagues.list.errors.prefix",
  "leagues.list.card.maxParticipants",
  "leagues.detail.notFound",
  "leagues.detail.creatorMeta",
  "leagues.detail.sections.scoring",
  "leagues.detail.sections.seasons",
  "leagues.detail.sections.rounds",
  "leagues.detail.sections.standings",
  "leagues.detail.sections.participants",
  "leagues.detail.scoring.win",
  "leagues.detail.scoring.draw",
  "leagues.detail.scoring.loss",
  "leagues.detail.scoring.forfeit",
  "leagues.detail.seasons.empty",
  "leagues.detail.seasons.tabLabel",
  "leagues.detail.rounds.empty",
  "leagues.detail.rounds.label",
  "leagues.detail.rounds.labelWithName",
  "leagues.detail.standings.empty",
  "leagues.detail.standings.headers.team",
  "leagues.detail.standings.headers.wins",
  "leagues.detail.standings.headers.draws",
  "leagues.detail.standings.headers.losses",
  "leagues.detail.standings.headers.points",
  "leagues.detail.participants.empty",
  "leagues.detail.participants.summary",
  "leagues.detail.errors.loadError",
  "leagues.detail.errors.prefix",
] as const;

// Cles ou FR != EN doit etre strictement different (texte traduit).
// Les cles "V"/"N"/"D"/"Pts" et la formule "summary" partageant les
// memes lettres/format sont legitimement identiques FR/EN.
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "leagues.public",
  "leagues.private",
  "leagues.list.title",
  "leagues.list.filters.all",
  "leagues.list.empty",
  "leagues.list.errors.loadError",
  "leagues.list.errors.prefix",
  "leagues.list.card.maxParticipants",
  "leagues.detail.notFound",
  "leagues.detail.creatorMeta",
  "leagues.detail.sections.scoring",
  "leagues.detail.sections.seasons",
  "leagues.detail.sections.rounds",
  "leagues.detail.sections.standings",
  // sections.participants : "Participants" identique FR/EN par design
  "leagues.detail.scoring.win",
  "leagues.detail.scoring.draw",
  "leagues.detail.scoring.loss",
  "leagues.detail.scoring.forfeit",
  "leagues.detail.seasons.empty",
  "leagues.detail.rounds.empty",
  "leagues.detail.rounds.label",
  "leagues.detail.rounds.labelWithName",
  "leagues.detail.standings.empty",
  "leagues.detail.standings.headers.team",
  "leagues.detail.participants.empty",
  "leagues.detail.errors.loadError",
  "leagues.detail.errors.prefix",
];

describe("S27.3.15 — namespace leagues.* (FR + EN)", () => {
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

  it("interpolation {{message}} pour leagues.list.errors.prefix (FR)", () => {
    const out = t("leagues.list.errors.prefix", { message: "boom" }, "fr");
    expect(out).toContain("boom");
  });

  it("interpolation {{message}} pour leagues.detail.errors.prefix (EN)", () => {
    const out = t("leagues.detail.errors.prefix", { message: "boom" }, "en");
    expect(out).toContain("boom");
  });

  it("interpolation {{count}} pour leagues.list.card.maxParticipants (FR)", () => {
    const out = t("leagues.list.card.maxParticipants", { count: 12 }, "fr");
    expect(out).toContain("12");
  });

  it("interpolation {{number}} + {{name}} pour leagues.detail.seasons.tabLabel (FR)", () => {
    const out = t(
      "leagues.detail.seasons.tabLabel",
      { number: 3, name: "Saison automne" },
      "fr",
    );
    expect(out).toContain("3");
    expect(out).toContain("Saison automne");
  });

  it("interpolation {{number}} + {{name}} pour leagues.detail.rounds.labelWithName (FR)", () => {
    const out = t(
      "leagues.detail.rounds.labelWithName",
      { number: 2, name: "Quart de finale" },
      "fr",
    );
    expect(out).toContain("2");
    expect(out).toContain("Quart de finale");
  });

  it("interpolation {{creator}} + {{count}} pour leagues.detail.creatorMeta (EN)", () => {
    const out = t(
      "leagues.detail.creatorMeta",
      { creator: "Alice", count: 8 },
      "en",
    );
    expect(out).toContain("Alice");
    expect(out).toContain("8");
  });

  it("interpolation {{roster}} + {{coach}} + {{elo}} pour leagues.detail.participants.summary (FR)", () => {
    const out = t(
      "leagues.detail.participants.summary",
      { roster: "Orcs", coach: "Bob", elo: 1234 },
      "fr",
    );
    expect(out).toContain("Orcs");
    expect(out).toContain("Bob");
    expect(out).toContain("1234");
  });
});
