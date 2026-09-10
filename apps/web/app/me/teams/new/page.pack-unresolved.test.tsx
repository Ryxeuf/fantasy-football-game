/**
 * Règlement de tournoi IMPOSÉ par la coupe, mais introuvable côté client :
 * il a été désactivé en admin (la liste publique ne sert que les règlements
 * proposables) ou l'appel a échoué (`fetchTournamentRulesets` rend `[]`).
 *
 * Le builder retombait alors en SILENCE sur le budget natif du roster
 * (1 000 kpo) et un pool de 0 PSP — donc aucune compétence achetable — et le
 * serveur refusait ensuite l'équipe. C'est le symptôme rapporté sur une
 * coupe World Cup.
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

const SNOTLING = {
  slug: "snotling",
  name: "Snotlings",
  tier: "IV",
  budget: 1000,
  regionalLeagueOptions: [
    { slug: "underworld_challenge", name: "Défi des Bas-fonds" },
  ],
};

const CUP = {
  id: "cup-1",
  ruleset: "season_3",
  format: "bb11",
  tournamentRuleset: "naf_world_cup_2027",
  rulesConfig: {
    resurrectionMode: true,
    tierBudgets: {},
    rosterBudgetOverrides: {},
    tierStartingPsp: {},
    rosterStartingPspOverrides: {},
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  apiRequest.mockImplementation((path: unknown) => {
    const url = String(path);
    if (url.includes("/cup/")) return Promise.resolve({ cup: CUP });
    if (url.includes("/api/skills")) return Promise.resolve({ skills: [] });
    // La liste des règlements répond, mais SANS celui que la coupe impose.
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
  window.history.replaceState(
    {},
    "",
    "/me/teams/new?cupId=cup-1&ruleset=season_3&format=bb11&roster=snotling",
  );
});

describe("règlement imposé introuvable", () => {
  it("le dit au coach au lieu de retomber en silence sur le budget du roster", async () => {
    render(
      <LanguageProvider>
        <NewTeamPage />
      </LanguageProvider>,
    );
    const notice = await waitFor(() => screen.getByTestId("pack-unresolved"));
    expect(notice.textContent).toContain("naf_world_cup_2027");
    expect(notice.textContent).toContain("introuvable");
  });

  it("bloque la création : l'équipe obtenue serait refusée à l'inscription", async () => {
    render(
      <LanguageProvider>
        <NewTeamPage />
      </LanguageProvider>,
    );
    await waitFor(() => screen.getByTestId("pack-unresolved"));
    const submit = screen.queryByTestId("create-team-submit") as
      | HTMLButtonElement
      | null;
    if (submit) expect(submit.disabled).toBe(true);
  });
});
