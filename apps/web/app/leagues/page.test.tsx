import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../contexts/LanguageContext";

// La page monte `JoinByCodeField` (saisie de code) qui consomme
// `useRouter()` de next/navigation. On le stub pour le rendu en test.
// Le sélecteur « Toutes / Les miennes » lit et écrit `?scope=`.
const replaceMock = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, prefetch: vi.fn() }),
  usePathname: () => "/leagues",
  useSearchParams: () => new URLSearchParams(search),
}));

import LeaguesPage from "./page";

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

function renderWithProvider() {
  return render(
    <LanguageProvider>
      <LeaguesPage />
    </LanguageProvider>,
  );
}

const mockLeaguesData = {
  leagues: [
    {
      id: "lg-1",
      name: "Open 5 Teams",
      description: "Ligue ouverte aux 5 rosters prioritaires",
      creatorId: "u1",
      ruleset: "season_3",
      status: "open",
      isPublic: true,
      maxParticipants: 16,
      allowedRosters: ["skaven", "gnomes", "lizardmen", "dwarf", "imperial_nobility"],
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      forfeitPoints: -1,
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    },
    {
      id: "lg-2",
      name: "Casual League",
      description: null,
      creatorId: "u2",
      ruleset: "season_2",
      status: "draft",
      isPublic: false,
      maxParticipants: 8,
      allowedRosters: null,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      forfeitPoints: -1,
      createdAt: "2026-02-01T10:00:00.000Z",
      updatedAt: "2026-02-01T10:00:00.000Z",
    },
  ],
};

describe("LeaguesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    search = "";
    localStorageMock.getItem.mockReturnValue("test-token");
  });

  it("shows loading state initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithProvider();
    expect(screen.getByText(/chargement/i)).toBeTruthy();
  });

  it("displays the list of leagues after successful fetch", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Open 5 Teams")).toBeTruthy();
    });

    expect(screen.getByText("Casual League")).toBeTruthy();
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText(/erreur/i)).toBeTruthy();
    });
  });

  it("shows empty state when no leagues are returned", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ leagues: [] }),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("leagues-empty")).toBeTruthy();
    });
  });

  it("calls the correct API endpoint with Authorization header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [url, options] = mockFetch.mock.calls[0];
    expect(String(url)).toMatch(/\/leagues(\?|$)/);
    const headers = (options?.headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
  });

  it("filters leagues by status when a status filter is selected", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Open 5 Teams")).toBeTruthy();
    });

    const select = screen.getByTestId("leagues-status-filter") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "open" } });

    await waitFor(() => {
      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(String(lastCall[0])).toContain("status=open");
    });
  });

  // Les ligues archivees ne s'affichent plus dans la liste de base (le
  // serveur les exclut sans filtre explicite) : le filtre ne doit donc pas
  // proposer de les y ramener. Elles vivent sur `/leagues/archived`.
  it("ne propose pas le statut « archivée » dans le filtre", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Open 5 Teams")).toBeTruthy();
    });

    const select = screen.getByTestId(
      "leagues-status-filter",
    ) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).not.toContain("archived");
    expect(values).toEqual(["all", "draft", "open", "in_progress", "completed"]);
  });

  it("renvoie vers la page des ligues archivées", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    const link = (await screen.findByTestId(
      "leagues-archived-link",
    )) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/leagues/archived");
  });

  it("links each league row to its detail page", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Open 5 Teams")).toBeTruthy();
    });

    const links = screen.getAllByRole("link");
    const detailLink = links.find((a) =>
      (a as HTMLAnchorElement).href.endsWith("/leagues/lg-1"),
    );
    expect(detailLink).toBeTruthy();
  });

  it("displays participant limit and ruleset for each league", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByText("Open 5 Teams")).toBeTruthy();
    });

    // Ruleset labels (Saison 2 / Saison 3) must be visible
    expect(screen.getAllByText(/saison 3/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/saison 2/i).length).toBeGreaterThanOrEqual(1);
    // Max participants should be shown
    expect(screen.getAllByText(/16/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/8/).length).toBeGreaterThanOrEqual(1);
  });

  // La brique ligue n'est plus sous feature flag : le CTA est toujours la.
  it("always shows the create-league CTA", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLeaguesData),
    });

    renderWithProvider();

    await waitFor(() => {
      expect(screen.getByTestId("leagues-create-cta")).toBeTruthy();
    });
  });

  describe("« Toutes / Les miennes »", () => {
    it("arrivée sur la liste : « Toutes » sélectionné, appel sans scope", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLeaguesData),
      });
      renderWithProvider();
      const all = await screen.findByTestId("leagues-scope-all");
      expect(all.getAttribute("aria-checked")).toBe("true");
      expect(String(mockFetch.mock.calls[0][0])).not.toContain("scope=");
    });

    it("lien partagé ?scope=mine : « Les miennes » sélectionné, scope transmis à l'API", async () => {
      search = "scope=mine";
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ leagues: [] }),
      });
      renderWithProvider();
      const mine = await screen.findByTestId("leagues-scope-mine");
      expect(mine.getAttribute("aria-checked")).toBe("true");
      expect(String(mockFetch.mock.calls[0][0])).toContain("scope=mine");
      expect(screen.getByTestId("leagues-empty").textContent).toMatch(
        /aucune compétition/i,
      );
    });

    it("le clic écrit l'URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockLeaguesData),
      });
      renderWithProvider();
      fireEvent.click(await screen.findByTestId("leagues-scope-mine"));
      expect(replaceMock).toHaveBeenCalledWith("/leagues?scope=mine", {
        scroll: false,
      });
    });

    it("badge de rôle servi par l'API, absent sans viewerRoles", async () => {
      const [first, second] = mockLeaguesData.leagues;
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            leagues: [
              {
                ...first,
                viewerRoles: {
                  commissioner: true,
                  participant: "active",
                  teams: [{ id: "t1", name: "Gobs" }],
                },
              },
              second,
            ],
          }),
      });
      renderWithProvider();
      expect(
        (await screen.findByTestId("league-role-lg-1-commissioner")).textContent,
      ).toMatch(/Commissaire/);
      expect(screen.getByTestId("league-role-lg-1-active")).toBeTruthy();
      expect(screen.queryByTestId("league-role-lg-2-commissioner")).toBeNull();
    });
  });
});
