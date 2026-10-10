/**
 * Coups de pouce achetés à la création (coupe en `build`, règlement de
 * tournoi) : la fiche d'équipe les liste, et leur coût entre dans l'or
 * dépensé à côté des Star Players.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { me } = vi.hoisted(() => ({ me: { current: null as unknown } }));

const { teamPayload } = vi.hoisted(() => ({
  teamPayload: { current: {} as Record<string, unknown> },
}));

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn(async () => ({
    team: {
      id: "team-1",
      name: "Les Rats Véloces",
      roster: "skaven",
      ruleset: "season_3",
      format: "bb11",
      players: [],
      starPlayers: [],
      treasury: 0,
      teamValue: 0,
      currentValue: 0,
      initialBudget: 1000,
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 1,
      ...teamPayload.current,
    },
    currentMatch: null,
    localMatchStats: null,
  })),
  ApiClientError: class ApiClientError extends Error {},
}));

// Panneaux autonomes qui font leurs propres fetchs : hors sujet ici.
vi.mock("./CaptainPanel", () => ({ default: () => null }));
vi.mock("./PendingAdvancementsBanner", () => ({
  PendingAdvancementsBanner: () => null,
}));
vi.mock("./MatchReportBanner", () => ({ MatchReportBanner: () => null }));
vi.mock("./FirstTeamWelcomeBanner", () => ({ default: () => null }));
vi.mock("./TeamShareToggle", () => ({ default: () => null }));
vi.mock("../components/TeamLogoUploader", () => ({ default: () => null }));
vi.mock("../../../lib/tournament-rulesets", () => ({
  useTournamentRulesetLabel: () => null,
}));

import { LanguageProvider } from "../../../contexts/LanguageContext";
import TeamDetailPage from "./page";

const originalFetch = global.fetch;

function renderPage() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );
  render(<TeamDetailPage />, { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  teamPayload.current = {};
  me.current = { id: "u1", email: "coach@test", roles: ["user"] };
  window.history.pushState({}, "", "/me/teams/team-1");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "token", setItem: vi.fn(), removeItem: vi.fn() },
  });
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/me")) {
      return { ok: true, json: async () => ({ user: me.current }) };
    }
    // Fiche roster (nom localisé) : non nécessaire à l'assertion.
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const INDUCEMENTS = [
  { slug: "team_mascot", name: "Mascotte d'Équipe", quantity: 1, unitCost: 25_000 },
  { slug: "bloodweiser_kegs", name: "Fûts de Blitz Premium", quantity: 2, unitCost: 50_000 },
];

const BUDGET = {
  initialBudget: 1_000_000,
  playersCost: 800_000,
  playersHireCost: 800_000,
  advancementsCost: 0,
  starPlayersCost: 0,
  inducementsCost: 125_000,
  staffCost: 0,
  rerollsCost: 0,
  dedicatedFansCost: 0,
  totalSpent: 925_000,
  remaining: 75_000,
  treasury: 0,
  teamValue: 800_000,
  currentValue: 800_000,
};

describe("fiche d'équipe — coups de pouce de création", () => {
  it("liste les coups de pouce avec quantité et coût", async () => {
    teamPayload.current = { inducements: INDUCEMENTS, budgetSummary: BUDGET };
    renderPage();

    await waitFor(() => expect(screen.getByTestId("team-inducements")).toBeTruthy());
    expect(screen.getByTestId("team-inducement-team_mascot").textContent).toMatch(
      /Mascotte d'Équipe\s*×1/,
    );
    expect(
      screen.getByTestId("team-inducement-bloodweiser_kegs").textContent,
    ).toMatch(/Fûts de Blitz Premium\s*×2.*100/);
    expect(screen.getByTestId("team-inducements-total").textContent).toMatch(/125/);
  });

  it("compte leur coût dans l'or dépensé, à côté des Star Players", async () => {
    teamPayload.current = { inducements: INDUCEMENTS, budgetSummary: BUDGET };
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("budget-inducements-cost")).toBeTruthy(),
    );
    expect(screen.getByTestId("budget-inducements-cost").textContent).toMatch(/125/);
    expect(screen.getByTestId("budget-players-cost").textContent).toMatch(/925/);
    expect(screen.getByTestId("budget-total-spent").textContent).toMatch(/925/);
  });

  it("repli d'un serveur sans résumé : le coût se dérive des lignes", async () => {
    teamPayload.current = { inducements: INDUCEMENTS };
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("budget-inducements-cost")).toBeTruthy(),
    );
    expect(screen.getByTestId("budget-inducements-cost").textContent).toMatch(/125/);
  });

  it("n'affiche rien pour une équipe sans coup de pouce", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId("team-treasury-link")).toBeTruthy());
    expect(screen.queryByTestId("team-inducements")).toBeNull();
    expect(screen.queryByTestId("budget-inducements-cost")).toBeNull();
  });
});
