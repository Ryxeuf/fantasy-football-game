import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachProfileHeader from "./CoachProfileHeader";

const baseProfile = {
  id: "u-1",
  slug: "coach-alpha",
  coachName: "Coach Alpha",
  eloRating: 1234,
  isSupporter: false,
  supporterTier: null,
  memberSince: "2025-12-01T00:00:00.000Z",
};

describe("CoachProfileHeader", () => {
  it("renders the coach name as a level-1 heading", () => {
    render(<CoachProfileHeader profile={baseProfile} />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/Coach Alpha/);
  });

  it("displays the ELO rating", () => {
    render(<CoachProfileHeader profile={baseProfile} />);
    expect(screen.getByTestId("coach-elo").textContent).toMatch(/1234/);
  });

  it("displays the member-since year", () => {
    render(<CoachProfileHeader profile={baseProfile} />);
    expect(screen.getByTestId("coach-member-since").textContent).toMatch(
      /2025/,
    );
  });

  it("does not render a supporter badge when isSupporter is false", () => {
    render(<CoachProfileHeader profile={baseProfile} />);
    expect(screen.queryByTestId("coach-supporter-badge")).toBeNull();
  });

  it("renders a supporter badge with the tier when isSupporter is true", () => {
    render(
      <CoachProfileHeader
        profile={{ ...baseProfile, isSupporter: true, supporterTier: "Bronze" }}
      />,
    );
    const badge = screen.getByTestId("coach-supporter-badge");
    expect(badge.textContent).toMatch(/Bronze/i);
  });

  it("renders a generic supporter badge when tier is null", () => {
    render(
      <CoachProfileHeader
        profile={{ ...baseProfile, isSupporter: true, supporterTier: null }}
      />,
    );
    const badge = screen.getByTestId("coach-supporter-badge");
    expect(badge.textContent).toMatch(/supporter/i);
  });
});
