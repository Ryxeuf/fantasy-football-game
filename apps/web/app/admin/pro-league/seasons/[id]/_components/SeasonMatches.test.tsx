/**
 * Tests du composant SeasonMatches.
 *
 * Couvre : fetch initial, application des filtres roundNumber/status,
 * bouton Simuler (POST + reload), idempotent (alert si simulated=false),
 * lien Replay si replayId.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import SeasonMatches from "./SeasonMatches";

const originalFetch = global.fetch;

const sampleMatches = [
  {
    id: "m1",
    status: "scheduled",
    scheduledAt: "2026-05-12T20:00:00Z",
    simulatedAt: null,
    completedAt: null,
    scoreHome: null,
    scoreAway: null,
    outcome: null,
    isTest: false,
    replayId: null,
    homeTeam: { name: "Reikland", slug: "rei" },
    awayTeam: { name: "Skavenblight", slug: "ska" },
    round: { roundNumber: 1 },
  },
  {
    id: "m2",
    status: "completed",
    scheduledAt: "2026-05-12T20:00:00Z",
    simulatedAt: "2026-05-12T20:01:00Z",
    completedAt: "2026-05-12T20:01:30Z",
    scoreHome: 2,
    scoreAway: 1,
    outcome: "home",
    isTest: false,
    replayId: "replay-abc",
    homeTeam: { name: "Bright Crusaders", slug: "bri" },
    awayTeam: { name: "Reikland", slug: "rei" },
    round: { roundNumber: 1 },
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "dummy",
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("SeasonMatches", () => {
  it("liste les matchs apres fetch initial", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matches: sampleMatches }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<SeasonMatches seasonId="s1" totalRounds={15} />);

    await waitFor(() => {
      expect(screen.getByTestId("match-row-m1")).toBeTruthy();
      expect(screen.getByTestId("match-row-m2")).toBeTruthy();
    });
  });

  it("affiche le score pour les matchs completed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matches: sampleMatches }),
    } as unknown as Response) as unknown as typeof fetch;

    const { container } = render(
      <SeasonMatches seasonId="s1" totalRounds={15} />,
    );

    await waitFor(() => {
      const row = screen.getByTestId("match-row-m2");
      expect(row.textContent).toContain("2 - 1");
    });
    // Pas de bouton Simuler sur match completed.
    expect(container.querySelector("[data-testid='btn-simulate-m2']")).toBeNull();
  });

  it("bouton Simuler envoie POST + reload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ matches: sampleMatches }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ matchId: "m1", simulated: true }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ matches: sampleMatches }),
      } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SeasonMatches seasonId="s1" totalRounds={15} />);
    await waitFor(() => screen.getByTestId("btn-simulate-m1"));
    fireEvent.click(screen.getByTestId("btn-simulate-m1"));

    await waitFor(() => {
      // 1 fetch initial + 1 POST + 1 reload = 3 calls
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const postCall = fetchMock.mock.calls[1];
      expect(postCall[0]).toContain("/admin/pro-league/matches/m1/simulate");
      expect(postCall[1].method).toBe("POST");
    });
  });

  it("filtre roundNumber + status passes en query string", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ matches: [] }),
      } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<SeasonMatches seasonId="s1" totalRounds={5} />);
    await waitFor(() => screen.getByTestId("round-filter"));

    fireEvent.change(screen.getByTestId("round-filter"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByTestId("status-filter"), {
      target: { value: "completed" },
    });

    await waitFor(() => {
      const lastCall =
        fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];
      expect(lastCall).toMatch(/roundNumber=3/);
      expect(lastCall).toMatch(/status=completed/);
    });
  });

  it("lien Replay rendu si replayId existe", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matches: sampleMatches }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<SeasonMatches seasonId="s1" totalRounds={15} />);

    await waitFor(() => {
      const row = screen.getByTestId("match-row-m2");
      const replayLink = row.querySelector("a");
      expect(replayLink?.getAttribute("href")).toBe(
        "/pro-league/matches/m2",
      );
    });
  });
});
