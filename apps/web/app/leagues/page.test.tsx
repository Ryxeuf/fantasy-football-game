import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LeaguesPage from "./page";
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
    expect(String(url)).toMatch(/\/league(\?|$)/);
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
});
