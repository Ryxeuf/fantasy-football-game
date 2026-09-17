/**
 * Console admin des ligues — critères de classement.
 *
 * C'est le SEUL chemin qui reste ouvert une fois la ligue verrouillée par un
 * match joué : on vérifie que la console lit l'ordre appliqué, compose une
 * liste ordonnée et la poste sur `PATCH /admin/leagues/:id/standings-order`
 * (`null` quand plus rien n'est retenu = retour au défaut).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, prefetch: vi.fn() }),
}));

import AdminLeaguesPage from "./page";

const LEAGUE = {
  id: "l1",
  name: "Ligue du Chaudron",
  description: null,
  ruleset: "season_3",
  status: "in_progress",
  isPublic: true,
  maxParticipants: 8,
  creatorId: "commish",
  creator: { id: "commish", coachName: "Commish", email: "c@x.io" },
  seasonsCount: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  tieBreakRules: null as string[] | null,
  effectiveTieBreakRules: [
    "points",
    "bonus_points",
    "forfeit_points",
    "td_diff",
    "cas_diff",
    "name",
  ],
};

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(() => "token"),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  },
});

function jsonOk(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) };
}

/** Route le stub fetch : /auth/me (admin), la liste, puis les écritures. */
function routeFetch(league = LEAGUE) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/auth/me")) {
      return Promise.resolve(
        jsonOk({ user: { id: "admin-1", roles: ["admin"] } }),
      );
    }
    if (url.includes("/admin/leagues/") ) {
      return Promise.resolve(jsonOk({ success: true, data: {} }));
    }
    return Promise.resolve(
      jsonOk({
        data: { leagues: [league] },
        meta: { total: 1, limit: 50, page: 0 },
      }),
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.alert = vi.fn();
});

describe("Console admin — critères de classement d'une ligue", () => {
  it("affiche l'ordre appliqué et le signale comme étant le défaut", async () => {
    routeFetch();
    render(<AdminLeaguesPage />);
    const summary = await screen.findByTestId("admin-league-order-summary-l1");
    expect(summary.textContent).toContain("Points (Pts)");
    expect(summary.textContent).toContain("Points bonus (Bo)");
    expect(summary.textContent).toContain("Forfaits (For)");
    expect(summary.textContent).toContain("defaut");
  });

  it("poste l'ordre composé, même sur une ligue en cours", async () => {
    routeFetch();
    render(<AdminLeaguesPage />);
    fireEvent.click(await screen.findByTestId("admin-league-order-l1"));
    fireEvent.click(await screen.findByTestId("admin-tiebreak-add-points"));
    fireEvent.click(screen.getByTestId("admin-tiebreak-add-cas_for"));
    fireEvent.click(screen.getByTestId("admin-standings-order-save"));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find((c) =>
        String(c[0]).includes("/standings-order"),
      );
      expect(call).toBeTruthy();
      expect(call?.[1]?.method).toBe("PATCH");
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        tieBreakRules: ["points", "cas_for"],
      });
    });
  });

  it("une liste vidée repart sur `null` (= ordre par défaut)", async () => {
    routeFetch({ ...LEAGUE, tieBreakRules: ["cas_for"] });
    render(<AdminLeaguesPage />);
    fireEvent.click(await screen.findByTestId("admin-league-order-l1"));
    fireEvent.click(await screen.findByTestId("admin-tiebreak-remove-cas_for"));
    fireEvent.click(screen.getByTestId("admin-standings-order-save"));

    await waitFor(() => {
      const call = mockFetch.mock.calls.find((c) =>
        String(c[0]).includes("/standings-order"),
      );
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        tieBreakRules: null,
      });
    });
  });
});
