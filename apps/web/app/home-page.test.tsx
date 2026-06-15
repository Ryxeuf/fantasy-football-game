import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("./lib/api-client", () => ({
  apiRequest: vi.fn(),
}));
vi.mock("./lib/featureFlags", () => ({
  fetchMyFlags: vi.fn().mockResolvedValue([]),
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
});
