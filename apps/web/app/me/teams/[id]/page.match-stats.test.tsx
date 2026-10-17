/**
 * Le bloc « Statistiques de l'équipe » compte les rencontres de LIGUE
 * (`matchStats`), et pas seulement les `LocalMatch` : une équipe qui avait
 * joué une saison entière y affichait 0 match.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { me, stats } = vi.hoisted(() => ({
  me: { current: null as unknown },
  stats: {
    matchStats: undefined as unknown,
    localMatchStats: null as unknown,
  },
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
      competition: null,
    },
    currentMatch: null,
    localMatchStats: stats.localMatchStats,
    matchStats: stats.matchStats,
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
  me.current = { id: "u1", email: "coach@test", roles: ["user"] };
  stats.matchStats = undefined;
  stats.localMatchStats = null;
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

describe("fiche d'équipe — statistiques de matchs", () => {
  it("affiche les matchs de ligue avec le détail par compétition", async () => {
    stats.localMatchStats = { total: 0, completed: 0, wins: 0 };
    stats.matchStats = {
      played: 6,
      wins: 3,
      draws: 1,
      losses: 2,
      touchdownsFor: 9,
      touchdownsAgainst: 5,
      touchdownDiff: 4,
      bySource: {
        league: { played: 5 },
        cup: { played: 1 },
        friendly: { played: 0 },
      },
    };
    renderPage();

    const played = await screen.findByTestId("team-stats-played");
    expect(played.textContent).toBe("6");
    expect(screen.getByTestId("team-stats-record").textContent).toBe(
      "3 / 1 / 2",
    );
    expect(screen.getByTestId("team-stats-touchdowns").textContent).toContain(
      "(+4)",
    );
    // Les compétitions sans match ne s'affichent pas.
    expect(screen.getByTestId("team-stats-breakdown").textContent).toBe(
      "Ligue 5 · Coupe 1",
    );
  });

  it("retombe sur localMatchStats face à une API antérieure", async () => {
    stats.localMatchStats = {
      total: 4,
      completed: 2,
      wins: 1,
      draws: 0,
      losses: 1,
      touchdownsFor: 3,
      touchdownsAgainst: 3,
    };
    renderPage();

    const played = await screen.findByTestId("team-stats-played");
    expect(played.textContent).toBe("2");
    expect(screen.queryByTestId("team-stats-breakdown")).toBeNull();
  });

  it("n'affiche pas le bloc sans statistique servie", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("team-treasury-link")).toBeTruthy(),
    );
    expect(screen.queryByTestId("team-stats")).toBeNull();
  });
});
