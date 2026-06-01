/**
 * S26.6c — Tests de la page calendrier des themes `/leagues/seasons`.
 *
 * Cette page consomme deux endpoints publics ajoutes en S26.6b :
 *  - GET /leagues/themes              -> catalogue des 3 themes officiels
 *  - GET /leagues/seasons/themed?...  -> editions existantes par theme
 *
 * On teste : loading, error, ordering par mois, badges couleur,
 * affichage des saisons groupees par theme, et empty state quand un
 * theme n'a pas encore d'edition.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import LeagueSeasonsPage from "./page";
import { LanguageProvider } from "../../contexts/LanguageContext";

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

function renderPage() {
  return render(
    <LanguageProvider>
      <LeagueSeasonsPage />
    </LanguageProvider>,
  );
}

const themesPayload = {
  themes: [
    {
      slug: "skaven_cup",
      title: "Skaven Cup",
      month: 3,
      badgeColor: "#7a8c2c",
      description: "Edition de mars dediee aux equipes Skavens.",
    },
    {
      slug: "nordic_challenge",
      title: "Nordic Challenge",
      month: 4,
      badgeColor: "#2c5d8c",
      description: "Edition d'avril pour les equipes nordiques.",
    },
    {
      slug: "underworld_open",
      title: "Underworld Open",
      month: 5,
      badgeColor: "#5e2c8c",
      description: "Edition de mai pour les bas-fonds.",
    },
  ],
};

const skavenSeasonsPayload = {
  seasons: [
    {
      id: "season-skaven-2026",
      leagueId: "lg-skaven",
      name: "Skaven Cup 2026",
      seasonNumber: 1,
      status: "scheduled",
      theme: "skaven_cup",
      themeYear: 2026,
      league: {
        id: "lg-skaven",
        name: "Skaven Cup League",
        isPublic: true,
        ruleset: "season_3",
      },
    },
  ],
};

function mockThemedFetch(seasonsByTheme: Record<string, unknown>) {
  mockFetch.mockImplementation((url: string | URL) => {
    const u = String(url);
    if (u.includes("/leagues/themes")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(themesPayload),
      });
    }
    const m = u.match(/theme=([^&]+)/);
    const slug = m ? decodeURIComponent(m[1]) : "";
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(seasonsByTheme[slug] ?? { seasons: [] }),
    });
  });
}

describe("LeagueSeasonsPage (S26.6c calendrier themes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("affiche un etat de chargement initial", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("themes-calendar-loading")).toBeTruthy();
  });

  it("affiche les 3 themes ordonnes par mois croissant", async () => {
    mockThemedFetch({});
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("themes-calendar")).toBeTruthy(),
    );
    const cards = screen.getAllByTestId(/^theme-card-/);
    expect(cards).toHaveLength(3);
    expect(cards[0].getAttribute("data-testid")).toBe("theme-card-skaven_cup");
    expect(cards[1].getAttribute("data-testid")).toBe(
      "theme-card-nordic_challenge",
    );
    expect(cards[2].getAttribute("data-testid")).toBe(
      "theme-card-underworld_open",
    );
  });

  it("affiche le badge couleur de chaque theme", async () => {
    mockThemedFetch({});
    renderPage();
    await waitFor(() => screen.getByTestId("theme-card-skaven_cup"));
    const badge = screen.getByTestId("theme-badge-skaven_cup");
    expect(badge.getAttribute("data-color")?.toLowerCase()).toBe("#7a8c2c");
  });

  it("liste les editions existantes pour un theme avec annee", async () => {
    mockThemedFetch({ skaven_cup: skavenSeasonsPayload });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Skaven Cup 2026")).toBeTruthy(),
    );
    const skavenSeasons = screen.getByTestId("theme-seasons-skaven_cup");
    expect(skavenSeasons.textContent).toContain("Skaven Cup 2026");
    expect(skavenSeasons.textContent).toContain("2026");
  });

  it("montre un empty state pour un theme sans edition", async () => {
    mockThemedFetch({ skaven_cup: skavenSeasonsPayload });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Skaven Cup 2026")).toBeTruthy(),
    );
    expect(screen.getByTestId("theme-seasons-empty-nordic_challenge"))
      .toBeTruthy();
    expect(screen.getByTestId("theme-seasons-empty-underworld_open"))
      .toBeTruthy();
  });

  it("affiche une erreur si le catalogue ne charge pas", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "boom" }),
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("themes-calendar-error")).toBeTruthy(),
    );
  });

  it("appelle le bon endpoint catalogue + un fetch par theme", async () => {
    mockThemedFetch({});
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("themes-calendar")).toBeTruthy(),
    );
    const calls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes("/leagues/themes"))).toBe(true);
    expect(
      calls.some((u) =>
        u.includes("/leagues/seasons/themed") && u.includes("theme=skaven_cup"),
      ),
    ).toBe(true);
    expect(
      calls.some((u) => u.includes("theme=nordic_challenge")),
    ).toBe(true);
    expect(
      calls.some((u) => u.includes("theme=underworld_open")),
    ).toBe(true);
  });

  it("place chaque edition derriere un lien vers la page detail saison", async () => {
    mockThemedFetch({ skaven_cup: skavenSeasonsPayload });
    renderPage();
    await waitFor(() => screen.getByText("Skaven Cup 2026"));
    const links = screen.getAllByRole("link");
    const seasonLink = links.find((a) =>
      (a as HTMLAnchorElement).href.endsWith("/leagues/lg-skaven"),
    );
    expect(seasonLink).toBeTruthy();
  });
});
