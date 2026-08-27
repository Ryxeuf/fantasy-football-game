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
