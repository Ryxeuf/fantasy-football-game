import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachRecentTeams from "./CoachRecentTeams";
import type { CoachRecentTeam } from "./types";

const fixture: CoachRecentTeam[] = [
  {
    id: "t-1",
    name: "Skaven Stars",
    roster: "skaven",
    currentValue: 1500,
    createdAt: "2026-04-15T12:00:00.000Z",
  },
  {
    id: "t-2",
    name: "Human Heroes",
    roster: "human",
    currentValue: 1100,
    createdAt: "2026-04-10T12:00:00.000Z",
  },
];

describe("CoachRecentTeams (S26.3h)", () => {
  it("renders nothing when the teams list is empty", () => {
    const { container } = render(<CoachRecentTeams teams={[]} />);
    expect(
      container.querySelector('[data-testid="coach-recent-teams"]'),
    ).toBeNull();
  });

  it("renders one card per team", () => {
    render(<CoachRecentTeams teams={fixture} />);
    const cards = screen.getAllByTestId(/^coach-recent-team-/);
    expect(cards.length).toBe(2);
  });

  it("displays the team name and roster", () => {
    render(<CoachRecentTeams teams={fixture} />);
    const card = screen.getByTestId("coach-recent-team-t-1");
    expect(card.textContent).toMatch(/Skaven Stars/);
    expect(card.textContent).toMatch(/skaven/i);
  });

  it("formats the team value with thousands separators", () => {
    render(<CoachRecentTeams teams={fixture} />);
    const card = screen.getByTestId("coach-recent-team-t-1");
    // The value is 1500; locale-fr renders "1 500" (NBSP) but matches loose.
    expect(card.textContent).toMatch(/1[\s  ]500/);
  });

  it("includes a section heading when at least one team is shown", () => {
    render(<CoachRecentTeams teams={fixture} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/equipes/i);
  });
});
