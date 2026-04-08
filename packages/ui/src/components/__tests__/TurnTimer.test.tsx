/**
 * Tests for the TurnTimer component.
 * B1.10 — Timer de tour configurable avec fin de tour auto.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import TurnTimer from "../TurnTimer";

describe("TurnTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders remaining time in mm:ss format", () => {
    const deadline = Date.now() + 120_000; // 2 minutes from now
    render(<TurnTimer deadline={deadline} turnTimerSeconds={120} />);

    expect(screen.getByTestId("turn-timer")).toBeTruthy();
    expect(screen.getByTestId("turn-timer").textContent).toMatch(/[012]:\d\d/);
  });

  it("shows warning state when less than 30 seconds remain", () => {
    const deadline = Date.now() + 25_000; // 25 seconds from now
    render(<TurnTimer deadline={deadline} turnTimerSeconds={120} />);

    const timer = screen.getByTestId("turn-timer");
    expect(timer.className).toContain("text-amber");
  });

  it("shows critical state when less than 10 seconds remain", () => {
    const deadline = Date.now() + 8_000; // 8 seconds from now
    render(<TurnTimer deadline={deadline} turnTimerSeconds={120} />);

    const timer = screen.getByTestId("turn-timer");
    expect(timer.className).toContain("text-red");
  });

  it("shows 0:00 when deadline has passed", () => {
    const deadline = Date.now() - 5_000; // 5 seconds ago
    render(<TurnTimer deadline={deadline} turnTimerSeconds={120} />);

    expect(screen.getByTestId("turn-timer").textContent).toContain("0:00");
  });

  it("does not render when deadline is undefined", () => {
    render(<TurnTimer deadline={undefined} turnTimerSeconds={120} />);

    expect(screen.queryByTestId("turn-timer")).toBeNull();
  });

  it("does not render when turnTimerSeconds is 0 (disabled)", () => {
    const deadline = Date.now() + 60_000;
    render(<TurnTimer deadline={deadline} turnTimerSeconds={0} />);

    expect(screen.queryByTestId("turn-timer")).toBeNull();
  });

  it("counts down over time", () => {
    const deadline = Date.now() + 65_000; // 65 seconds from now
    render(<TurnTimer deadline={deadline} turnTimerSeconds={120} />);

    const timer = screen.getByTestId("turn-timer");
    expect(timer.textContent).toContain("1:05");

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(timer.textContent).toContain("1:00");
  });
});
