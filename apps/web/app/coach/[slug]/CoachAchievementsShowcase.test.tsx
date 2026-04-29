import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachAchievementsShowcase from "./CoachAchievementsShowcase";
import type { CoachShowcaseAchievement } from "./types";

const fixture: CoachShowcaseAchievement[] = [
  {
    slug: "first-match",
    nameFr: "Premier pas",
    nameEn: "First step",
    icon: "🏆",
    category: "matches",
    unlockedAt: "2026-04-15T12:00:00.000Z",
  },
  {
    slug: "first-win",
    nameFr: "Premiere victoire",
    nameEn: "First win",
    icon: "🎉",
    category: "matches",
    unlockedAt: "2026-04-16T12:00:00.000Z",
  },
];

describe("CoachAchievementsShowcase (S26.3f)", () => {
  it("renders nothing visible when the achievements list is empty", () => {
    const { container } = render(
      <CoachAchievementsShowcase achievements={[]} />,
    );
    expect(
      container.querySelector('[data-testid="coach-achievements-showcase"]'),
    ).toBeNull();
  });

  it("renders one card per achievement", () => {
    render(<CoachAchievementsShowcase achievements={fixture} />);
    const cards = screen.getAllByTestId(/^coach-achievement-/);
    expect(cards.length).toBe(2);
  });

  it("displays the FR name and icon for each achievement", () => {
    render(<CoachAchievementsShowcase achievements={fixture} />);
    const card = screen.getByTestId("coach-achievement-first-win");
    expect(card.textContent).toMatch(/Premiere victoire/);
    expect(card.textContent).toMatch(/🎉/);
  });

  it("displays the unlocked-at year for each achievement", () => {
    render(<CoachAchievementsShowcase achievements={fixture} />);
    const card = screen.getByTestId("coach-achievement-first-match");
    expect(card.textContent).toMatch(/2026/);
  });

  it("includes a section heading when at least one achievement is shown", () => {
    render(<CoachAchievementsShowcase achievements={fixture} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/succes/i);
  });
});
