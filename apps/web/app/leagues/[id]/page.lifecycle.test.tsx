/**
 * Page ligue — panneau « Gestion de la compétition » (archiver / supprimer) :
 * visible pour le commissaire (et l'admin), masqué aux autres coachs ;
 * l'archivage recharge la ligue, la suppression renvoie vers /leagues.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";

vi.mock("../../hooks/useFeatureFlag", () => ({
  useFeatureFlag: vi.fn(() => true),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "lg-1" }),
  useRouter: () => ({ push, back: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import LeagueDetailPage from "./page";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>(() => "test-token"),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const baseLeague = {
  id: "lg-1",
  name: "Open 5 Teams",
  description: null,
  creatorId: "u1",
  creator: { id: "u1", coachName: "Coach Bob", email: "bob@example.com" },
  ruleset: "season_3",
  status: "open",
  isPublic: true,
  maxParticipants: 16,
  allowedRosters: null,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  forfeitPoints: -1,
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-01T10:00:00.000Z",
  seasons: [],
};

interface ApiScenario {
  meUserId: string | null;
  meRoles?: string[];
  league?: typeof baseLeague;
}

function mockApi(scenario: ApiScenario) {
  let league = scenario.league ?? baseLeague;
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (/\/auth\/me$/.test(url)) {
      return {
        ok: true,
        json: async () => ({
          user: scenario.meUserId
            ? { id: scenario.meUserId, roles: scenario.meRoles ?? ["user"] }
            : null,
        }),
      };
    }
    if (/\/leagues\/lg-1\/archive$/.test(url) && method === "POST") {
      league = { ...league, status: "archived" };
      return { ok: true, json: async () => ({ success: true, data: { changed: true } }) };
    }
    if (/\/leagues\/lg-1$/.test(url) && method === "DELETE") {
      return { ok: true, json: async () => ({ success: true, data: { deleted: true } }) };
    }
    if (/\/leagues\/lg-1(?:$|\?)/.test(url)) {
      return { ok: true, json: async () => ({ league }) };
    }
    if (/\/competitions\//.test(url)) {
      return { ok: true, json: async () => ({ success: true, data: { documents: [] } }) };
    }
    return { ok: false, status: 404, json: async () => ({ error: "not found" }) };
  });
}

function renderPage() {
  return render(
    <LanguageProvider>
      <LeagueDetailPage />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockReturnValue("test-token");
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LeagueDetailPage — gestion (archiver / supprimer)", () => {
  it("le commissaire voit le panneau et peut archiver (rechargement du statut)", async () => {
    mockApi({ meUserId: "u1" });
    renderPage();
    const archiveButton = await screen.findByTestId("lifecycle-archive-button");
    fireEvent.click(archiveButton);
    await waitFor(() => {
      expect(
        mockFetch.mock.calls.some(
          ([url, init]) =>
            /\/leagues\/lg-1\/archive$/.test(String(url)) &&
            (init as RequestInit | undefined)?.method === "POST",
        ),
      ).toBe(true);
    });
    // Après rechargement, le statut affiché passe à « Archivée » et le
    // bouton d'archivage disparaît.
    await waitFor(() => expect(screen.queryByTestId("lifecycle-archive-button")).toBeNull());
    expect(screen.getByTestId("competition-lifecycle-panel")).toBeTruthy();
  });

  it("supprimer exige le nom exact puis renvoie vers /leagues", async () => {
    mockApi({ meUserId: "u1" });
    renderPage();
    const deleteButton = (await screen.findByTestId(
      "lifecycle-delete-button",
    )) as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("lifecycle-delete-confirm-input"), {
      target: { value: "Open 5 Teams" },
    });
    expect(deleteButton.disabled).toBe(false);
    fireEvent.click(deleteButton);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/leagues"));
    expect(
      mockFetch.mock.calls.some(
        ([url, init]) =>
          /\/leagues\/lg-1$/.test(String(url)) &&
          (init as RequestInit | undefined)?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("un admin non créateur voit aussi le panneau", async () => {
    mockApi({ meUserId: "admin-9", meRoles: ["user", "admin"] });
    renderPage();
    expect(await screen.findByTestId("competition-lifecycle-panel")).toBeTruthy();
  });

  it("un autre coach ne voit pas le panneau", async () => {
    mockApi({ meUserId: "u2" });
    renderPage();
    await waitFor(() => expect(screen.getByText("Open 5 Teams")).toBeTruthy());
    // Laisse le temps à /auth/me d'être résolu puis vérifie l'absence.
    await waitFor(() => expect(screen.queryByTestId("edit-league-cta")).toBeNull());
    expect(screen.queryByTestId("competition-lifecycle-panel")).toBeNull();
  });
});
