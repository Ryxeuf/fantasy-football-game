import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CoachEloChart from "./CoachEloChart";
import type { CoachEloSnapshot } from "./types";

function snap(partial: Partial<CoachEloSnapshot>): CoachEloSnapshot {
  return {
    rating: 1500,
    delta: 0,
    recordedAt: "2026-04-01T12:00:00.000Z",
    ...partial,
  };
}

describe("CoachEloChart (S26.3n)", () => {
  it("renders nothing when the history is empty", () => {
    const { container } = render(<CoachEloChart snapshots={[]} />);
    expect(
      container.querySelector('[data-testid="coach-elo-chart"]'),
    ).toBeNull();
  });

  it("renders the section heading when at least one snapshot is provided", () => {
    render(
      <CoachEloChart snapshots={[snap({ rating: 1500 })]} />,
    );
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/elo/i);
  });

  it("renders one circle per snapshot (data points are visible)", () => {
    const snapshots = [
      snap({ rating: 1500, recordedAt: "2026-03-01T12:00:00.000Z" }),
      snap({ rating: 1520, recordedAt: "2026-03-15T12:00:00.000Z" }),
      snap({ rating: 1510, recordedAt: "2026-04-01T12:00:00.000Z" }),
    ];
    const { container } = render(<CoachEloChart snapshots={snapshots} />);
    const points = container.querySelectorAll(
      '[data-testid="coach-elo-chart-point"]',
    );
    expect(points.length).toBe(3);
  });

  it("draws an SVG polyline connecting the snapshots when there are at least two", () => {
    const snapshots = [
      snap({ rating: 1500, recordedAt: "2026-03-01T12:00:00.000Z" }),
      snap({ rating: 1530, recordedAt: "2026-04-01T12:00:00.000Z" }),
    ];
    const { container } = render(<CoachEloChart snapshots={snapshots} />);
    const polyline = container.querySelector(
      '[data-testid="coach-elo-chart-line"]',
    );
    expect(polyline).not.toBeNull();
    const pointsAttr = polyline?.getAttribute("points") ?? "";
    expect(pointsAttr.trim().split(/\s+/).length).toBe(2);
  });

  it("displays the min and max rating reached over the window", () => {
    const snapshots = [
      snap({ rating: 1480, recordedAt: "2026-03-01T12:00:00.000Z" }),
      snap({ rating: 1545, recordedAt: "2026-03-20T12:00:00.000Z" }),
      snap({ rating: 1510, recordedAt: "2026-04-01T12:00:00.000Z" }),
    ];
    render(<CoachEloChart snapshots={snapshots} />);
    const stats = screen.getByTestId("coach-elo-chart-stats").textContent ?? "";
    expect(stats).toMatch(/1480/);
    expect(stats).toMatch(/1545/);
  });

  it("shows the latest rating and how many matches drove the curve", () => {
    const snapshots = [
      snap({ rating: 1480, delta: -10, recordedAt: "2026-03-01T12:00:00.000Z" }),
      snap({ rating: 1500, delta: 20, recordedAt: "2026-03-20T12:00:00.000Z" }),
      snap({ rating: 1525, delta: 25, recordedAt: "2026-04-01T12:00:00.000Z" }),
    ];
    render(<CoachEloChart snapshots={snapshots} />);
    const summary = screen.getByTestId("coach-elo-chart-summary").textContent
      ?? "";
    expect(summary).toMatch(/1525/);
    expect(summary).toMatch(/3/);
  });

  it("falls back to a horizontal flat line when all snapshots share the same rating", () => {
    const snapshots = [
      snap({ rating: 1500, recordedAt: "2026-03-01T12:00:00.000Z" }),
      snap({ rating: 1500, recordedAt: "2026-03-15T12:00:00.000Z" }),
      snap({ rating: 1500, recordedAt: "2026-04-01T12:00:00.000Z" }),
    ];
    const { container } = render(<CoachEloChart snapshots={snapshots} />);
    const polyline = container.querySelector(
      '[data-testid="coach-elo-chart-line"]',
    );
    expect(polyline).not.toBeNull();
    const pts = (polyline?.getAttribute("points") ?? "").trim().split(/\s+/);
    const yValues = pts.map((p) => Number.parseFloat(p.split(",")[1]));
    const allEqual = yValues.every((y) => y === yValues[0]);
    expect(allEqual).toBe(true);
  });
});
