/**
 * Tests de la page /pro-league/leagues (mes ligues).
 *
 * Couvre : liste vide, liste avec data, modal create + submit, modal
 * join + submit, gestion erreurs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import MyPredictionLeaguesPage from "./page";

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

const leagueFixture = {
  id: "l1",
  name: "Le Bureau",
  joinCode: "ABCDEFGH",
  isPrivate: true,
  isOwner: true,
  memberCount: 5,
  joinedAt: "2026-05-01T00:00:00.000Z",
  createdAt: "2026-04-01T00:00:00.000Z",
};

describe("MyPredictionLeaguesPage", () => {
  it("affiche les cards des ligues apres chargement", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leagues: [leagueFixture] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<MyPredictionLeaguesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("league-card-l1")).toBeTruthy();
    });
    expect(screen.getByText("Le Bureau")).toBeTruthy();
    expect(screen.getByText("ABCDEFGH")).toBeTruthy();
    expect(screen.getByText(/5 membres/)).toBeTruthy();
    expect(screen.getByText("OWNER")).toBeTruthy();
  });

  it("affiche message empty quand 0 ligue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leagues: [] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<MyPredictionLeaguesPage />);

    await waitFor(() => {
      expect(screen.getByTestId("leagues-empty")).toBeTruthy();
    });
  });

  it("ouvre la modal create", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leagues: [] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<MyPredictionLeaguesPage />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-open-create")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("btn-open-create"));

    expect(screen.getByTestId("modal-create")).toBeTruthy();
    expect(screen.getByTestId("input-name")).toBeTruthy();
  });

  it("submit create league appelle l'endpoint et reload", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: [] }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagueId: "l2", joinCode: "XYZABC12" }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        leagues: [{ ...leagueFixture, id: "l2", name: "Nouveau" }],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MyPredictionLeaguesPage />);
    await waitFor(() => screen.getByTestId("btn-open-create"));
    fireEvent.click(screen.getByTestId("btn-open-create"));

    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "Nouveau" },
    });
    fireEvent.click(screen.getByTestId("btn-submit-create"));

    await waitFor(() => {
      expect(screen.getByTestId("league-card-l2")).toBeTruthy();
    });

    const createCall = fetchMock.mock.calls[1];
    expect(createCall[0]).toMatch(/\/prediction-leagues$/);
    expect(createCall[1].method).toBe("POST");
    expect(JSON.parse(createCall[1].body as string)).toEqual({
      name: "Nouveau",
    });
  });

  it("affiche erreur si create echoue", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: [] }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Nom trop court" }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MyPredictionLeaguesPage />);
    await waitFor(() => screen.getByTestId("btn-open-create"));
    fireEvent.click(screen.getByTestId("btn-open-create"));

    fireEvent.change(screen.getByTestId("input-name"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByTestId("btn-submit-create"));

    await waitFor(() => {
      expect(screen.getByTestId("modal-error")).toBeTruthy();
    });
    expect(screen.getByTestId("modal-error").textContent).toMatch(/Nom trop court/);
  });

  it("submit join league appelle l'endpoint et reload", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: [] }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagueId: "l3", leagueName: "Joined" }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        leagues: [{ ...leagueFixture, id: "l3", name: "Joined" }],
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<MyPredictionLeaguesPage />);
    await waitFor(() => screen.getByTestId("btn-open-join"));
    fireEvent.click(screen.getByTestId("btn-open-join"));

    fireEvent.change(screen.getByTestId("input-code"), {
      target: { value: "abcdefgh" },
    });
    fireEvent.click(screen.getByTestId("btn-submit-join"));

    await waitFor(() => {
      expect(screen.getByTestId("league-card-l3")).toBeTruthy();
    });

    const joinCall = fetchMock.mock.calls[1];
    expect(joinCall[0]).toMatch(/\/join$/);
    expect(JSON.parse(joinCall[1].body as string)).toEqual({
      joinCode: "ABCDEFGH",
    });
  });

  it("input code force uppercase", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leagues: [] }),
    } as unknown as Response) as unknown as typeof fetch;

    render(<MyPredictionLeaguesPage />);
    await waitFor(() => screen.getByTestId("btn-open-join"));
    fireEvent.click(screen.getByTestId("btn-open-join"));

    fireEvent.change(screen.getByTestId("input-code"), {
      target: { value: "abc" },
    });
    const input = screen.getByTestId("input-code") as HTMLInputElement;
    expect(input.value).toBe("ABC");
  });
});
