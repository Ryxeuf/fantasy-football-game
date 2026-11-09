/**
 * Ligues archivées : « Toutes / Les miennes » transmis au serveur sur les
 * DEUX lectures (terminées + archivées), badges de rôle servis par l'API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";

let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/leagues/archived",
  useSearchParams: () => new URLSearchParams(search),
}));

const apiRequestMock = vi.fn();
vi.mock("../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  ApiClientError: class extends Error {},
}));

import ArchivedLeaguesPage from "./page";

function league(id: string, status: string, over: Record<string, unknown> = {}) {
  return {
    id,
    name: `Ligue ${id}`,
    description: null,
    ruleset: "season_3",
    status,
    isPublic: true,
    maxParticipants: 8,
    allowedRosters: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
    ...over,
  };
}

function renderPage() {
  return render(
    <LanguageProvider>
      <ArchivedLeaguesPage />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  search = "";
});

describe("/leagues/archived — scope et rôles", () => {
  it("défaut « Toutes » : aucune des deux lectures ne porte scope", async () => {
    apiRequestMock.mockResolvedValue({ leagues: [] });
    renderPage();
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(2));
    for (const [path] of apiRequestMock.mock.calls) {
      expect(String(path)).not.toContain("scope=");
    }
    expect(
      (await screen.findByTestId("archived-leagues-scope-all")).getAttribute(
        "aria-checked",
      ),
    ).toBe("true");
  });

  it("?scope=mine : les deux lectures filtrent côté serveur", async () => {
    search = "scope=mine";
    apiRequestMock.mockResolvedValue({ leagues: [] });
    renderPage();
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(2));
    const paths = apiRequestMock.mock.calls.map(([p]) => String(p));
    expect(paths).toEqual([
      "/leagues?status=completed&limit=50&scope=mine",
      "/leagues?status=archived&limit=50&scope=mine",
    ]);
  });

  it("badge « Retiré » / « Commissaire » sur les cartes", async () => {
    apiRequestMock.mockImplementation(async (path: string) =>
      path.includes("status=completed")
        ? {
            leagues: [
              league("c1", "completed", {
                viewerRoles: { commissioner: false, participant: "withdrawn", teams: [] },
              }),
            ],
          }
        : {
            leagues: [
              league("a1", "archived", {
                viewerRoles: { commissioner: true, participant: null, teams: [] },
              }),
            ],
          },
    );
    renderPage();
    expect(
      await screen.findByTestId("archived-league-role-c1-withdrawn"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("archived-league-role-a1-commissioner"),
    ).toBeTruthy();
  });
});
