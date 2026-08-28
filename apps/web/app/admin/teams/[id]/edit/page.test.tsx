/**
 * Page d'édition admin d'une équipe.
 *
 * Ce qui compte : les trois blocs demandés sont présents, la composition
 * s'édite en brouillon puis part en UN `PUT /team/:id/roster` portant l'état
 * cible, et les joueurs morts / licenciés ne peuvent pas être retirés.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "team-1" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

// Les deux blocs réutilisés du coach sont testés chez eux ; ici on vérifie
// seulement qu'ils sont montés avec la bonne équipe.
vi.mock("../../../../me/teams/[id]/edit/TeamStarPlayersEditor", () => ({
  default: ({ teamId }: { teamId: string }) => (
    <div data-testid="star-players-editor">{teamId}</div>
  ),
}));
vi.mock("../../../../me/teams/components/TeamInfoEditor", () => ({
  default: ({ teamId }: { teamId: string }) => (
    <div data-testid="team-info-editor">{teamId}</div>
  ),
}));

import AdminTeamEditPage from "./page";

const originalFetch = global.fetch;

const TEAM = {
  id: "team-1",
  name: "Les Rats",
  roster: "skaven",
  ruleset: "season_3",
  format: "bb11",
  regionalLeague: null,
  initialBudget: 1000,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 1,
  deletedAt: null,
  players: [
    {
      id: "p1",
      position: "skaven_lineman",
      name: "Rat Un",
      number: 1,
      dead: false,
      firedAt: null,
    },
    {
      id: "p2",
      position: "skaven_lineman",
      name: "Rat Mort",
      number: 2,
      dead: true,
      firedAt: null,
    },
  ],
  starPlayers: [],
};

const POSITIONS = {
  availablePositions: [
    {
      key: "skaven_lineman",
      name: "Coureur des rues",
      cost: 50,
      currentCount: 2,
      maxCount: 16,
      canAdd: true,
    },
    {
      key: "skaven_blitzer",
      name: "Blitzeur",
      cost: 90,
      currentCount: 0,
      maxCount: 2,
      canAdd: true,
    },
  ],
  currentPlayerCount: 2,
  maxPlayers: 16,
  frozen: false,
};

/** Route le `fetch` global selon le chemin appelé. */
function mockApi(overrides: { team?: unknown; rosterPutOk?: boolean } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: any) => {
    const url = String(input);
    if (url.includes("/available-positions")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: POSITIONS }),
      } as unknown as Response;
    }
    if (url.includes("/roster") && init?.method === "PUT") {
      const ok = overrides.rosterPutOk !== false;
      return {
        ok,
        status: ok ? 200 : 403,
        json: async () =>
          ok
            ? { success: true, data: { team: overrides.team ?? TEAM } }
            : { error: "Equipe engagee" },
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { team: overrides.team ?? TEAM },
      }),
    } as unknown as Response;
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => "dummy-token",
      setItem: vi.fn(),
      removeItem: vi.fn(),
    },
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("AdminTeamEditPage — les trois blocs", () => {
  it("monte positions, Star Players et coups de pouce", async () => {
    mockApi();
    render(<AdminTeamEditPage />);

    await screen.findByTestId("admin-team-edit");
    expect(screen.getByTestId("admin-positions-editor")).toBeTruthy();
    expect(screen.getByTestId("star-players-editor").textContent).toBe(
      "team-1",
    );
    expect(screen.getByTestId("team-info-editor").textContent).toBe("team-1");
  });

  it("prévient que les verrous « équipe engagée » ne s'appliquent pas", async () => {
    mockApi();
    render(<AdminTeamEditPage />);

    const warning = await screen.findByTestId("admin-team-edit-warning");
    expect(warning.textContent).toContain("autre coach");
  });

  it("affiche l'erreur de chargement plutôt qu'une page vide", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({ error: "Introuvable" }),
    })) as unknown as typeof fetch;

    render(<AdminTeamEditPage />);

    expect(
      (await screen.findByTestId("admin-team-edit-error")).textContent,
    ).toContain("Introuvable");
  });
});

describe("AdminTeamEditPage — liste des positions", () => {
  it("n'active « Enregistrer » qu'après une modification", async () => {
    mockApi();
    render(<AdminTeamEditPage />);

    const save = (await screen.findByTestId(
      "admin-roster-save",
    )) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.click(screen.getByTestId("admin-position-add-skaven_blitzer"));

    expect(screen.getByTestId("admin-roster-dirty")).toBeTruthy();
    expect((screen.getByTestId("admin-roster-save") as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("verrouille le joueur mort : ni retrait, ni édition", async () => {
    mockApi();
    render(<AdminTeamEditPage />);

    await screen.findByTestId("admin-player-row-p2");
    expect(screen.queryByTestId("admin-player-remove-p2")).toBeNull();
    expect(screen.getByTestId("admin-player-remove-p1")).toBeTruthy();
  });

  it("PUT l'état cible complet, ajout compris", async () => {
    const fetchMock = mockApi();
    render(<AdminTeamEditPage />);

    await screen.findByTestId("admin-roster-save");
    fireEvent.click(screen.getByTestId("admin-position-add-skaven_blitzer"));
    fireEvent.click(screen.getByTestId("admin-roster-save"));

    await waitFor(() => {
      const calls = fetchMock.mock.calls as unknown as Array<[any, any]>;
      const put = calls.find(
        ([url, init]) =>
          String(url).includes("/team/team-1/roster") && init?.method === "PUT",
      );
      expect(put).toBeTruthy();
      const body = JSON.parse(String(put![1].body));
      // Les deux joueurs connus (avec id) + le nouveau (sans id).
      expect(body.players).toHaveLength(3);
      expect(body.players.filter((p: any) => p.id)).toHaveLength(2);
      const added = body.players.find((p: any) => !p.id);
      expect(added.position).toBe("skaven_blitzer");
      expect(added.number).toBe(3);
    });
  });

  it("retire un joueur du payload quand on le supprime", async () => {
    const fetchMock = mockApi();
    render(<AdminTeamEditPage />);

    fireEvent.click(await screen.findByTestId("admin-player-remove-p1"));
    fireEvent.click(screen.getByTestId("admin-roster-save"));

    await waitFor(() => {
      const calls = fetchMock.mock.calls as unknown as Array<[any, any]>;
      const put = calls.find(
        ([url, init]) =>
          String(url).includes("/team/team-1/roster") && init?.method === "PUT",
      );
      const body = JSON.parse(String(put![1].body));
      expect(body.players.map((p: any) => p.id)).toEqual(["p2"]);
    });
  });

  it("remonte l'erreur serveur d'un enregistrement refusé", async () => {
    mockApi({ rosterPutOk: false });
    render(<AdminTeamEditPage />);

    await screen.findByTestId("admin-roster-save");
    fireEvent.click(screen.getByTestId("admin-position-add-skaven_blitzer"));
    fireEvent.click(screen.getByTestId("admin-roster-save"));

    expect(
      (await screen.findByTestId("admin-team-edit-alert")).textContent,
    ).toContain("Equipe engagee");
  });

  it("signale une équipe supprimée dans l'encart d'avertissement", async () => {
    mockApi({ team: { ...TEAM, deletedAt: "2026-08-27T10:00:00.000Z" } });
    render(<AdminTeamEditPage />);

    const warning = await screen.findByTestId("admin-team-edit-warning");
    expect(warning.textContent).toContain("actuellement supprimée");
  });
});
