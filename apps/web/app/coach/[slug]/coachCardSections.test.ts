import { describe, it, expect } from "vitest";
import { buildCoachCardSections } from "./coachCardSections";
import type {
  CoachEloSnapshot,
  CoachPublicProfile,
  CoachShowcaseAchievement,
  CoachRecentTeam,
} from "./types";

function profile(
  overrides: Partial<CoachPublicProfile> = {},
): CoachPublicProfile {
  return {
    id: "u-1",
    slug: "alpha",
    coachName: "Alpha",
    eloRating: 1500,
    isSupporter: false,
    supporterTier: null,
    memberSince: "2025-01-15T00:00:00.000Z",
    achievements: [],
    recentTeams: [],
    ...overrides,
  };
}

const ach = (slug: string, nameFr: string): CoachShowcaseAchievement => ({
  slug,
  nameFr,
  nameEn: nameFr,
  icon: "🏆",
  category: "milestone",
  unlockedAt: "2026-03-01T12:00:00.000Z",
});

const team = (id: string, name: string): CoachRecentTeam => ({
  id,
  name,
  roster: "skaven",
  currentValue: 1500000,
  createdAt: "2026-04-01T12:00:00.000Z",
});

const snap = (rating: number): CoachEloSnapshot => ({
  rating,
  delta: 0,
  recordedAt: "2026-04-01T12:00:00.000Z",
});

describe("buildCoachCardSections (S26.3o)", () => {
  it("renders the header with coach name, ELO, slug and join year", () => {
    const sections = buildCoachCardSections(
      profile({ coachName: "Alpha", eloRating: 1234, slug: "alpha-foo" }),
      [],
    );
    expect(sections.title).toMatch(/Alpha/);
    expect(sections.subtitle).toMatch(/1234/);
    expect(sections.subtitle).toMatch(/alpha-foo/);
    expect(sections.subtitle).toMatch(/2025/);
  });

  it("flags supporter status when applicable", () => {
    const yes = buildCoachCardSections(
      profile({ isSupporter: true, supporterTier: "Bronze" }),
      [],
    );
    const no = buildCoachCardSections(
      profile({ isSupporter: false, supporterTier: null }),
      [],
    );
    expect(yes.subtitle.toLowerCase()).toMatch(/supporter/);
    expect(no.subtitle.toLowerCase()).not.toMatch(/supporter/);
  });

  it("returns an empty achievements section when none", () => {
    const sections = buildCoachCardSections(profile(), []);
    expect(sections.achievementRows).toEqual([]);
  });

  it("returns one row per showcase achievement (slug, name, year)", () => {
    const sections = buildCoachCardSections(
      profile({
        achievements: [ach("first-td", "Premier TD"), ach("first-cas", "Premiere casualty")],
      }),
      [],
    );
    expect(sections.achievementRows.length).toBe(2);
    expect(sections.achievementRows[0]).toEqual([
      "Premier TD",
      "milestone",
      "2026",
    ]);
  });

  it("returns one row per recent team (name, roster, value)", () => {
    const sections = buildCoachCardSections(
      profile({
        recentTeams: [team("t-1", "Skaven Stars"), team("t-2", "Rats")],
      }),
      [],
    );
    expect(sections.recentTeamRows.length).toBe(2);
    expect(sections.recentTeamRows[0][0]).toBe("Skaven Stars");
    expect(sections.recentTeamRows[0][1].toLowerCase()).toMatch(/skaven/);
    // currentValue is in gold pieces; expect a thousands-formatted value with "po" or "PO".
    expect(sections.recentTeamRows[0][2]).toMatch(/1[\s  ]?500[\s  ]?000\s*po/i);
  });

  it("summarises the ELO history with min/max/last and snapshot count", () => {
    const sections = buildCoachCardSections(
      profile(),
      [snap(1480), snap(1520), snap(1505)],
    );
    expect(sections.eloSummary).not.toBeNull();
    expect(sections.eloSummary).toMatch(/1480/);
    expect(sections.eloSummary).toMatch(/1520/);
    expect(sections.eloSummary).toMatch(/1505/);
    expect(sections.eloSummary).toMatch(/3/);
  });

  it("returns null eloSummary when history is empty", () => {
    const sections = buildCoachCardSections(profile(), []);
    expect(sections.eloSummary).toBeNull();
  });

  it("derives a kebab-case file name from the coach slug", () => {
    const sections = buildCoachCardSections(
      profile({ slug: "alpha-foo" }),
      [],
    );
    expect(sections.fileName).toBe("coach-alpha-foo.pdf");
  });
});
