import { describe, it, expect } from "vitest";
import {
  getRecommendedRosters,
  recommendedSlugSet,
  getRosterDifficulty,
  shouldShowOnboarding,
  isValidTeamName,
  stepIndex,
  TEAM_NAME_MAX_LENGTH,
  type OnboardingRoster,
} from "./onboarding-logic";

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
    expect(stepIndex("confirm")).toBe(3);
  });
});
