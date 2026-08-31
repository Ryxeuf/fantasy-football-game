/**
 * Le bouton « Journal » de la fiche d'équipe est réservé aux admins.
 *
 * Le journal est un outil d'investigation (qui a changé quoi, et quel a été
 * le résultat) : il n'a pas sa place dans l'interface d'un coach. C'est un
 * filtre d'AFFICHAGE — l'autorisation de `GET /team/:id/journal` reste
 * celle du serveur.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { me } = vi.hoisted(() => ({ me: { current: null as unknown } }));

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
vi.mock("../../../hooks/useFeatureFlag", () => ({
  useFeatureFlag: () => false,
}));
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

describe("fiche d'équipe — bouton Journal", () => {
  it("est masqué pour un coach non admin", async () => {
    renderPage();

    await waitFor(() => expect(screen.getByTestId("team-treasury-link")).toBeTruthy());
    expect(screen.queryByTestId("team-journal-link")).toBeNull();
  });

  it("reste visible pour un admin", async () => {
    me.current = { id: "u1", email: "admin@test", roles: ["user", "admin"] };
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId("team-journal-link")).toBeTruthy(),
    );
  });

  it("reste masqué quand le rôle est inconnu de la réponse", async () => {
    me.current = { id: "u1", email: "coach@test" };
    renderPage();

    await waitFor(() => expect(screen.getByTestId("team-treasury-link")).toBeTruthy());
    expect(screen.queryByTestId("team-journal-link")).toBeNull();
  });
});
