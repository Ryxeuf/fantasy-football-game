/**
 * S27.1h — Tests du composant `MatchOfTheWeekBanner`.
 *
 * Banniere consommant `GET /cup/match-of-the-week` (S27.1f) et
 * affichee en teaser sur `/cups/monthly`. Rend null en silence si
 * aucun match n'est featured ou si l'API echoue (degradation
 * gracieuse, pas d'erreur affichee a l'utilisateur).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import MatchOfTheWeekBanner from "./MatchOfTheWeekBanner";
import { LanguageProvider } from "../contexts/LanguageContext";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

function renderBanner() {
  return render(
    <LanguageProvider>
      <MatchOfTheWeekBanner />
    </LanguageProvider>,
  );
}

const featuredPayload = {
  match: {
    id: "match-1",
    name: "Skaven vs Nordic",
    featuredAt: "2026-04-15T12:00:00.000Z",
    featuredNote: "Le match du mois !",
    cupId: "cup-1",
    scoreTeamA: 3,
    scoreTeamB: 2,
    teamA: { id: "team-A", name: "Skaven Stars" },
    teamB: { id: "team-B", name: "Nordic Wolves" },
  },
};

describe("MatchOfTheWeekBanner (S27.1h)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("ne rend rien tant que le fetch n'a pas resolu (no flash)", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { container } = renderBanner();
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien quand l'API ne retourne aucun match (null)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: { match: null } }),
    });
    const { container } = renderBanner();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    // Apres resolution, container reste vide.
    await new Promise((r) => setTimeout(r, 0));
    expect(container.firstChild).toBeNull();
  });

  it("ne rend rien quand l'API echoue (degradation gracieuse)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "boom" }),
    });
    const { container } = renderBanner();
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.firstChild).toBeNull();
  });

  it("affiche le match du moment avec teams + score + note", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: featuredPayload }),
    });
    renderBanner();
    await waitFor(() =>
      expect(screen.getByTestId("match-of-the-week-banner")).toBeTruthy(),
    );
    expect(screen.getByTestId("match-of-the-week-team-a").textContent).toBe(
      "Skaven Stars",
    );
    expect(screen.getByTestId("match-of-the-week-team-b").textContent).toBe(
      "Nordic Wolves",
    );
    expect(screen.getByTestId("match-of-the-week-score").textContent).toMatch(
      /3.*–.*2/,
    );
    expect(screen.getByText("Le match du mois !")).toBeTruthy();
  });

  it("appelle l'endpoint GET /cup/match-of-the-week", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: featuredPayload }),
    });
    renderBanner();
    await waitFor(() =>
      expect(screen.getByTestId("match-of-the-week-banner")).toBeTruthy(),
    );
    expect(String(mockFetch.mock.calls[0][0])).toMatch(
      /\/cup\/match-of-the-week/,
    );
  });
});
