/**
 * S27.3.14 — Parite stricte FR/EN pour le namespace `popups.*`
 * (composants in-match : `BlockChoicePopup`, `PushChoicePopup`,
 * `FollowUpChoicePopup`, fallbacks de `MatchPopups`).
 *
 * Verifie :
 *  - chaque cle FR a une cle EN equivalente non vide,
 *  - les cles distinctes par design ne sont pas identiques (FR != EN),
 *  - les interpolations declarees fonctionnent comme attendu.
 */
import { describe, it, expect } from "vitest";
import { t } from "./i18n";

const REQUIRED_KEYS = [
  "popups.fallbacks.attacker",
  "popups.fallbacks.defender",
  "popups.fallbacks.player",
  "popups.block.title",
  "popups.block.chooserChoosing",
  "popups.block.chooseA11y",
  "popups.block.results.playerDown",
  "popups.block.results.bothDown",
  "popups.block.results.pushBack",
  "popups.block.results.stumble",
  "popups.block.results.pow",
  "popups.push.title",
  "popups.push.subtitle",
  "popups.push.pushTowardsA11y",
  "popups.followUp.title",
  "popups.followUp.subtitle",
  "popups.followUp.question",
  "popups.followUp.yes",
  "popups.followUp.no",
  "popups.followUp.hint",
] as const;

// Cles ou FR != EN doit etre strictement different.
// "popups.block.results.pow" reste "POW !" / "POW!" (quasi identique
// mais la version FR a un espace insecable typographique). Idem
// "popups.followUp.title" qui contient "Follow-up" (terme du jeu).
const DISTINCT_FR_EN: ReadonlyArray<(typeof REQUIRED_KEYS)[number]> = [
  "popups.fallbacks.attacker",
  "popups.fallbacks.defender",
  "popups.fallbacks.player",
  "popups.block.title",
  "popups.block.chooserChoosing",
  "popups.block.chooseA11y",
  "popups.block.results.playerDown",
  "popups.block.results.bothDown",
  "popups.block.results.pushBack",
  "popups.block.results.stumble",
  "popups.push.title",
  "popups.push.subtitle",
  "popups.push.pushTowardsA11y",
  "popups.followUp.subtitle",
  "popups.followUp.question",
  "popups.followUp.yes",
  "popups.followUp.no",
  "popups.followUp.hint",
];

describe("S27.3.14 — namespace popups.* (FR + EN)", () => {
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

  it("interpolation {{name}} pour popups.block.chooserChoosing (FR)", () => {
    const out = t("popups.block.chooserChoosing", { name: "Reiklander" }, "fr");
    expect(out).toContain("Reiklander");
    expect(out).toContain("choisit");
  });

  it("interpolation {{name}} pour popups.block.chooserChoosing (EN)", () => {
    const out = t("popups.block.chooserChoosing", { name: "Reiklander" }, "en");
    expect(out).toContain("Reiklander");
    expect(out).toContain("chooses");
  });

  it("interpolation {{result}} pour popups.block.chooseA11y (FR)", () => {
    const out = t(
      "popups.block.chooseA11y",
      { result: "Repoussé" },
      "fr",
    );
    expect(out).toContain("Repoussé");
  });

  it("interpolation {{attacker}} et {{target}} pour popups.push.subtitle (FR)", () => {
    const out = t(
      "popups.push.subtitle",
      { attacker: "Bob", target: "Alice" },
      "fr",
    );
    expect(out).toContain("Bob");
    expect(out).toContain("Alice");
  });

  it("interpolation {{attacker}} {{target}} {{x}} {{y}} pour popups.followUp.subtitle (FR)", () => {
    const out = t(
      "popups.followUp.subtitle",
      { attacker: "Bob", target: "Alice", x: 5, y: 7 },
      "fr",
    );
    expect(out).toContain("Bob");
    expect(out).toContain("Alice");
    expect(out).toContain("5");
    expect(out).toContain("7");
  });

  it("interpolation {{label}} pour popups.push.pushTowardsA11y (EN)", () => {
    const out = t(
      "popups.push.pushTowardsA11y",
      { label: "north" },
      "en",
    );
    expect(out).toContain("north");
  });
});
