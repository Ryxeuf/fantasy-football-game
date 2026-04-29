import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AchievementsPage from "./page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn(() => "fake-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

interface MockAchievementOpts {
  slug: string;
  unlocked: boolean;
  unlockedAt?: string | null;
  category?: "matches" | "scoring" | "casualties" | "social" | "rosters";
}

function buildAchievement(opts: MockAchievementOpts) {
  return {
    slug: opts.slug,
    nameFr: `Succes ${opts.slug}`,
    nameEn: `Achievement ${opts.slug}`,
    descriptionFr: `Description FR ${opts.slug}`,
    descriptionEn: `Description EN ${opts.slug}`,
    category: opts.category ?? "matches",
    icon: "🏆",
    unlocked: opts.unlocked,
    unlockedAt: opts.unlocked
      ? opts.unlockedAt ?? "2026-04-29T00:00:00.000Z"
      : null,
  };
}

const baseStats = {
  matchesPlayed: 1,
  wins: 1,
  draws: 0,
  losses: 0,
  touchdowns: 2,
  casualties: 0,
  friendsCount: 0,
  rostersPlayed: ["skaven"],
  winsByRoster: { skaven: 1 },
};

describe("AchievementsPage — newly unlocked banner (S26.2b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("fake-token");
  });

  it("shows a celebration banner listing newly unlocked achievements", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            stats: baseStats,
            achievements: [
              buildAchievement({ slug: "first-match", unlocked: true }),
              buildAchievement({ slug: "first-win", unlocked: true }),
              buildAchievement({ slug: "matches-10", unlocked: false }),
            ],
            newlyUnlocked: ["first-match", "first-win"],
          },
        }),
    });

    render(<AchievementsPage />);

    const banner = await screen.findByTestId("achievements-newly-unlocked-banner");
    expect(banner.textContent).toMatch(/2/);
    expect(banner.textContent).toMatch(/Succes first-match/);
    expect(banner.textContent).toMatch(/Succes first-win/);
  });

  it("does not show the banner when newlyUnlocked is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            stats: baseStats,
            achievements: [
              buildAchievement({ slug: "first-match", unlocked: true }),
            ],
            newlyUnlocked: [],
          },
        }),
    });

    render(<AchievementsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/débloqués/i, { selector: "p" }),
      ).toBeTruthy();
    });
    expect(
      screen.queryByTestId("achievements-newly-unlocked-banner"),
    ).toBeNull();
  });

  it("flags newly unlocked achievement cards with a NEW badge", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            stats: baseStats,
            achievements: [
              buildAchievement({ slug: "first-match", unlocked: true }),
              buildAchievement({ slug: "first-win", unlocked: true }),
            ],
            newlyUnlocked: ["first-match"],
          },
        }),
    });

    render(<AchievementsPage />);

    await waitFor(() => {
      expect(
        screen.getByTestId("achievement-card-new-first-match"),
      ).toBeTruthy();
    });
    expect(
      screen.queryByTestId("achievement-card-new-first-win"),
    ).toBeNull();
  });

  it("tolerates a response without newlyUnlocked field (backward compat)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            stats: baseStats,
            achievements: [
              buildAchievement({ slug: "first-match", unlocked: true }),
            ],
          },
        }),
    });

    render(<AchievementsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/débloqués/i, { selector: "p" }),
      ).toBeTruthy();
    });
    expect(
      screen.queryByTestId("achievements-newly-unlocked-banner"),
    ).toBeNull();
  });
});
