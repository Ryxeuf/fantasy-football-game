/**
 * Règlement de tournoi dans le builder : les règles du pack qui ne se
 * réduisent pas à un budget doivent être visibles ET appliquées à la
 * sélection — effectif régulier minimum avant tout Star Player, surcoût des
 * compétences Élite.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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

/** Poste dont le minimum est paramétrable : pilote l'effectif de départ. */
function lineman(min: number) {
  return {
    slug: "lineman",
    displayName: "Trois-quart",
    cost: 50,
    min,
    max: 16,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "",
  };
}

/** Snotlings : autorisés aux Star Players par le pack, une seule Ligue. */
const SNOTLING = {
  slug: "snotling",
  name: "Snotlings",
  regionalLeagueOptions: [
    { slug: "underworld_challenge", name: "Défi des Bas-fonds" },
  ],
};

function mockApis(min: number) {
  apiRequest.mockImplementation((path: unknown) => {
    if (String(path).includes("/api/skills")) {
      return Promise.resolve({ skills: [] });
    }
    return Promise.resolve({
      roster: { positions: [lineman(min)], specialRules: [] },
      ruleset: "season_3",
    });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("builder-rosters")
        ? { rosters: [SNOTLING] }
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

function renderWithPack(min: number) {
  mockApis(min);
  window.history.replaceState(
    {},
    "",
    "/me/teams/new?roster=snotling&tournamentRuleset=naf_world_cup_2027",
  );
  return render(
    <LanguageProvider>
      <NewTeamPage />
    </LanguageProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem("auth_token", "token");
});

describe("Builder — règles du règlement de tournoi", () => {
  it("annonce l'effectif minimum et le surcoût Élite dans le récapitulatif", async () => {
    renderWithPack(11);
    const summary = await screen.findByTestId("tournament-ruleset-info");
    await waitFor(() =>
      expect(summary.textContent).toMatch(/11 joueurs réguliers/),
    );
    expect(summary.textContent).toMatch(/Compétences Élite/);
    expect(summary.textContent).toMatch(/\+2 PSP/);
  });

  it("bloque les Star Players sous l'effectif régulier minimum", async () => {
    renderWithPack(0);
    await waitFor(() =>
      expect(
        screen.getByTestId("star-players-requires-roster-size"),
      ).toBeTruthy(),
    );
    expect(
      screen.getByTestId("star-players-requires-roster-size").textContent,
    ).toMatch(/11 joueurs réguliers/);
  });

  it("débloque les Star Players une fois l'effectif atteint", async () => {
    renderWithPack(11);
    await waitFor(() =>
      expect(screen.getByText(/Star Players Blood Bowl/)).toBeTruthy(),
    );
    expect(
      screen.queryByTestId("star-players-requires-roster-size"),
    ).toBeNull();
  });
});
