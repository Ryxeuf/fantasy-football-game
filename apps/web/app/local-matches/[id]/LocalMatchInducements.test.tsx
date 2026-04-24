import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LocalMatchInducements from "./LocalMatchInducements";
import type { InducementDefinition, InducementSlug } from "@bb/game-engine";

vi.mock("../../contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      inducements: {
        title: "Inducements",
        pettyCash: "Petty Cash",
        budget: "Budget",
        remaining: "Remaining",
        totalCost: "Total cost",
        confirm: "Confirm",
        skip: "Skip",
        noBudget: "No budget",
        selectInducements: "Select inducements",
      },
      teams: { kpo: "K" },
    },
    language: "fr",
  }),
}));

vi.mock("../../auth-client", () => ({
  API_BASE: "http://api.test",
}));

const CATALOGUE: InducementDefinition[] = [
  {
    slug: "extra_team_training" as InducementSlug,
    displayName: "Extra Team Training",
    displayNameFr: "Entrainement",
    baseCost: 100_000,
    maxQuantity: 4,
    description: "Extra re-roll",
  },
];

const INDUCEMENTS_INFO = {
  catalogue: CATALOGUE,
  pettyCash: {
    teamA: { base: 100_000, treasuryUsed: 0, maxBudget: 100_000 },
    teamB: { base: 200_000, treasuryUsed: 0, maxBudget: 200_000 },
  },
  teamA: {
    name: "Orcs",
    roster: "orcs",
    ctv: 1_000_000,
    budget: 100_000,
    hasApothecary: true,
  },
  teamB: {
    name: "Humans",
    roster: "humans",
    ctv: 900_000,
    budget: 200_000,
    hasApothecary: true,
  },
};

describe("LocalMatchInducements", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    vi.stubGlobal("localStorage", {
      getItem: () => "token-123",
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads inducements info on mount and renders both team selectors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => INDUCEMENTS_INFO,
    });

    render(
      <LocalMatchInducements matchId="match-1" onSuccess={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Equipe A/)).toBeDefined();
      expect(screen.getByText(/Equipe B/)).toBeDefined();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/local-match/match-1/inducements-info",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-123",
        }),
      }),
    );
  });

  it("submits empty selections when 'Passer' button is clicked", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => INDUCEMENTS_INFO,
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ localMatch: {}, gameState: {} }),
    });

    const onSuccess = vi.fn();
    render(
      <LocalMatchInducements matchId="match-1" onSuccess={onSuccess} />,
    );

    await waitFor(() => screen.getByText(/Passer/));
    fireEvent.click(screen.getByText(/Passer/));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("http://api.test/local-match/match-1/inducements");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      selectionA: { items: [] },
      selectionB: { items: [] },
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("disables 'Valider' button until both teams have confirmed", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => INDUCEMENTS_INFO,
    });

    render(
      <LocalMatchInducements matchId="match-1" onSuccess={vi.fn()} />,
    );

    await waitFor(() => screen.getByText("Valider les inducements"));
    const validate = screen.getByText(
      "Valider les inducements",
    ) as HTMLButtonElement;
    expect(validate.disabled).toBe(true);
  });

  it("shows an error when info fetch fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Pas en phase d'inducements" }),
    });

    render(
      <LocalMatchInducements matchId="match-1" onSuccess={vi.fn()} />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Pas en phase/)).toBeDefined(),
    );
    expect(screen.getByText("Reessayer")).toBeDefined();
  });
});
