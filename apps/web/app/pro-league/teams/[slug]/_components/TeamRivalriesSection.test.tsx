/**
 * Tests pour TeamRivalriesSection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { TeamRivalriesSection } from "./TeamRivalriesSection";

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "dummy-token",
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

const rivalFixture = {
  team: {
    id: "tB",
    slug: "team-b",
    city: "City B",
    name: "Beasts",
    race: "Orc",
    primaryColor: "#0f0",
    secondaryColor: null,
  },
  totalMatches: 3,
  winsFor: 2,
  winsAgainst: 1,
  draws: 0,
  lastMatch: null,
};

describe("TeamRivalriesSection", () => {
  it("loading state initial", () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;
    render(<TeamRivalriesSection teamSlug="team-a" />);
    expect(screen.getByTestId("rivalries-loading")).toBeTruthy();
  });

  it("affiche les rival cards quand non vide", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rivals: [rivalFixture] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<TeamRivalriesSection teamSlug="team-a" />);

    await waitFor(() => {
      expect(screen.getByTestId("rivalries-section")).toBeTruthy();
    });
    expect(screen.getByTestId("rival-card-team-b")).toBeTruthy();
    expect(screen.getByTestId("rival-record-team-b").textContent).toMatch(
      /2W/,
    );
    expect(screen.getByTestId("rival-record-team-b").textContent).toMatch(
      /1L/,
    );
  });

  it("affiche message empty quand 0 rival", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rivals: [] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<TeamRivalriesSection teamSlug="team-a" />);

    await waitFor(() => {
      expect(screen.getByTestId("rivalries-empty")).toBeTruthy();
    });
  });

  it("affiche erreur si fetch echoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Not found" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<TeamRivalriesSection teamSlug="ghost" />);

    await waitFor(() => {
      expect(screen.getByTestId("rivalries-error")).toBeTruthy();
    });
  });

  it("link vers la page head-to-head", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rivals: [rivalFixture] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<TeamRivalriesSection teamSlug="team-a" />);

    await waitFor(() => {
      expect(screen.getByTestId("rival-link-team-b")).toBeTruthy();
    });
    expect(
      screen.getByTestId("rival-link-team-b").getAttribute("href"),
    ).toBe("/pro-league/teams/team-a/vs/team-b");
  });
});
