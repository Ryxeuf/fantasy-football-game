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
    const ticker = await screen.findByTestId("home-news-ticker");
    expect(ticker.textContent).toContain("Nouvel article");
  });
});
