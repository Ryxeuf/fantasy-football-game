/**
 * Tests de la fiche admin d'équipe (`/admin/teams/[id]`).
 *
 * Ce qui compte ici : la page rend les MÊMES informations que la fiche coach
 * (position en nom lisible, compétences résolues, Star Players nommés) et
 * offre les trois affordances admin — retour arrière, navigation entre les
 * équipes du coach, journal.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const back = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "team-1" }),
  useRouter: () => ({ back, push: vi.fn() }),
}));

import AdminTeamDetailPage from "./page";
import { LanguageProvider } from "../../../contexts/LanguageContext";

/** La page consomme `useLanguage` (SkillTooltip, badges) : provider requis. */
function renderPage() {
  return render(
    <LanguageProvider>
      <AdminTeamDetailPage />
    </LanguageProvider>,
  );
}

const originalFetch = global.fetch;

const TEAM = {
  id: "team-1",
  name: "Les Gones Kass'Krânes",
  roster: "black_orc",
  ruleset: "season_3",
  initialBudget: 1000,
  treasury: 505000,
  currentValue: 1000000,
  teamValue: 1000000,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: false,
  dedicatedFans: 1,
  createdAt: "2026-08-26T23:36:50.000Z",
  deletedAt: null,
  owner: {
    id: "user-1",
    email: "davouille@example.com",
    name: "Davouille",
    coachName: "Davouille",
  },
  players: [
    {
      id: "p2",
      name: "Juninhorc",
      position: "black_orc_orque_noir",
      number: 2,
      ma: 4,
      st: 4,
      ag: 4,
      pa: 5,
      av: 10,
      skills: "brawler,grab",
      spp: 6,
      matchesPlayed: 3,
      dead: false,
      firedAt: null,
    },
    {
      id: "p1",
      name: "Sonny Andertroll",
      position: "black_orc_troll_entraine",
      number: 1,
      ma: 4,
      st: 5,
      ag: 5,
      pa: 5,
      av: 10,
      skills: "mighty_blow-1,really_stupid",
      spp: 0,
      matchesPlayed: 0,
      dead: true,
      firedAt: null,
    },
  ],
  starPlayers: [
    {
      id: "sp1",
      slug: "griff_oberwald",
      cost: 280000,
      displayName: "Griff Oberwald",
      ma: 7,
      st: 4,
      ag: 2,
      pa: 3,
      av: 10,
      skills: "block,dodge",
    },
  ],
};

const OWNER_TEAMS = [
  {
    id: "team-0",
    name: "The Toe Eaters",
    roster: "human",
    ruleset: "season_3",
    teamValue: 900000,
    currentValue: 900000,
    createdAt: "2026-08-27T10:00:00.000Z",
    deletedAt: null,
    playerCount: 11,
  },
  {
    id: "team-1",
    name: "Les Gones Kass'Krânes",
    roster: "black_orc",
    ruleset: "season_3",
    teamValue: 1000000,
    currentValue: 1000000,
    createdAt: "2026-08-26T23:36:50.000Z",
    deletedAt: null,
    playerCount: 12,
  },
  {
    id: "team-2",
    name: "NOr VP",
    roster: "norse",
    ruleset: "season_3",
    teamValue: 990000,
    currentValue: 990000,
    createdAt: "2026-08-25T10:00:00.000Z",
    deletedAt: null,
    playerCount: 11,
  },
];

const JOURNAL_ENTRIES = [
  {
    id: "j1",
    createdAt: "2026-08-26T23:40:00.000Z",
    summary: "Sauvegarde du roster",
    actorLabel: "Davouille",
    actorRole: "owner",
    treasuryDelta: -50000,
    teamValueDelta: 50000,
  },
];

/** Route le `fetch` global selon le chemin appelé (admin / roster / journal). */
function mockApi(options: {
  team?: unknown;
  ownerTeams?: unknown;
  adminStatus?: number;
  journal?: unknown;
} = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/admin/teams/")) {
      const status = options.adminStatus ?? 200;
      return {
        ok: status < 400,
        status,
        json: async () =>
          status < 400
            ? {
                team: options.team ?? TEAM,
                ownerTeams: options.ownerTeams ?? OWNER_TEAMS,
              }
            : { error: "Équipe non trouvée" },
      } as unknown as Response;
    }
    if (url.includes("/api/rosters/")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          roster: {
            name: "Orques Noirs",
            positions: [
              {
                slug: "black_orc_orque_noir",
                skills: "brawler,grab",
                primarySkills: "G,S",
                secondarySkills: "A",
                keywords: "Orque",
              },
            ],
          },
        }),
      } as unknown as Response;
    }
    if (url.includes("/journal")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { entries: options.journal ?? JOURNAL_ENTRIES },
        }),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
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

describe("AdminTeamDetailPage", () => {
  it("affiche les positions en nom lisible plutôt qu'en slug", async () => {
    mockApi();
    renderPage();

    const position = await screen.findByTestId("admin-team-position-p2");
    expect(position.textContent).not.toBe("black_orc_orque_noir");
    expect(position.textContent).toBeTruthy();
  });

  it("rend les compétences résolues (pas la chaîne CSV brute)", async () => {
    mockApi();
    renderPage();

    await screen.findByTestId("admin-team-detail");
    // La CSV brute ne doit apparaître nulle part telle quelle.
    expect(screen.queryByText("brawler,grab")).toBeNull();
  });

  it("trie les joueurs par numéro et marque les joueurs sortis", async () => {
    mockApi();
    renderPage();

    await screen.findByTestId("admin-team-detail");
    const rows = screen.getAllByTestId(/^admin-team-player-p/);
    expect(rows[0].getAttribute("data-testid")).toBe("admin-team-player-p1");
    expect(screen.getByTestId("admin-team-player-status-p1").textContent).toBe(
      "Mort",
    );
  });

  it("affiche les Star Players avec leur nom", async () => {
    mockApi();
    renderPage();

    expect(await screen.findByText("Griff Oberwald")).toBeTruthy();
  });

  it("permet de revenir à la page précédente", async () => {
    mockApi();
    renderPage();

    const button = await screen.findByTestId("admin-team-back");
    fireEvent.click(button);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("navigue vers les autres équipes du même coach", async () => {
    mockApi();
    renderPage();

    await screen.findByTestId("admin-team-owner-nav");
    expect(screen.getByTestId("admin-team-prev").getAttribute("href")).toBe(
      "/admin/teams/team-0",
    );
    expect(screen.getByTestId("admin-team-next").getAttribute("href")).toBe(
      "/admin/teams/team-2",
    );
    expect(
      screen.getByTestId("admin-team-sibling-team-2").getAttribute("href"),
    ).toBe("/admin/teams/team-2");
  });

  it("expose le journal : aperçu + lien vers le journal complet", async () => {
    mockApi();
    renderPage();

    await screen.findByTestId("admin-team-detail");
    expect(
      screen.getByTestId("admin-team-journal-link").getAttribute("href"),
    ).toBe("/me/teams/team-1/journal");
    await waitFor(() =>
      expect(screen.getByText("Sauvegarde du roster")).toBeTruthy(),
    );
  });

  it("dégrade sans casser quand le journal est indisponible", async () => {
    mockApi({ journal: [] });
    renderPage();

    await screen.findByTestId("admin-team-journal-preview");
    await waitFor(() =>
      expect(
        screen.getByText("Aucune écriture au journal pour cette équipe."),
      ).toBeTruthy(),
    );
  });

  it("affiche une erreur exploitable quand l'équipe est introuvable", async () => {
    mockApi({ adminStatus: 404 });
    renderPage();

    const error = await screen.findByTestId("admin-team-error");
    expect(error.textContent).toContain("Équipe non trouvée");
    expect(screen.getByTestId("admin-team-back")).toBeTruthy();
  });
});


describe("AdminTeamDetailPage — restauration", () => {
  it("n'affiche aucun bouton Restaurer sur une équipe active", async () => {
    mockApi();
    renderPage();

    await screen.findByTestId("admin-team-detail");
    expect(screen.queryByTestId("admin-team-restore")).toBeNull();
  });

  it("propose la restauration quand l'équipe est supprimée", async () => {
    mockApi({ team: { ...TEAM, deletedAt: "2026-08-27T10:00:00.000Z" } });
    renderPage();

    await screen.findByTestId("admin-team-deleted-badge");
    expect(screen.getByTestId("admin-team-restore")).toBeTruthy();
  });

  it("POSTe /restore puis recharge la fiche", async () => {
    const fetchMock = mockApi({
      team: { ...TEAM, deletedAt: "2026-08-27T10:00:00.000Z" },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderPage();

    fireEvent.click(await screen.findByTestId("admin-team-restore"));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, init]: [any, any]) =>
            String(url).includes("/admin/teams/team-1/restore") &&
            init?.method === "POST",
        ),
      ).toBe(true);
    });
  });
});
