import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("./lib/api-client", () => ({
  apiRequest: vi.fn(),
}));
const { flags } = vi.hoisted(() => ({ flags: { keys: [] as string[] } }));
vi.mock("./lib/featureFlags", () => ({
  fetchMyFlags: vi.fn(async () => flags.keys),
}));

import { apiRequest } from "./lib/api-client";
import { LanguageProvider } from "./contexts/LanguageContext";
import { FeatureFlagProvider } from "./contexts/FeatureFlagContext";
import HomePage from "./page";

const mockedApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;

function renderHome() {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>
        <HomePage />
      </FeatureFlagProvider>
    </LanguageProvider>,
  );
}

describe("HomePage (accueil marketing + bandeau coach)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.keys = [];
    window.localStorage.clear();
    // Par defaut : la home marketing fetch /api/public/stats — on simule
    // le repli silencieux (reject) pour rester sur les valeurs catalogue.
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/api/public/stats"))
        return Promise.reject(new Error("no stats in test"));
      return Promise.resolve({});
    });
  });

  it("rend la home marketing pour un visiteur deconnecte (pas de token)", async () => {
    renderHome();
    // Marketing rendu immediatement, dashboard absent.
    expect(screen.queryByTestId("coach-dashboard")).toBeNull();
    expect(
      screen.getByText("L'arène où le hasard devient divin."),
    ).toBeTruthy();
    // Aucun appel /auth/me pour un visiteur sans token.
    const calledPaths = mockedApiRequest.mock.calls.map((c) => c[0] as string);
    expect(calledPaths.some((p) => p.startsWith("/auth/me"))).toBe(false);
  });

  it("affiche un bandeau vers le tableau de bord /me pour un coach connecte", async () => {
    window.localStorage.setItem("auth_token", "fake-token");
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/auth/me"))
        return Promise.resolve({ user: { id: "u1", coachName: "Nuffle", _count: { teams: 0 } } });
      if (path.startsWith("/api/public/stats"))
        return Promise.reject(new Error("no stats in test"));
      return Promise.resolve({});
    });

    renderHome();

    // Bandeau personnalise pointant vers la page perso (/me).
    const link = await screen.findByTestId("home-dashboard-link");
    expect(link.getAttribute("href")).toBe("/me");
    expect(link.textContent).toContain("Nuffle");
    // La home publique reste montee ; aucun dashboard inline a la racine.
    expect(screen.queryByTestId("coach-dashboard")).toBeNull();
    expect(
      screen.getByText("L'arène où le hasard devient divin."),
    ).toBeTruthy();
  });

  it("reste sur le marketing sans bandeau si /auth/me echoue (token expire)", async () => {
    window.localStorage.setItem("auth_token", "stale-token");
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/auth/me")) return Promise.reject(new Error("401"));
      if (path.startsWith("/api/public/stats"))
        return Promise.reject(new Error("no stats in test"));
      return Promise.resolve({});
    });

    renderHome();

    await waitFor(() =>
      expect(
        screen.getByText("L'arène où le hasard devient divin."),
      ).toBeTruthy(),
    );
    expect(screen.queryByTestId("coach-dashboard")).toBeNull();
    // Token invalide => pas de bandeau coach.
    expect(screen.queryByTestId("home-dashboard-link")).toBeNull();
  });

  it("hero : un visiteur deconnecte est invite a s'inscrire, ou a se connecter", async () => {
    renderHome();
    const cta = screen.getByTestId("home-hero-cta");
    expect(cta.getAttribute("href")).toBe("/register?redirect=%2Fme%2Fteams");
    expect(cta.textContent).toContain("Créer mon équipe");
    expect(screen.getByTestId("home-hero-login").getAttribute("href")).toBe(
      "/login?redirect=%2Fme%2Fteams",
    );
    expect(screen.getByTestId("home-hero-leagues").getAttribute("href")).toBe("/leagues");
  });

  it("hero : un coach connecte va droit a ses equipes, sans lien de connexion", async () => {
    window.localStorage.setItem("auth_token", "fake-token");
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/auth/me"))
        return Promise.resolve({ user: { id: "u1", coachName: "Nuffle" } });
      if (path.startsWith("/api/public/stats"))
        return Promise.reject(new Error("no stats in test"));
      return Promise.resolve({});
    });
    renderHome();
    await screen.findByTestId("home-dashboard-link");
    const cta = screen.getByTestId("home-hero-cta");
    expect(cta.getAttribute("href")).toBe("/me/teams");
    expect(cta.textContent).toContain("Gérer mes équipes");
    expect(screen.queryByTestId("home-hero-login")).toBeNull();
  });

  it("presente la ligue comme ouverte a tous (plus d'acces anticipe)", async () => {
    renderHome();
    const cta = screen.getByTestId("home-leagues-cta");
    expect(cta.getAttribute("href")).toBe("/leagues");
    expect(screen.getByText("Disponible pour tous")).toBeTruthy();
    expect(screen.queryByText(/Accès anticipé|Bêta fermée|Demander l'accès/)).toBeNull();
    expect(
      screen.getByText("Créer ma ligue").closest("a")?.getAttribute("href"),
    ).toBe("/leagues/new");
  });

  it("place les competitions juste apres le hero, avant tout le reste", async () => {
    renderHome();
    const sections = Array.from(document.querySelectorAll("section"));
    const heroIndex = sections.findIndex((s) =>
      s.textContent?.includes("L'arène où le hasard devient divin."),
    );
    const competitions = screen.getByTestId("home-competitions");
    expect(sections.indexOf(competitions)).toBe(heroIndex + 1);
    expect(screen.getByTestId("home-cups-cta").getAttribute("href")).toBe("/cups");
  });

  it("catalogue en tuiles liees, sans rangee « Acces rapide » en doublon", async () => {
    renderHome();
    const compendium = screen.getByTestId("home-compendium");
    const hrefs = Array.from(compendium.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/compendium", "/aide-de-jeu", "/me/teams"]));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(screen.queryByText(/Accès rapide/)).toBeNull();
  });

  it("factions sous le catalogue, chaque ecu menant a sa fiche", async () => {
    renderHome();
    const sections = Array.from(document.querySelectorAll("section"));
    const factions = screen.getByTestId("home-factions");
    expect(sections.indexOf(factions)).toBeGreaterThan(
      sections.indexOf(screen.getByTestId("home-compendium")),
    );
    expect(screen.getByText("Orques").closest("a")?.getAttribute("href")).toBe("/teams/orc");
  });

  it("fin de page : un seul bloc final, qui porte aussi le lien de soutien", async () => {
    renderHome();
    const final = screen.getByTestId("home-final-cta");
    expect(final.querySelector('a[href="/register?redirect=%2Fme%2Fteams"]')).toBeTruthy();
    expect(screen.getByTestId("home-support-link").getAttribute("href")).toBe("/support");
    expect(final.contains(screen.getByTestId("home-support-link"))).toBe(true);
    expect(document.querySelectorAll('a[href="/support"]')).toHaveLength(1);
  });

  it("ne monte pas le bandeau d'actualite tant que le flag est OFF", async () => {
    renderHome();
    await waitFor(() =>
      expect(screen.getByText("L'arène où le hasard devient divin.")).toBeTruthy(),
    );
    const calledPaths = mockedApiRequest.mock.calls.map((c) => c[0] as string);
    expect(calledPaths.some((p) => p.startsWith("/api/public/news-ticker"))).toBe(false);
    expect(screen.queryByTestId("home-news-ticker")).toBeNull();
  });

  it("monte le bandeau d'actualite quand le flag est ON et l'API sert des items", async () => {
    flags.keys = ["home_news_ticker"];
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/api/public/news-ticker"))
        return Promise.resolve({
          items: [
            { kind: "blog_post", id: "b1", at: "2026-09-20T00:00:00Z", href: "/blog/x", title: "Nouvel article" },
          ],
        });
      if (path.startsWith("/api/public/stats"))
        return Promise.reject(new Error("no stats in test"));
      return Promise.resolve({});
    });
    renderHome();
    // Deux resolutions asynchrones enchainees (flags du provider, puis
    // /api/public/news-ticker) : le timeout par defaut de 1 s de `findBy*`
    // deborde sous la charge du run coverage complet en CI.
    const ticker = await screen.findByTestId(
      "home-news-ticker",
      {},
      { timeout: 5000 },
    );
    expect(ticker.textContent).toContain("Nouvel article");
  });
});
