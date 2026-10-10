/**
 * Coups de pouce achetés À LA CRÉATION dans le builder : la section n'existe
 * que pour une coupe qui les vend à l'inscription (mode `build`) ou sous un
 * règlement de tournoi ; le catalogue vient du serveur et le total est
 * déduit du budget restant (la requête sans prix est testée dans
 * `build-inducements.test.ts`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

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
  min: 0,
  max: 16,
  ma: 6,
  st: 3,
  ag: 3,
  pa: 4,
  av: 9,
  skills: "",
  primaryAccess: "G",
  secondaryAccess: "A,S",
};

const HUMAN = {
  slug: "human",
  name: "Humains",
  tier: "II",
  budget: 1000,
  regionalLeagueOptions: [{ slug: "old_world_classic", name: "Classique" }],
};

const CATALOGUE = [
  { slug: "team_mascot", name: "Mascotte d'Équipe", cost: 25_000, maxQuantity: 1, description: "" },
  { slug: "bloodweiser_kegs", name: "Fûts de Blitz Premium", cost: 50_000, maxQuantity: 2, description: "" },
];

function cup(inducementMode: "build" | "match") {
  return {
    id: "cup-1",
    ruleset: "season_3",
    format: "bb11",
    tournamentRuleset: null,
    rulesConfig: {
      resurrectionMode: true,
      tierBudgets: {},
      rosterBudgetOverrides: {},
      tierStartingPsp: {},
      rosterStartingPspOverrides: {},
      inducementMode,
      allowedInducements: null,
    },
  };
}

function mockApis(mode: "build" | "match") {
  apiRequest.mockImplementation((path: unknown, init?: { method?: string }) => {
    const url = String(path);
    if (init?.method === "POST") return Promise.resolve({ team: { id: "t1" } });
    if (url.startsWith("/team/build-inducements")) {
      return Promise.resolve(
        mode === "build"
          ? { allowed: true, cupMode: "build", inducements: CATALOGUE }
          : { allowed: false, cupMode: "match", inducements: [] },
      );
    }
    if (url.includes("/cup/")) return Promise.resolve({ cup: cup(mode) });
    if (url.startsWith("/team/base-1")) {
      return Promise.resolve({
        team: {
          name: "Base",
          roster: "human",
          players: Array.from({ length: 11 }, () => ({ position: "lineman" })),
          starPlayers: [],
          inducements: [
            { slug: "team_mascot", name: "Mascotte d'Équipe", quantity: 1 },
            { slug: "weather_mage", name: "Mage Météo", quantity: 1 },
          ],
        },
      });
    }
    if (url.includes("/api/skills")) return Promise.resolve({ skills: [] });
    if (url.includes("/api/tournament-rulesets")) {
      return Promise.resolve({ rulesets: [] });
    }
    return Promise.resolve({
      roster: { positions: [LINEMAN], specialRules: [] },
      ruleset: "season_3",
    });
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      const payload = url.includes("builder-rosters")
        ? { rosters: [HUMAN] }
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

function renderAt(url: string) {
  window.history.replaceState({}, "", url);
  return render(
    <LanguageProvider>
      <NewTeamPage />
    </LanguageProvider>,
  );
}

function inducementCalls(): string[] {
  return apiRequest.mock.calls
    .map(([p]) => String(p))
    .filter((p) => p.startsWith("/team/build-inducements"));
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  localStorage.setItem("auth_token", "token");
});

describe("Builder — coups de pouce de création", () => {
  it("coupe en build : la section apparaît avec le catalogue servi", async () => {
    mockApis("build");
    renderAt("/me/teams/new?cupId=cup-1&ruleset=season_3&format=bb11&roster=human");

    expect(await screen.findByTestId("build-inducements")).toBeTruthy();
    expect(screen.getByTestId("build-inducement-team_mascot")).toBeTruthy();
    expect(inducementCalls().some((p) => p.includes("cupId=cup-1"))).toBe(true);
  });

  it("le total est déduit du budget restant et annoncé au bandeau", async () => {
    mockApis("build");
    renderAt("/me/teams/new?cupId=cup-1&ruleset=season_3&format=bb11&roster=human");
    await screen.findByTestId("build-inducement-team_mascot");

    const before = screen.getByTestId("remaining-budget").textContent ?? "";
    fireEvent.click(screen.getByTestId("build-inducement-team_mascot-plus"));

    await waitFor(() =>
      expect(screen.getByTestId("inducements-cost-summary").textContent).toMatch(
        /25/,
      ),
    );
    const after = screen.getByTestId("remaining-budget").textContent ?? "";
    expect(parseInt(before, 10) - parseInt(after, 10)).toBe(25);
  });

  it("coupe en match : aucune section", async () => {
    mockApis("match");
    renderAt("/me/teams/new?cupId=cup-1&ruleset=season_3&format=bb11&roster=human");

    await waitFor(() => expect(inducementCalls().length).toBeGreaterThan(0));
    expect(screen.queryByTestId("build-inducements")).toBeNull();
  });

  it("jeu libre : aucune section et aucun appel au catalogue", async () => {
    mockApis("build");
    renderAt("/me/teams/new?ruleset=season_3&format=bb11&roster=human");

    await screen.findByTestId("remaining-budget");
    expect(screen.queryByTestId("build-inducements")).toBeNull();
    expect(inducementCalls()).toEqual([]);
  });

  it("adapter à la coupe : reprend la Mascotte, signale le Mage Météo écarté", async () => {
    mockApis("build");
    renderAt(
      "/me/teams/new?cupId=cup-1&fromTeamId=base-1&ruleset=season_3&format=bb11&roster=human",
    );

    await waitFor(() =>
      expect(
        screen.getByTestId("build-inducement-team_mascot-qty").textContent,
      ).toBe("1"),
    );
    expect(
      screen.getByTestId("clone-discarded-inducements").textContent,
    ).toMatch(/Mage Météo ×1/);
  });
});
