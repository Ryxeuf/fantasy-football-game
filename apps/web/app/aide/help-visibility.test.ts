import { describe, expect, it } from "vitest";
import type { HelpCategory } from "./help-catalogue";
import { isHelpFeatureVisible, parseGlobalFlags, visibleHelpCategories } from "./help-visibility";

const CATEGORIES: readonly HelpCategory[] = [
  {
    id: "jouer",
    title: "Jouer",
    icon: "🎮",
    intro: "…",
    features: [
      {
        id: "jouer-en-ligne",
        title: "Jouer en ligne",
        icon: "⚔️",
        href: "/play",
        access: "account",
        flags: ["online_play"],
        description: "…",
      },
    ],
  },
  {
    id: "equipes",
    title: "Équipes",
    icon: "⚽",
    intro: "…",
    features: [
      {
        id: "mes-equipes",
        title: "Mes équipes",
        icon: "⚽",
        href: "/me/teams",
        access: "account",
        description: "…",
        links: [
          { label: "Créer", href: "/me/teams/new" },
          { label: "Thèmes de dés", href: "/me/shop/dice-themes", flags: ["dice_themes"] },
        ],
      },
    ],
  },
];

describe("isHelpFeatureVisible", () => {
  it("liste toujours une fonctionnalité sans flag", () => {
    expect(isHelpFeatureVisible({}, new Set())).toBe(true);
  });

  it("ne liste une fonctionnalité gatée que si son flag est ouvert à tous", () => {
    expect(isHelpFeatureVisible({ flags: ["online_play"] }, new Set())).toBe(false);
    expect(isHelpFeatureVisible({ flags: ["online_play"] }, new Set(["online_play"]))).toBe(true);
  });

  it("exige TOUS les flags d'une fonctionnalité doublement gatée", () => {
    const ai = { flags: ["online_play", "ai_training"] };
    expect(isHelpFeatureVisible(ai, new Set(["ai_training"]))).toBe(false);
    expect(isHelpFeatureVisible(ai, new Set(["online_play", "ai_training"]))).toBe(true);
  });
});

describe("visibleHelpCategories", () => {
  it("retire les fonctionnalités et liens gatés, puis les catégories vides", () => {
    const visible = visibleHelpCategories(CATEGORIES, new Set());
    expect(visible.map((c) => c.id)).toEqual(["equipes"]);
    expect(visible[0].features[0].links?.map((l) => l.href)).toEqual(["/me/teams/new"]);
  });

  it("garde tout quand les flags sont ouverts", () => {
    const visible = visibleHelpCategories(CATEGORIES, new Set(["online_play", "dice_themes"]));
    expect(visible.map((c) => c.id)).toEqual(["jouer", "equipes"]);
    expect(visible[1].features[0].links).toHaveLength(2);
  });

  it("ne mute pas le catalogue", () => {
    visibleHelpCategories(CATEGORIES, new Set());
    expect(CATEGORIES[1].features[0].links).toHaveLength(2);
  });
});

describe("parseGlobalFlags", () => {
  it("lit l'enveloppe de l'API", () => {
    expect([...parseGlobalFlags({ success: true, data: ["crowns", 3, "dice_themes"] })]).toEqual([
      "crowns",
      "dice_themes",
    ]);
  });

  it.each([null, undefined, "x", { success: false, data: ["crowns"] }, { success: true, data: "crowns" }])(
    "ferme tous les gates sur une réponse inattendue (%j)",
    (envelope) => {
      expect(parseGlobalFlags(envelope).size).toBe(0);
    },
  );
});
