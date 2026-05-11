/**
 * Tests de la page admin/pro-league/teams/[id] (edition branding).
 *
 * Couvre : chargement detail, edition form + diff/patch, validation
 * couleur, success message, reset, erreur PATCH.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

import AdminProLeagueTeamEditPage from "./page";

const originalFetch = global.fetch;

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
  baseTv: 1000,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
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
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockGetTeam(team = teamFixture) {
  return vi.fn().mockResolvedValueOnce({
    ok: true,
    json: async () => ({ team }),
  } as unknown as Response);
}

describe("AdminProLeagueTeamEditPage", () => {
  it("affiche le form pre-rempli avec les valeurs serveur", async () => {
    global.fetch = mockGetTeam() as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);

    await waitFor(() => {
      expect(screen.getByTestId("input-city")).toBeTruthy();
    });
    expect((screen.getByTestId("input-city") as HTMLInputElement).value).toBe(
      "Pittsburgh",
    );
    expect((screen.getByTestId("input-name") as HTMLInputElement).value).toBe(
      "Smashers",
    );
    expect(
      (screen.getByTestId("input-primary") as HTMLInputElement).value,
    ).toBe("#000000");
    expect((screen.getByTestId("input-motto") as HTMLInputElement).value).toBe(
      "Smash hour",
    );
  });

  it("dirty count = 0 a l'initial", async () => {
    global.fetch = mockGetTeam() as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);

    await waitFor(() => {
      expect(screen.getByTestId("dirty-count")).toBeTruthy();
    });
    expect(screen.getByTestId("dirty-count").textContent).toMatch(
      /Aucune modification/,
    );
  });

  it("incremente dirty count quand un champ change", async () => {
    global.fetch = mockGetTeam() as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);

    await waitFor(() => {
      expect(screen.getByTestId("input-motto")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("input-motto"), {
      target: { value: "New motto" },
    });

    expect(screen.getByTestId("dirty-count").textContent).toMatch(
      /1 champ modifie/,
    );
  });

  it("PATCH n'envoie que les champs modifies", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ team: teamFixture }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        team: { ...teamFixture, motto: "Updated", primaryColor: "#FF0000" },
      }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);
    await waitFor(() => {
      expect(screen.getByTestId("input-motto")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("input-motto"), {
      target: { value: "Updated" },
    });
    fireEvent.change(screen.getByTestId("input-primary"), {
      target: { value: "#FF0000" },
    });

    fireEvent.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(screen.getByTestId("form-success")).toBeTruthy();
    });

    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall[1].method).toBe("PATCH");
    const body = JSON.parse(patchCall[1].body as string);
    expect(body).toEqual({ motto: "Updated", primaryColor: "#FF0000" });
  });

  it("vide motto envoie null pour effacer", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ team: teamFixture }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ team: { ...teamFixture, motto: null } }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);
    await waitFor(() => {
      expect(screen.getByTestId("input-motto")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("input-motto"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(screen.getByTestId("form-success")).toBeTruthy();
    });

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).toEqual({ motto: null });
  });

  it("affiche erreur format invalide pour couleur", async () => {
    global.fetch = mockGetTeam() as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);
    await waitFor(() => {
      expect(screen.getByTestId("input-primary")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("input-primary"), {
      target: { value: "red" },
    });

    expect(screen.getByText(/#RRGGBB/)).toBeTruthy();
    const saveBtn = screen.getByTestId("btn-save") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("bouton save desactive quand pas dirty", async () => {
    global.fetch = mockGetTeam() as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);
    await waitFor(() => {
      expect(screen.getByTestId("btn-save")).toBeTruthy();
    });

    const saveBtn = screen.getByTestId("btn-save") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("reset restaure les valeurs serveur", async () => {
    global.fetch = mockGetTeam() as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);
    await waitFor(() => {
      expect(screen.getByTestId("input-motto")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("input-motto"), {
      target: { value: "Changed" },
    });
    expect(
      (screen.getByTestId("input-motto") as HTMLInputElement).value,
    ).toBe("Changed");

    fireEvent.click(screen.getByTestId("btn-reset"));

    expect(
      (screen.getByTestId("input-motto") as HTMLInputElement).value,
    ).toBe("Smash hour");
  });

  it("affiche erreur PATCH si serveur rejette", async () => {
    const fetchMock = vi.fn();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ team: teamFixture }),
    } as unknown as Response);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Forbidden" }),
    } as unknown as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<AdminProLeagueTeamEditPage />);
    await waitFor(() => {
      expect(screen.getByTestId("input-motto")).toBeTruthy();
    });

    fireEvent.change(screen.getByTestId("input-motto"), {
      target: { value: "X" },
    });
    fireEvent.click(screen.getByTestId("btn-save"));

    await waitFor(() => {
      expect(screen.getByTestId("form-error")).toBeTruthy();
    });
    expect(screen.getByTestId("form-error").textContent).toMatch(/Forbidden/);
  });
});
