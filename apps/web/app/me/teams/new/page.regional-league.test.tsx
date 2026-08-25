/**
 * Ligue régionale dans le builder :
 *  - plusieurs Ligues ouvertes ⇒ choix OBLIGATOIRE (création bloquée) ;
 *  - une seule Ligue ⇒ imposée d'office, rien à demander ;
 *  - tant que la Ligue n'est pas tranchée, pas de sélecteur de Star Players
 *    (ses recrues en dépendent).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const apiRequest = vi.fn();
vi.mock("../../../lib/api-client", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import NewTeamPage from "./page";
import { LanguageProvider } from "../../../contexts/LanguageContext";

const LINEMAN = {
  slug: "lineman",
  displayName: "Trois-quart",
  cost: 50,
  min: 11,
  max: 16,
  ma: 6,
  st: 3,
  ag: 3,
  pa: 4,
  av: 9,
  skills: "",
};

const MULTI = {
  slug: "halfling",
  name: "Halflings",
  regionalLeagueOptions: [
    { slug: "halfling_thimble_cup", name: "Coupe Dé à Coudre Halfling" },
    { slug: "woodland_league", name: "Ligue Sylvestre" },
  ],
};

const SINGLE = {
  slug: "skaven",
  name: "Skavens",
  regionalLeagueOptions: [
    { slug: "underworld_challenge", name: "Défi des Bas-fonds" },
  ],
};

function mockRosters(rosters: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("builder-rosters")
        ? { rosters }
        : url.includes("star-players")
          ? { starPlayers: [] }
          : {};
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(payload),
      } as Response);
    }),
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem("auth_token", "token");
  apiRequest.mockResolvedValue({
    roster: { positions: [LINEMAN], specialRules: [] },
    ruleset: "season_3",
  });
  window.history.replaceState({}, "", "/me/teams/new");
});

function renderPage() {
  return render(
    <LanguageProvider>
      <NewTeamPage />
    </LanguageProvider>,
  );
}

describe("Builder — Ligue régionale obligatoire", () => {
  it("bloque la création tant qu'aucune Ligue n'est choisie", async () => {
    mockRosters([MULTI]);
    window.history.replaceState({}, "", "/me/teams/new?roster=halfling");
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("regional-league-picker")).toBeTruthy(),
    );
    expect(screen.getByTestId("regional-league-required")).toBeTruthy();
    expect(screen.getByTestId("hint-regional-league")).toBeTruthy();
    expect(
      (screen.getByTestId("create-team-submit") as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(
      screen.getByTestId("regional-league-option-woodland_league")
        .querySelector("input") as HTMLInputElement,
    );

    await waitFor(() =>
      expect(
        (screen.getByTestId("create-team-submit") as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(screen.queryByTestId("hint-regional-league")).toBeNull();
  });

  it("impose d'office la Ligue quand le roster n'en a qu'une", async () => {
    mockRosters([SINGLE]);
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("regional-league-imposed")).toBeTruthy(),
    );
    expect(screen.queryByTestId("hint-regional-league")).toBeNull();
    await waitFor(() =>
      expect(
        (screen.getByTestId("create-team-submit") as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });

  it("n'affiche pas le sélecteur de Star Players avant le choix de Ligue", async () => {
    mockRosters([MULTI]);
    window.history.replaceState({}, "", "/me/teams/new?roster=halfling");
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("builder-advanced-toggle")).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId("builder-advanced-toggle"));

    await waitFor(() =>
      expect(screen.getByTestId("star-players-requires-league")).toBeTruthy(),
    );

    fireEvent.click(
      screen.getByTestId("regional-league-option-woodland_league")
        .querySelector("input") as HTMLInputElement,
    );

    await waitFor(() =>
      expect(screen.queryByTestId("star-players-requires-league")).toBeNull(),
    );
  });
});
