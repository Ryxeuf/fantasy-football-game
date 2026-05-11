/**
 * Tests de la page admin roster team.
 *
 * Couvre : chargement, affichage joueurs/counters, actions (replenish,
 * regenerate, retire), erreurs API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

import AdminProLeagueTeamRosterPage from "./page";

const originalFetch = global.fetch;
const originalConfirm = global.confirm;

const teamFixture = {
  id: "t1",
  slug: "pit-smashers",
  city: "Pittsburgh",
  name: "Smashers",
  race: "Orc",
};

const playerActive = {
  id: "p1",
  name: "Grott Steelfist",
  position: "Lineman",
  ma: 5,
  st: 3,
  ag: 3,
  pa: 4,
  av: 10,
  skills: ["block"],
  status: "active",
  form: 60,
  spp: 12,
  level: 2,
  tvCached: 70000,
  niggling: 0,
  tdCount: 3,
  casCount: 2,
  compCount: 1,
  mvpCount: 0,
};

const playerDead = { ...playerActive, id: "p2", name: "Old Dead", status: "dead" };

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
  global.confirm = vi.fn(() => true);
});

afterEach(() => {
  global.fetch = originalFetch;
  global.confirm = originalConfirm;
});

function mockGetRoster(
  players = [playerActive, playerDead],
  counts = { total: 2, active: 1, injured: 0, dead: 1, retired: 0 },
) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ team: teamFixture, counts, players }),
  } as unknown as Response);
}

describe("AdminProLeagueTeamRosterPage", () => {
  it("affiche la liste des joueurs et les counters", async () => {
    global.fetch = mockGetRoster() as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);

    await waitFor(() => {
      expect(screen.getByTestId("roster-table")).toBeTruthy();
    });
    expect(screen.getByText("Grott Steelfist")).toBeTruthy();
    expect(screen.getByText("Old Dead")).toBeTruthy();
    expect(screen.getByTestId("roster-counts").textContent).toMatch(/Active/);
  });

  it("masque le bouton retire pour un joueur dead", async () => {
    global.fetch = mockGetRoster() as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);

    await waitFor(() => {
      expect(screen.getByTestId("roster-row-p1")).toBeTruthy();
    });
    expect(screen.queryByTestId("btn-retire-p1")).toBeTruthy();
    expect(screen.queryByTestId("btn-retire-p2")).toBeNull();
  });

  it("replenish appelle l'endpoint et rafraichit", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 1, active: 1, injured: 0, dead: 0, retired: 0 },
        players: [playerActive],
      }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        teamId: "t1",
        activeBefore: 1,
        created: 11,
        targetSize: 12,
      }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 12, active: 12, injured: 0, dead: 0, retired: 0 },
        players: [playerActive],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-replenish")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-replenish"));

    await waitFor(() => {
      expect(screen.getByTestId("action-message")).toBeTruthy();
    });
    expect(screen.getByTestId("action-message").textContent).toMatch(
      /11 rookie/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const call2 = fetchMock.mock.calls[1];
    expect(call2[0]).toMatch(/\/roster\/replenish/);
    expect(call2[1].method).toBe("POST");
  });

  it("regenerate appelle l'endpoint destructif et affiche message", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 5, active: 5, injured: 0, dead: 0, retired: 0 },
        players: [playerActive],
      }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ teamId: "t1", deleted: 5, created: 12 }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 12, active: 12, injured: 0, dead: 0, retired: 0 },
        players: [playerActive],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-regenerate")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-regenerate"));

    await waitFor(() => {
      expect(screen.getByTestId("action-message")).toBeTruthy();
    });
    expect(screen.getByTestId("action-message").textContent).toMatch(
      /5.*supprime.*12.*cree/,
    );
    const regenerateCall = fetchMock.mock.calls[1];
    expect(regenerateCall[0]).toMatch(/\/roster\/regenerate/);
    expect(JSON.parse(regenerateCall[1].body as string)).toEqual({ count: 12 });
  });

  it("regenerate annule si confirm refuse", async () => {
    global.confirm = vi.fn(() => false);
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 1, active: 1, injured: 0, dead: 0, retired: 0 },
        players: [playerActive],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-regenerate")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-regenerate"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retire un joueur appelle l'endpoint", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 1, active: 1, injured: 0, dead: 0, retired: 0 },
        players: [playerActive],
      }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ playerId: "p1", previousStatus: "active" }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 1, active: 0, injured: 0, dead: 0, retired: 1 },
        players: [{ ...playerActive, status: "retired" }],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-retire-p1")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-retire-p1"));

    await waitFor(() => {
      expect(screen.getByTestId("action-message")).toBeTruthy();
    });
    const retireCall = fetchMock.mock.calls[1];
    expect(retireCall[0]).toMatch(/\/rosters\/p1\/retire/);
  });

  it("affiche erreur si fetch initial echoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);

    await waitFor(() => {
      expect(screen.getByText(/Forbidden/)).toBeTruthy();
    });
  });

  it("affiche erreur action si replenish echoue", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 0, active: 0, injured: 0, dead: 0, retired: 0 },
        players: [],
      }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Replenish failed" }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-replenish")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-replenish"));

    await waitFor(() => {
      expect(screen.getByTestId("action-error")).toBeTruthy();
    });
    expect(screen.getByTestId("action-error").textContent).toMatch(
      /Replenish failed/,
    );
  });

  it("affiche message empty quand 0 joueurs", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        team: teamFixture,
        counts: { total: 0, active: 0, injured: 0, dead: 0, retired: 0 },
        players: [],
      }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<AdminProLeagueTeamRosterPage />);

    await waitFor(() => {
      expect(screen.getByText(/Aucun joueur dans le roster/)).toBeTruthy();
    });
  });
});
