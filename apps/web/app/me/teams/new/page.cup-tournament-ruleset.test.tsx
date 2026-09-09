/**
 * Construction d'une équipe DEPUIS une coupe qui impose un règlement de
 * tournoi (`/me/teams/new?cupId=…`).
 *
 * Bug corrigé : les deux effets qui appliquent le budget et le pool de PSP du
 * pack étaient gardés par `if (… || cupId) return`. Une coupe à règlement
 * repartait donc sur le budget natif du roster et sur un pool de **0 PSP** —
 * aucune compétence achetable, alors que la même équipe construite hors
 * compétition en proposait. Le serveur, lui, fait primer le pack sur la coupe
 * (`routes/team-build-handler.ts`) : les deux divergeaient.
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

import { NAF_WORLD_CUP_2027, getTournamentRosterRules } from "@bb/game-engine";
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
  primaryAccess: "G",
  secondaryAccess: "A,S",
};

/** Snotlings : tier IV, budget natif volontairement ≠ du budget du pack. */
const SNOTLING = {
  slug: "snotling",
  name: "Snotlings",
  tier: "IV",
  budget: 1000,
  regionalLeagueOptions: [
    { slug: "underworld_challenge", name: "Défi des Bas-fonds" },
  ],
};

const PACK_RULES = getTournamentRosterRules(NAF_WORLD_CUP_2027, "snotling")!;

/**
 * Coupe qui impose le règlement mais N'A AUCUNE config de budget par tier —
 * exactement le cas qui remettait le pool à zéro.
 */
const CUP = {
  id: "cup-1",
  ruleset: "season_3",
  format: "bb11",
  tournamentRuleset: NAF_WORLD_CUP_2027.slug,
  rulesConfig: {
    resurrectionMode: false,
    tierBudgets: {},
    rosterBudgetOverrides: {},
    tierStartingPsp: {},
    rosterStartingPspOverrides: {},
  },
};

function mockApis() {
  apiRequest.mockImplementation((path: unknown) => {
    const url = String(path);
    if (url.includes("/cup/")) return Promise.resolve({ cup: CUP });
    if (url.includes("/api/skills")) return Promise.resolve({ skills: [] });
    if (url.includes("/api/tournament-rulesets")) {
      return Promise.resolve({
        rulesets: [
          {
            slug: NAF_WORLD_CUP_2027.slug,
            enabled: true,
            definition: {
              ...NAF_WORLD_CUP_2027,
              starPlayerSppTax: NAF_WORLD_CUP_2027.starPlayerSppTax.map((b) => ({
                maxTotalCostK: Number.isFinite(b.maxTotalCostK)
                  ? b.maxTotalCostK
                  : null,
                spp: b.spp,
              })),
            },
          },
        ],
      });
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

/** Arrive depuis « Construire une équipe pour cette coupe » (sans le pack). */
function renderFromCup() {
  mockApis();
  window.history.replaceState(
    {},
    "",
    "/me/teams/new?cupId=cup-1&ruleset=season_3&format=bb11&roster=snotling",
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

describe("Builder — coupe imposant un règlement de tournoi", () => {
  it("sélectionne le règlement de la coupe", async () => {
    renderFromCup();
    const select = (await screen.findByTestId(
      "tournament-ruleset-select",
    )) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe(NAF_WORLD_CUP_2027.slug));
  });

  it("LE BUG : donne le pool de PSP du règlement, pas zéro", async () => {
    renderFromCup();
    const pool = await screen.findByTestId("builder-psp-pool-locked");
    await waitFor(() =>
      expect(pool.textContent).toContain(String(PACK_RULES.sppBudget)),
    );
    expect(PACK_RULES.sppBudget).toBeGreaterThan(0);
  });

  it("laisse acheter des compétences (l'allocateur a du PSP à dépenser)", async () => {
    renderFromCup();
    const remaining = await screen.findByTestId("allocator-remaining");
    await waitFor(() =>
      expect(remaining.textContent).toBe(String(PACK_RULES.sppBudget)),
    );
  });

  it("impose le budget d'or du règlement, pas celui du roster", async () => {
    renderFromCup();
    const budget = await screen.findByTestId("cup-locked-budget");
    await waitFor(() =>
      expect(budget.textContent).toContain(String(PACK_RULES.goldBudget)),
    );
    expect(budget.textContent).not.toContain(String(SNOTLING.budget));
  });
});
