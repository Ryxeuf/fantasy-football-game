/**
 * La liste admin des équipes n'ouvre plus de modale : elle mène à la fiche
 * `/admin/teams/[id]`, par clic sur la ligne comme par le bouton « Voir ».
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, back: vi.fn() }),
}));

import AdminTeamsPage from "./page";

const originalFetch = global.fetch;

const TEAM = {
  id: "team-1",
  name: "Les Gones Kass'Krânes",
  roster: "black_orc",
  ruleset: "season_3",
  initialBudget: 1000,
  treasury: 505000,
  currentValue: 1000000,
  teamValue: 1000000,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 1,
  createdAt: "2026-08-26T23:36:50.000Z",
  owner: {
    id: "user-1",
    email: "davouille@example.com",
    name: "Davouille",
    coachName: "Davouille",
  },
  _count: { players: 12, starPlayers: 0 },
};

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
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      teams: [TEAM],
      pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
    }),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("AdminTeamsPage", () => {
  it("navigue vers la fiche au clic sur la ligne", async () => {
    render(<AdminTeamsPage />);

    const row = await screen.findByTestId("admin-team-row-team-1");
    fireEvent.click(row);
    expect(push).toHaveBeenCalledWith("/admin/teams/team-1");
  });

  it("expose un lien explicite vers la fiche", async () => {
    render(<AdminTeamsPage />);

    const link = await screen.findByTestId("admin-team-open-team-1");
    expect(link.getAttribute("href")).toBe("/admin/teams/team-1");
  });

  it("garde le raccourci vers le journal d'équipe", async () => {
    render(<AdminTeamsPage />);

    const link = await screen.findByTestId("admin-team-journal-link");
    expect(link.getAttribute("href")).toBe("/me/teams/team-1/journal");
  });
});

describe("AdminTeamsPage — filtre ruleset", () => {
  it("relance la recherche quand le ruleset change", async () => {
    render(<AdminTeamsPage />);
    await screen.findByTestId("admin-team-row-team-1");

    const select = screen.getByDisplayValue("Tous les rulesets");
    fireEvent.change(select, { target: { value: "season_3" } });

    await screen.findByTestId("admin-team-row-team-1");
    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(
      calls.some(([url]) => String(url).includes("ruleset=season_3")),
    ).toBe(true);
  });
});


describe("AdminTeamsPage — équipes supprimées", () => {
  it("demande le périmètre « active » par défaut", async () => {
    render(<AdminTeamsPage />);
    await screen.findByTestId("admin-team-row-team-1");

    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.some(([url]) => String(url).includes("deleted=active"))).toBe(
      true,
    );
  });

  it("relance la recherche sur le périmètre « deleted »", async () => {
    render(<AdminTeamsPage />);
    await screen.findByTestId("admin-team-row-team-1");

    fireEvent.change(screen.getByTestId("admin-teams-deleted-filter"), {
      target: { value: "deleted" },
    });

    await screen.findByTestId("admin-team-row-team-1");
    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls.some(([url]) => String(url).includes("deleted=deleted"))).toBe(
      true,
    );
  });

  it("marque les équipes supprimées et propose la restauration", async () => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        teams: [{ ...TEAM, deletedAt: "2026-08-27T10:00:00.000Z" }],
        pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
      }),
    })) as unknown as typeof fetch;

    render(<AdminTeamsPage />);

    const badge = await screen.findByTestId("admin-team-deleted-badge-team-1");
    expect(badge.textContent).toBe("Supprimée");
    expect(screen.getByTestId("admin-team-restore-team-1")).toBeTruthy();
    // Une équipe supprimée ne se re-supprime pas.
    expect(screen.queryByTestId("admin-team-delete-team-1")).toBeNull();
  });

  it("garde le bouton Supprimer sur une équipe active", async () => {
    render(<AdminTeamsPage />);

    expect(await screen.findByTestId("admin-team-delete-team-1")).toBeTruthy();
    expect(screen.queryByTestId("admin-team-restore-team-1")).toBeNull();
    expect(screen.queryByTestId("admin-team-deleted-badge-team-1")).toBeNull();
  });

  it("appelle l'endpoint de restauration au clic sur Restaurer", async () => {
    const fetchMock = vi.fn(async (url: any, init?: any) => {
      if (String(url).includes("/restore")) {
        return { ok: true, status: 200, json: async () => ({ ok: true }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          teams: [{ ...TEAM, deletedAt: "2026-08-27T10:00:00.000Z" }],
          pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
        }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<AdminTeamsPage />);
    fireEvent.click(await screen.findByTestId("admin-team-restore-team-1"));

    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            String(url).includes("/admin/teams/team-1/restore") &&
            (init as RequestInit | undefined)?.method === "POST",
        ),
      ).toBe(true);
    });
  });
});
