/**
 * Le filtre « Équipe » de la page Star Players proposait cinq slugs codés en
 * dur et ignorait la saison choisie. Il doit désormais lister TOUTES les
 * équipes de l'édition sélectionnée, servies par `/api/rosters`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { getRosterSlugsForRuleset } from "@bb/game-engine";

import StarPlayersClient from "./StarPlayersClient";
import { LanguageProvider } from "../contexts/LanguageContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const GRIFF = {
  slug: "griff_oberwald",
  displayName: "Griff Oberwald",
  cost: 280000,
  ma: 7,
  st: 4,
  ag: 2,
  pa: 3,
  av: 9,
  skills: "block",
  keywords: null,
  hirableBy: ["old_world_classic"],
};

const MORG = {
  ...GRIFF,
  slug: "morg_n_thorg",
  displayName: "Morg 'n' Thorg",
  hirableBy: ["all"],
};

const HAKFLEM = {
  ...GRIFF,
  slug: "hakflem_skuttlespike",
  displayName: "Hakflem Skuttlespike",
  hirableBy: ["underworld_challenge"],
};

/**
 * Réponse `/api/rosters` (source de vérité du filtre). Les Bretonniens
 * n'existent qu'en saison 3 : le parc d'équipes dépend bien de l'édition.
 */
function apiRosters(ruleset: string) {
  const rosters = [
    { slug: "human", name: "Humains" },
    { slug: "skaven", name: "Skavens" },
  ];
  return {
    rosters:
      ruleset === "season_3"
        ? [...rosters, { slug: "bretonnian", name: "Bretonniens" }]
        : rosters,
  };
}

function stubFetch(rostersOk = true) {
  const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/rosters")) {
      const ruleset = url.includes("season_2") ? "season_2" : "season_3";
      return rostersOk
        ? Promise.resolve({
            ok: true,
            json: () => Promise.resolve(apiRosters(ruleset)),
          } as Response)
        : Promise.reject(new Error("API down"));
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ success: true, data: [GRIFF, MORG, HAKFLEM] }),
    } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  return render(
    <LanguageProvider>
      <StarPlayersClient />
    </LanguageProvider>,
  );
}

async function getTeamFilter(): Promise<HTMLSelectElement> {
  return (await screen.findByTestId(
    "star-player-team-filter",
  )) as HTMLSelectElement;
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});

describe("filtre Équipe des Star Players", () => {
  it("liste les équipes servies par /api/rosters pour la saison courante", async () => {
    const fetchMock = stubFetch();
    renderPage();

    const select = await getTeamFilter();
    await waitFor(() =>
      expect(within(select).getAllByRole("option").length).toBe(4),
    );
    // Sentinelle + les 3 équipes de l'API, triées par nom localisé.
    expect(
      within(select)
        .getAllByRole("option")
        .map((o) => o.getAttribute("value")),
    ).toEqual(["all", "bretonnian", "human", "skaven"]);

    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/api/rosters?lang=fr&ruleset=season_3"),
      ),
    ).toBe(true);
  });

  it("recharge la liste quand la saison change", async () => {
    const fetchMock = stubFetch();
    renderPage();
    await getTeamFilter();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("/api/rosters?lang=fr&ruleset=season_3"),
        ),
      ).toBe(true),
    );

    const rulesetSelect = screen.getByDisplayValue("Saison 3");
    fireEvent.change(rulesetSelect, { target: { value: "season_2" } });

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("/api/rosters?lang=fr&ruleset=season_2"),
        ),
      ).toBe(true),
    );
  });

  it("retombe sur le catalogue complet de l'édition si l'API échoue", async () => {
    stubFetch(false);
    renderPage();

    const select = await getTeamFilter();
    await waitFor(() =>
      expect(within(select).getAllByRole("option").length).toBeGreaterThan(20),
    );
    const values = within(select)
      .getAllByRole("option")
      .map((o) => o.getAttribute("value"));
    expect(values[0]).toBe("all");
    expect(values.slice(1).sort()).toEqual(getRosterSlugsForRuleset("season_3"));
  });

  it("filtre les Star Players sur l'équipe choisie (Ligues + mercenaires universels)", async () => {
    stubFetch();
    renderPage();

    const select = await getTeamFilter();
    expect(await screen.findByText("Griff Oberwald")).toBeTruthy();
    expect(screen.getByText("Hakflem Skuttlespike")).toBeTruthy();

    fireEvent.change(select, { target: { value: "human" } });

    await waitFor(() =>
      expect(screen.queryByText("Hakflem Skuttlespike")).toBeNull(),
    );
    // Humains = Classique du Vieux Monde ⇒ Griff, plus le mercenaire universel.
    expect(screen.getByText("Griff Oberwald")).toBeTruthy();
    expect(screen.getByText("Morg 'n' Thorg")).toBeTruthy();
  });

  it("réinitialise le filtre si l'équipe choisie n'existe pas dans la nouvelle saison", async () => {
    stubFetch();
    renderPage();

    const select = await getTeamFilter();
    await waitFor(() =>
      expect(within(select).getAllByRole("option").length).toBe(4),
    );
    // Les Bretonniens n'existent qu'en saison 3.
    fireEvent.change(select, { target: { value: "bretonnian" } });
    expect(select.value).toBe("bretonnian");

    fireEvent.change(screen.getByDisplayValue("Saison 3"), {
      target: { value: "season_2" },
    });

    // Le passage de saison remonte un écran de chargement : le `<select>` est
    // remonté, on le re-cible après coup.
    await waitFor(async () => {
      const refreshed = await getTeamFilter();
      expect(
        within(refreshed)
          .getAllByRole("option")
          .map((o) => o.getAttribute("value")),
      ).not.toContain("bretonnian");
      expect(refreshed.value).toBe("all");
    });
  });
});
