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

describe("HomePage (accueil double-face)", () => {
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

  it("bascule vers le dashboard pour un coach connecte", async () => {
    window.localStorage.setItem("auth_token", "fake-token");
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/auth/me"))
        return Promise.resolve({ user: { id: "u1", coachName: "Nuffle", _count: { teams: 0 } } });
      if (path.startsWith("/team/mine")) return Promise.resolve({ teams: [] });
      if (path.startsWith("/api/rosters")) return Promise.resolve({ rosters: [] });
      return Promise.resolve({});
    });

    renderHome();

    await waitFor(() =>
      expect(screen.getByTestId("coach-dashboard")).toBeTruthy(),
    );
    expect(screen.getByTestId("dashboard-greeting").textContent).toContain("Nuffle");
    // Le marketing n'est plus monte.
    expect(
      screen.queryByText("L'arène où le hasard devient divin."),
    ).toBeNull();
  });

  it("reste sur le marketing si /auth/me echoue (token expire)", async () => {
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
  });
});
