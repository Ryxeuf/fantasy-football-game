import { describe, it, expect } from "vitest";
import {
  getRecommendedRosters,
  recommendedSlugSet,
  getRosterDifficulty,
  shouldShowOnboarding,
  isValidTeamName,
  stepIndex,
  TEAM_NAME_MAX_LENGTH,
  onboardingBudgetK,
  onboardingStaffConfig,
  staffFitsBudget,
  staffRequestFields,
  summarizeStaffBudget,
  type OnboardingRoster,
} from "./onboarding-logic";
import { EMPTY_BUILD_STAFF, defaultStaffConfig } from "@bb/game-engine";

const ROSTERS: OnboardingRoster[] = [
  { slug: "amazon", name: "Amazones" },
  { slug: "dwarf", name: "Nains" },
  { slug: "human", name: "Humains" },
  { slug: "lizardmen", name: "Hommes-lézards" },
  { slug: "orc", name: "Orcs" },
  { slug: "wood_elf", name: "Elfes Sylvains" },
];

describe("getRecommendedRosters", () => {
  it("returns the canonical beginner rosters in order", () => {
    const recommended = getRecommendedRosters(ROSTERS);
    expect(recommended.map((r) => r.slug)).toEqual([
      "human",
      "orc",
      "dwarf",
      "lizardmen",
    ]);
  });

  it("caps the number of recommendations", () => {
    expect(getRecommendedRosters(ROSTERS, 2).map((r) => r.slug)).toEqual([
      "human",
      "orc",
    ]);
  });

  it("skips recommended rosters that are not available", () => {
    const partial = ROSTERS.filter((r) => r.slug !== "human");
    expect(getRecommendedRosters(partial).map((r) => r.slug)).toEqual([
      "orc",
      "dwarf",
      "lizardmen",
    ]);
  });

  it("falls back to easy rosters when none are recommended", () => {
    const onlyHard: OnboardingRoster[] = [
      { slug: "goblin", name: "Gobelins" },
      { slug: "undead", name: "Morts-vivants" }, // easy
    ];
    expect(getRecommendedRosters(onlyHard).map((r) => r.slug)).toEqual([
      "undead",
    ]);
  });

  it("falls back to the first rosters when nothing is easy or recommended", () => {
    const onlyHard: OnboardingRoster[] = [
      { slug: "goblin", name: "Gobelins" },
      { slug: "halfling", name: "Halfelins" },
    ];
    expect(getRecommendedRosters(onlyHard).map((r) => r.slug)).toEqual([
      "goblin",
      "halfling",
    ]);
  });
});

describe("recommendedSlugSet", () => {
  it("exposes the recommended slugs as a set", () => {
    const set = recommendedSlugSet(ROSTERS);
    expect(set.has("human")).toBe(true);
    expect(set.has("wood_elf")).toBe(false);
  });
});

describe("getRosterDifficulty", () => {
  it("classifies known rosters", () => {
    expect(getRosterDifficulty("human")).toBe("easy");
    expect(getRosterDifficulty("skaven")).toBe("medium");
    expect(getRosterDifficulty("wood_elf")).toBe("hard");
  });

  it("defaults unknown rosters to medium", () => {
    expect(getRosterDifficulty("mystery_team")).toBe("medium");
  });
});

describe("shouldShowOnboarding", () => {
  it("shows for a loaded coach with no team who has not dismissed", () => {
    expect(
      shouldShowOnboarding({ teamsCount: 0, dismissed: false, loaded: true }),
    ).toBe(true);
  });

  it("does not show while loading", () => {
    expect(
      shouldShowOnboarding({ teamsCount: 0, dismissed: false, loaded: false }),
    ).toBe(false);
  });

  it("does not show when the coach already has a team", () => {
    expect(
      shouldShowOnboarding({ teamsCount: 2, dismissed: false, loaded: true }),
    ).toBe(false);
  });

  it("does not show after dismissal", () => {
    expect(
      shouldShowOnboarding({ teamsCount: 0, dismissed: true, loaded: true }),
    ).toBe(false);
  });
});

describe("isValidTeamName", () => {
  it("accepts a normal name", () => {
    expect(isValidTeamName("Reikland Reavers")).toBe(true);
  });

  it("rejects empty / whitespace-only names", () => {
    expect(isValidTeamName("")).toBe(false);
    expect(isValidTeamName("   ")).toBe(false);
  });

  it("rejects names beyond the max length", () => {
    expect(isValidTeamName("a".repeat(TEAM_NAME_MAX_LENGTH))).toBe(true);
    expect(isValidTeamName("a".repeat(TEAM_NAME_MAX_LENGTH + 1))).toBe(false);
  });
});

describe("stepIndex", () => {
  it("returns a 1-based index", () => {
    expect(stepIndex("race")).toBe(1);
    expect(stepIndex("name")).toBe(2);
    expect(stepIndex("staff")).toBe(3);
    expect(stepIndex("confirm")).toBe(4);
  });
});

describe("étape Staff", () => {
  const orc = defaultStaffConfig("orc", "bb11");

  it("config staff : celle de la base, sinon le défaut du moteur", () => {
    expect(onboardingStaffConfig({ slug: "orc", name: "Orcs" })).toEqual(orc);
    const custom = { ...orc, dedicatedFanCost: 15000 };
    expect(
      onboardingStaffConfig({ slug: "orc", name: "Orcs", staffConfigs: { bb11: custom } }),
    ).toEqual(custom);
  });

  it("budget : celui du roster, sinon le plafond du format", () => {
    expect(onboardingBudgetK({ slug: "orc", name: "Orcs", budget: 1150 })).toBe(1150);
    expect(onboardingBudgetK({ slug: "orc", name: "Orcs" })).toBe(1000);
  });

  it("coût du staff et budget restant (chaque fan est payé)", () => {
    const summary = summarizeStaffBudget({
      selection: { ...EMPTY_BUILD_STAFF, dedicatedFans: 2, rerolls: 1 },
      staff: orc,
      budgetK: 1000,
      lineupCostK: 550,
    });
    const staffK = (2 * orc.dedicatedFanCost + orc.rerollCost) / 1000;
    expect(summary).toEqual({
      staffCostK: staffK,
      remainingK: 1000 - 550 - staffK,
      overBudget: false,
    });
  });

  it("joueurs inconnus : pas de budget restant, jamais bloquant", () => {
    const summary = summarizeStaffBudget({
      selection: { ...EMPTY_BUILD_STAFF, rerolls: 8 },
      staff: orc,
      budgetK: 600,
      lineupCostK: null,
    });
    expect(summary.remainingK).toBeNull();
    expect(summary.overBudget).toBe(false);
  });

  it("refuse un ajout qui dépasse le budget", () => {
    // 50k de marge : un fan passe, deux relances non.
    const ctx = { staff: orc, budgetK: 600, lineupCostK: 550 };
    expect(staffFitsBudget({ ...EMPTY_BUILD_STAFF, dedicatedFans: 1 }, ctx)).toBe(true);
    expect(staffFitsBudget({ ...EMPTY_BUILD_STAFF, rerolls: 2 }, ctx)).toBe(false);
  });

  it("n'envoie que le staff réellement pris", () => {
    expect(staffRequestFields(EMPTY_BUILD_STAFF)).toEqual({});
    expect(
      staffRequestFields({ ...EMPTY_BUILD_STAFF, dedicatedFans: 2, apothecary: true }),
    ).toEqual({ dedicatedFans: 2, apothecary: true });
  });
});
