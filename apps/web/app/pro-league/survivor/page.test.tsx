/**
 * Tests de la page /pro-league/survivor.
 *
 * Couvre : chargement saison courante, rendu round/matchs, pick action,
 * banner status alive/eliminated, message empty.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import SurvivorPage from "./page";

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

function mockSeasonChain(
  overview: any,
  standings: any[],
  myStatus: any | null,
) {
  const fetchMock = vi.fn();
  // 1) /pro-league/seasons/current
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ season: { id: "s1" } }),
  } as unknown as Response);
  // 2) overview
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => overview,
  } as unknown as Response);
  // 3) standings
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ entries: standings }),
  } as unknown as Response);
  // 4) me (success ou 401)
  if (myStatus !== null) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => myStatus,
    } as unknown as Response);
  } else {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Non authentifie" }),
    } as unknown as Response);
  }
  return fetchMock;
}

describe("SurvivorPage", () => {
  it("affiche overview + current round + matchs", async () => {
    global.fetch = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: {
          id: "r5",
          roundNumber: 5,
          scheduledAt: null,
        },
        currentMatches: [
          {
            id: "m1",
            homeTeamId: "team-A",
            awayTeamId: "team-B",
            scheduledAt: null,
          },
        ],
      },
      [],
      {
        seasonId: "s1",
        isAlive: true,
        entries: [],
        pickedTeamIds: [],
      },
    ) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByTestId("current-round")).toBeTruthy();
    });
    expect(screen.getByText(/Semaine 5/)).toBeTruthy();
    expect(screen.getByTestId("match-m1")).toBeTruthy();
  });

  it("banner ALIVE quand isAlive=true", async () => {
    global.fetch = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: null,
        currentMatches: [],
      },
      [],
      {
        seasonId: "s1",
        isAlive: true,
        entries: [{ id: "e1", status: "alive", roundId: "r1", weekN: 1, pickedTeamId: "team-A", result: "win" }],
        pickedTeamIds: ["team-A"],
      },
    ) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByTestId("my-status-banner")).toBeTruthy();
    });
    expect(screen.getByTestId("my-status-banner").textContent).toMatch(/ALIVE/);
  });

  it("banner ELIMINE quand isAlive=false", async () => {
    global.fetch = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: null,
        currentMatches: [],
      },
      [],
      {
        seasonId: "s1",
        isAlive: false,
        entries: [{ id: "e1", status: "eliminated", roundId: "r1", weekN: 1, pickedTeamId: "team-A", result: "loss" }],
        pickedTeamIds: ["team-A"],
      },
    ) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByTestId("my-status-banner").textContent).toMatch(/ELIMINE/);
    });
  });

  it("bouton pick desactive si team deja piquee", async () => {
    global.fetch = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: { id: "r2", roundNumber: 2, scheduledAt: null },
        currentMatches: [
          {
            id: "m1",
            homeTeamId: "team-A",
            awayTeamId: "team-B",
            scheduledAt: null,
          },
        ],
      },
      [],
      {
        seasonId: "s1",
        isAlive: true,
        entries: [
          { id: "e1", status: "alive", roundId: "r1", weekN: 1, pickedTeamId: "team-A", result: "win" },
        ],
        pickedTeamIds: ["team-A"],
      },
    ) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByTestId("pick-team-A")).toBeTruthy();
    });

    const btnA = screen.getByTestId("pick-team-A") as HTMLButtonElement;
    expect(btnA.disabled).toBe(true);
    const btnB = screen.getByTestId("pick-team-B") as HTMLButtonElement;
    expect(btnB.disabled).toBe(false);
  });

  it("click pick appelle l'endpoint et reload", async () => {
    const fetchMock = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: { id: "r2", roundNumber: 2, scheduledAt: null },
        currentMatches: [
          {
            id: "m1",
            homeTeamId: "team-A",
            awayTeamId: "team-B",
            scheduledAt: null,
          },
        ],
      },
      [],
      {
        seasonId: "s1",
        isAlive: true,
        entries: [],
        pickedTeamIds: [],
      },
    );
    // POST pick
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entryId: "new-e" }),
    } as unknown as Response);
    // Reload: overview + standings + me
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: { id: "r2", roundNumber: 2, scheduledAt: null },
        currentMatches: [
          {
            id: "m1",
            homeTeamId: "team-A",
            awayTeamId: "team-B",
            scheduledAt: null,
          },
        ],
      }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ entries: [] }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        seasonId: "s1",
        isAlive: true,
        entries: [
          { id: "new-e", status: "pending", roundId: "r2", weekN: 2, pickedTeamId: "team-A", result: null },
        ],
        pickedTeamIds: ["team-A"],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SurvivorPage />);
    await waitFor(() => screen.getByTestId("pick-team-A"));

    fireEvent.click(screen.getByTestId("pick-team-A"));

    await waitFor(() => {
      expect(screen.getByTestId("submit-message")).toBeTruthy();
    });

    const pickCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/survivor/picks"),
    );
    expect(pickCall).toBeDefined();
    expect(JSON.parse(pickCall![1].body as string)).toEqual({
      seasonId: "s1",
      roundId: "r2",
      teamId: "team-A",
    });
  });

  it("affiche message si aucun round courant", async () => {
    global.fetch = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "completed" },
        currentRound: null,
        currentMatches: [],
      },
      [],
      {
        seasonId: "s1",
        isAlive: true,
        entries: [],
        pickedTeamIds: [],
      },
    ) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByText(/Aucun round en cours/)).toBeTruthy();
    });
  });

  it("masque le banner perso si non auth (myStatus 401)", async () => {
    global.fetch = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: { id: "r5", roundNumber: 5, scheduledAt: null },
        currentMatches: [],
      },
      [],
      null, // myStatus 401
    ) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByTestId("current-round")).toBeTruthy();
    });
    expect(screen.queryByTestId("my-status-banner")).toBeNull();
  });

  it("affiche standings", async () => {
    global.fetch = mockSeasonChain(
      {
        season: { id: "s1", year: 2026, status: "in_progress" },
        currentRound: null,
        currentMatches: [],
      },
      [
        {
          userId: "u1",
          userName: "Alice",
          userEmail: "a@x.com",
          weeksSurvived: 4,
          isAlive: true,
        },
      ],
      {
        seasonId: "s1",
        isAlive: true,
        entries: [],
        pickedTeamIds: [],
      },
    ) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByTestId("standings-row-u1")).toBeTruthy();
    });
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("erreur si saison absente", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ season: null }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<SurvivorPage />);

    await waitFor(() => {
      expect(screen.getByTestId("survivor-error")).toBeTruthy();
    });
  });
});
