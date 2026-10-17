/**
 * La carte joueur exportée depuis la fiche d'équipe affiche la carrière
 * TOUTES compétitions (`team.playerCareers`) : un joueur qui n'avait joué
 * que des coupes y affichait « 0 match, 0 TD, 0 sortie ».
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

const { served } = vi.hoisted(() => ({
  served: { playerCareers: undefined as unknown },
}));

const knight = {
  id: "p-1",
  name: "Sire Bohémond le Tueur de Bêtes",
  number: 1,
  position: "bretonnian_grail_knight",
  ma: 7,
  st: 3,
  ag: 3,
  pa: 4,
  av: 10,
  skills: "dauntless,block,sure-feet",
  spp: 0,
  matchesPlayed: 0,
  totalTouchdowns: 0,
  totalCasualties: 0,
  dead: false,
  firedAt: null,
};

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn(async () => ({
    team: {
      id: "team-1",
      name: "Paladins de la Dame",
      roster: "bretonnian",
      ruleset: "season_3",
      format: "bb11",
      players: [knight],
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
      playerCareers: served.playerCareers,
    },
    currentMatch: null,
    localMatchStats: null,
    matchStats: undefined,
  })),
  ApiClientError: class ApiClientError extends Error {},
}));

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
import { decodeCardPayload } from "../../../lib/player-card/card-model";
import TeamDetailPage from "./page";

const originalFetch = global.fetch;
let clicked: string[] = [];

function renderPage() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );
  render(<TeamDetailPage />, { wrapper });
}

/** Mini-stats « Carrière » de la carte ouverte au dernier clic. */
function lastCardCareer(): Record<string, string> {
  const href = clicked[clicked.length - 1];
  const payload = new URL(href, "http://localhost").searchParams.get("d");
  const card = decodeCardPayload(payload);
  return Object.fromEntries(
    (card?.infoStats ?? []).map((s) => [s.label, s.value]),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  clicked = [];
  served.playerCareers = undefined;
  window.history.pushState({}, "", "/me/teams/team-1");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "token", setItem: vi.fn(), removeItem: vi.fn() },
  });
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/auth/me")) {
      return {
        ok: true,
        json: async () => ({ user: { id: "u1", roles: ["user"] } }),
      };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function (this: HTMLAnchorElement) {
      clicked.push(this.getAttribute("href") ?? "");
    },
  );
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("fiche d'équipe — carte joueur", () => {
  it("affiche la carrière toutes compétitions servie par le serveur", async () => {
    served.playerCareers = {
      "p-1": {
        matchesPlayed: 4,
        touchdowns: 3,
        casualties: 2,
        completions: 0,
        interceptions: 0,
        mvpAwards: 1,
        spp: 0,
        cup: {
          matchesPlayed: 4,
          touchdowns: 3,
          casualties: 2,
          completions: 0,
          interceptions: 0,
          mvpAwards: 1,
        },
      },
    };
    renderPage();

    fireEvent.click(await screen.findByTestId("player-card-p-1"));

    expect(lastCardCareer()).toEqual({
      MATCHS: "4",
      TD: "3",
      SORTIES: "2",
      PSP: "0",
    });
  });

  it("retombe sur les compteurs du joueur face à une API antérieure", async () => {
    renderPage();

    fireEvent.click(await screen.findByTestId("player-card-p-1"));

    expect(lastCardCareer()).toEqual({
      MATCHS: "0",
      TD: "0",
      SORTIES: "0",
      PSP: "0",
    });
  });
});
