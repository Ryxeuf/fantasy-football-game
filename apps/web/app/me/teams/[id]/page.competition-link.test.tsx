/**
 * La fiche d'équipe renvoie à la compétition dans laquelle l'équipe est
 * engagée (coupe ou saison de ligue active), quand il y en a une.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { me, competition } = vi.hoisted(() => ({
  me: { current: null as unknown },
  competition: { current: null as unknown },
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
      competition: competition.current,
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
  me.current = { id: "u1", email: "coach@test", roles: ["user"] };
  competition.current = null;
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

describe("fiche d'équipe — lien vers la compétition engagée", () => {
  it("renvoie à la coupe dans laquelle l'équipe est engagée", async () => {
    competition.current = {
      kind: "cup",
      name: "Coupe d'hiver",
      competitionId: "cup-9",
    };
    renderPage();

    const link = await screen.findByTestId("team-competition-link");
    expect(link.getAttribute("href")).toBe("/cups/cup-9");
    expect(link.textContent).toContain("Coupe d'hiver");
  });

  it("renvoie à la ligue dans laquelle l'équipe est engagée", async () => {
    competition.current = {
      kind: "league",
      name: "Ligue du Vieux Monde — Saison 2",
      competitionId: "league-7",
      seasonId: "season-2",
    };
    renderPage();

    const link = await screen.findByTestId("team-competition-link");
    expect(link.getAttribute("href")).toBe("/leagues/league-7");
    expect(link.textContent).toContain("Ligue du Vieux Monde — Saison 2");
  });

  it("n'affiche aucun lien quand l'équipe n'est engagée nulle part", async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("team-treasury-link")).toBeTruthy(),
    );
    expect(screen.queryByTestId("team-competition-link")).toBeNull();
  });
});
