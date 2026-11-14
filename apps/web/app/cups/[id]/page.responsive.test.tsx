/**
 * Page d'une coupe sur mobile (retour coach, 2026-11-14) : les badges de
 * l'en-tête écrasaient le titre et sortaient de l'écran, le statut d'un
 * match débordait de sa carte, les noms du bracket et les valeurs des
 * podiums se cassaient mot par mot. jsdom ne calcule pas de mise en page :
 * on verrouille donc la STRUCTURE responsive (classes qui permettent le
 * retour à la ligne) plutôt que des dimensions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "C1" }),
}));
vi.mock("../../lib/api-client", () => ({
  // Équipes du lecteur, et une coupe sans pronostics.
  apiRequest: vi.fn(async (path: string) =>
    path.includes("/predictions")
      ? {
          scope: "off",
          scopeConfigured: true,
          rounds: [],
          coach: [],
          stands: [],
          viewer: {
            userId: null,
            isCommissioner: false,
            isMember: false,
            group: null,
          },
        }
      : { teams: [] },
  ),
  ApiClientError: class extends Error {},
}));
vi.mock("../../lib/tournament-rulesets", () => ({
  useTournamentRulesetDefinition: () => null,
}));
// Panneaux autonomes (lectures propres) : hors sujet ici.
vi.mock("../../components/CompetitionDocuments", () => ({
  default: () => null,
}));
vi.mock("../../components/CompetitionLifecyclePanel", () => ({
  default: () => null,
}));
vi.mock("./CupPdfExports", () => ({ default: () => null }));
vi.mock("./CupPlayoffBracketView", () => ({ default: () => null }));
vi.mock("./CupPoolsManagerPanel", () => ({ default: () => null }));
vi.mock("./CupInvitationsManager", () => ({ default: () => null }));

import CupDetailPage from "./page";

const team = (id: string, name: string) => ({
  id,
  name,
  roster: "orc",
  ruleset: "season_3",
  owner: { id: `o-${id}`, coachName: `Coach ${id}` },
});

const CUP = {
  isPublic: false,
  tournamentRuleset: "naf-world-cup-2027",
  id: "C1",
  name: "Coupe du Chaos",
  ruleset: "season_3",
  creator: { id: "o-a", coachName: "Coach a" },
  creatorId: "o-a",
  validated: true,
  status: "en_cours",
  participantCount: 2,
  participants: [team("a", "Orcs"), team("b", "Rats")],
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  rounds: [],
  standings: [],
  actionAwards: {
    topScorers: [{ teamId: "a", teamName: "Orcs", roster: "orc", value: 3 }],
  },
  playerLeaderboardCategories: [
    { key: "topScorers", label: "Meilleur marqueur", description: "TD" },
  ],
  playerLeaderboards: {
    topScorers: [
      {
        rank: 1,
        playerId: "pl1",
        playerName: "Grishnak",
        teamId: "b",
        teamName: "Rats",
        teamRoster: "skaven",
        value: 2,
      },
    ],
  },
  matches: [
    {
      id: "m1",
      name: null,
      status: "completed",
      isPublic: true,
      teamA: team("a", "Orcs"),
      teamB: team("b", "Rats"),
      scoreTeamA: 2,
      scoreTeamB: 1,
      createdAt: "2026-10-02T10:00:00.000Z",
    },
  ],
};

function classesOf(el: Element | null): string[] {
  return (el?.getAttribute("class") ?? "").split(/\s+/);
}

describe("page coupe — affichage mobile", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.endsWith("/auth/me")
            ? { user: { id: "viewer", roles: [] } }
            : { cup: CUP },
      })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function renderPage() {
    render(
      <LanguageProvider>
        <CupDetailPage />
      </LanguageProvider>,
    );
    return screen.findByTestId("cup-header-badges");
  }

  it("pose les badges sous le titre, sur une rangée qui passe à la ligne", async () => {
    const badges = await renderPage();
    expect(classesOf(badges)).toContain("flex-wrap");
    const title = screen.getByRole("heading", { level: 1 });
    expect(badges.contains(title)).toBe(false);
    expect(classesOf(title)).toContain("break-words");
    // Un badge ne se casse pas en colonne (« NAF / World / Cup / 2027 »).
    const ruleset = screen.getByTestId("cup-tournament-ruleset-badge");
    expect(badges.contains(ruleset)).toBe(true);
    expect(classesOf(ruleset)).toContain("whitespace-nowrap");
    for (const badge of Array.from(badges.children)) {
      expect(classesOf(badge)).toContain("whitespace-nowrap");
    }
    expect(badges.textContent).toContain("Privée");
  });

  it("empile le statut d'un match sous les équipes sur mobile", async () => {
    await renderPage();
    const row = screen.getByTestId("cup-match-row-m1");
    expect(classesOf(row)).toEqual(
      expect.arrayContaining(["flex-col", "sm:flex-row"]),
    );
    const teams = row.firstElementChild?.firstElementChild ?? null;
    expect(classesOf(teams)).toContain("flex-wrap");
    expect(row.textContent).toContain("Terminée");
    expect(row.textContent).toContain("Public");
  });

  it("garde la valeur d'un podium sur une ligne, le nom cède la place", async () => {
    await renderPage();
    const link = screen.getByTestId("team-roster-link-award-a");
    const nameCell = link.closest("span.inline-flex");
    expect(classesOf(nameCell)).toContain("min-w-0");
    const value = nameCell?.nextElementSibling ?? null;
    expect(value?.textContent).toBe("3 TD");
    expect(classesOf(value)).toEqual(
      expect.arrayContaining(["shrink-0", "whitespace-nowrap"]),
    );
  });
});
