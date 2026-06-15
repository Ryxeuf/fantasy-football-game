import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));
vi.mock("../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn().mockResolvedValue([]),
}));

import { apiRequest } from "../lib/api-client";
import { LanguageProvider } from "../contexts/LanguageContext";
import { FeatureFlagProvider } from "../contexts/FeatureFlagContext";
import MePage from "./page";

const mockedApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;

function renderMe() {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>
        <MePage />
      </FeatureFlagProvider>
    </LanguageProvider>,
  );
}

describe("MePage (tableau de bord /me)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "fake-token");
  });

  it("rend le tableau de bord du coach connecte", async () => {
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/auth/me"))
        return Promise.resolve({
          user: { id: "u1", coachName: "Nuffle", _count: { teams: 0 } },
        });
      if (path.startsWith("/team/mine")) return Promise.resolve({ teams: [] });
      if (path.startsWith("/api/rosters")) return Promise.resolve({ rosters: [] });
      return Promise.resolve({});
    });

    renderMe();

    await waitFor(() =>
      expect(screen.getByTestId("coach-dashboard")).toBeTruthy(),
    );
    expect(screen.getByTestId("dashboard-greeting").textContent).toContain(
      "Nuffle",
    );
    // Lien retour vers l'accueil public depuis la page perso.
    expect(screen.getByTestId("dashboard-home-link").getAttribute("href")).toBe(
      "/",
    );
  });

  it("affiche un ecran de chargement avant la resolution de /auth/me", () => {
    mockedApiRequest.mockImplementation(() => new Promise(() => {}));
    renderMe();
    expect(screen.getByTestId("me-loading")).toBeTruthy();
  });
});
