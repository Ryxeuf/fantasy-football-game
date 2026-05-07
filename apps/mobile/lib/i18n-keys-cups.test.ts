/**
 * S27.3.16 — Parite stricte FR/EN pour le namespace `cups.*`
 * (ecrans `apps/mobile/app/cups/index.tsx`,
 * `apps/mobile/app/cups/[id].tsx`, et
 * `apps/mobile/app/cups/archived.tsx`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN),
 *  - les interpolations declarees fonctionnent comme attendu.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  "cups.public",
  "cups.private",
  "cups.list.title",
  "cups.list.archivedLink",
  "cups.list.filters.all",
  "cups.list.empty",
  "cups.list.errors.loadError",
  "cups.list.errors.prefix",
  "cups.list.card.participantSingular",
  "cups.list.card.participantPlural",
  "cups.archived.title",
  "cups.archived.empty",
  "cups.archived.errors.loadError",
  "cups.archived.errors.prefix",
  "cups.detail.notFound",
  "cups.detail.creatorMeta",
  "cups.detail.sections.participants",
  "cups.detail.sections.standings",
  "cups.detail.sections.matches",
  "cups.detail.participants.empty",
  "cups.detail.participants.summary",
  "cups.detail.standings.empty",
  "cups.detail.standings.headers.team",
  "cups.detail.standings.headers.wins",
  "cups.detail.standings.headers.draws",
  "cups.detail.standings.headers.losses",
  "cups.detail.standings.headers.points",
  "cups.detail.matches.empty",
  "cups.detail.matches.label",
  "cups.detail.errors.loadError",
  "cups.detail.errors.prefix",
] as const;

// Cles ou FR != EN doit etre strictement different (texte traduit).
// Les cles standings.headers.{wins,draws,losses,points} et
// "Participants" sont legitimement identiques FR/EN par design ;
// "{{count}} participant(s)" et "Match {{id}}" sont aussi identiques
// FR/EN car le mot "participant" est le meme dans les deux langues
// et "Match" est utilise tel quel en francais (terme de Blood Bowl).
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "cups.public",
  "cups.private",
  "cups.list.title",
  "cups.list.archivedLink",
  "cups.list.filters.all",
  "cups.list.empty",
  "cups.list.errors.loadError",
  "cups.list.errors.prefix",
  "cups.archived.title",
  "cups.archived.empty",
  "cups.archived.errors.loadError",
  "cups.archived.errors.prefix",
  "cups.detail.notFound",
  "cups.detail.creatorMeta",
  "cups.detail.sections.standings",
  "cups.detail.sections.matches",
  "cups.detail.participants.empty",
  "cups.detail.standings.empty",
  "cups.detail.standings.headers.team",
  "cups.detail.matches.empty",
  "cups.detail.errors.loadError",
  "cups.detail.errors.prefix",
];

describe("S27.3.16 — namespace cups.* (FR + EN)", () => {
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

  it("interpolation {{message}} pour cups.list.errors.prefix (FR)", () => {
    const out = t("cups.list.errors.prefix", { message: "boom" }, "fr");
    expect(out).toContain("boom");
  });

  it("interpolation {{message}} pour cups.archived.errors.prefix (EN)", () => {
    const out = t("cups.archived.errors.prefix", { message: "boom" }, "en");
    expect(out).toContain("boom");
  });

  it("interpolation {{message}} pour cups.detail.errors.prefix (FR)", () => {
    const out = t("cups.detail.errors.prefix", { message: "boom" }, "fr");
    expect(out).toContain("boom");
  });

  it("interpolation {{count}} pour cups.list.card.participantSingular (FR)", () => {
    const out = t("cups.list.card.participantSingular", { count: 1 }, "fr");
    expect(out).toContain("1");
  });

  it("interpolation {{count}} pour cups.list.card.participantPlural (FR)", () => {
    const out = t("cups.list.card.participantPlural", { count: 7 }, "fr");
    expect(out).toContain("7");
  });

  it("interpolation {{creator}} pour cups.detail.creatorMeta (EN)", () => {
    const out = t(
      "cups.detail.creatorMeta",
      { creator: "Alice" },
      "en",
    );
    expect(out).toContain("Alice");
  });

  it("interpolation {{roster}} + {{coach}} pour cups.detail.participants.summary (FR)", () => {
    const out = t(
      "cups.detail.participants.summary",
      { roster: "Orcs", coach: "Bob" },
      "fr",
    );
    expect(out).toContain("Orcs");
    expect(out).toContain("Bob");
  });

  it("interpolation {{id}} pour cups.detail.matches.label (FR)", () => {
    const out = t("cups.detail.matches.label", { id: "abc12345" }, "fr");
    expect(out).toContain("abc12345");
  });
});
