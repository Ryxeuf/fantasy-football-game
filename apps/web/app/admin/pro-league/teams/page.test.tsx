/**
 * Tests de la page admin/pro-league/teams (liste).
 *
 * Couvre : chargement liste, rendu cards, etat empty, erreur fetch.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import AdminProLeagueTeamsPage from "./page";

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

const teamFixture = {
  id: "t1",
  leagueId: "l1",
  slug: "pit-smashers",
  city: "Pittsburgh",
  name: "Smashers",
  race: "Orc",
  nflFlavor: "Steelers",
  primaryColor: "#000000",
  secondaryColor: "#FFB612",
  motto: "Smash hour",
  headline: null,
};

describe("AdminProLeagueTeamsPage", () => {
  it("affiche les cards teams apres chargement", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ teams: [teamFixture] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminProLeagueTeamsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("team-card-pit-smashers")).toBeTruthy();
    });
    expect(screen.getByText(/Pittsburgh Smashers/)).toBeTruthy();
    expect(screen.getByText(/Smash hour/)).toBeTruthy();
  });

  it("affiche message empty quand 0 team", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ teams: [] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminProLeagueTeamsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Aucune team Pro League/)).toBeTruthy();
    });
  });

  it("affiche erreur quand fetch echoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminProLeagueTeamsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Forbidden/)).toBeTruthy();
    });
  });

  it("applique la couleur primaire au swatch", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ teams: [teamFixture] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminProLeagueTeamsPage />);

    await waitFor(() => {
      const swatch = screen.getByTestId("primary-pit-smashers");
      expect((swatch as HTMLElement).style.backgroundColor).toBeTruthy();
    });
  });
});
