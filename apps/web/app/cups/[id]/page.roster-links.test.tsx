/**
 * Page d'une coupe : partout où un nom d'équipe s'affiche (inscrits,
 * podiums, classements individuels, liste des matchs), il mène à la fiche
 * de roster de l'équipe dans la coupe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "C1" }),
}));
vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn().mockResolvedValue({ teams: [] }),
  ApiClientError: class extends Error {},
}));
vi.mock("../../lib/tournament-rulesets", () => ({
  useTournamentRulesetDefinition: () => null,
}));
// Panneaux autonomes (lectures propres) : hors sujet ici.
vi.mock("../../components/CompetitionDocuments", () => ({ default: () => null }));
vi.mock("../../components/CompetitionLifecyclePanel", () => ({ default: () => null }));
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
  id: "C1",
  name: "Coupe du Chaos",
  ruleset: "season_3",
  creator: { id: "o-a", coachName: "Coach a" },
  creatorId: "o-a",
  validated: true,
  isPublic: true,
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

describe("page coupe — noms d'équipe vers leur roster", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.endsWith("/auth/me") ? { user: { id: "viewer", roles: [] } } : { cup: CUP },
      })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lie inscrits, podiums, tops joueurs et matchs à la fiche de roster", async () => {
    render(
      <LanguageProvider>
        <CupDetailPage />
      </LanguageProvider>,
    );
    const participant = await screen.findByTestId("team-roster-link-participant-a");
    expect(participant.getAttribute("href")).toBe("/cups/C1/teams/a");
    expect(screen.getByTestId("cup-view-roster-b").getAttribute("href")).toBe(
      "/cups/C1/teams/b",
    );
    expect(screen.getByTestId("team-roster-link-award-a").getAttribute("href")).toBe(
      "/cups/C1/teams/a",
    );
    expect(
      screen.getByTestId("team-roster-link-leader-topScorers-pl1").getAttribute("href"),
    ).toBe("/cups/C1/teams/b");
    expect(screen.getByTestId("team-roster-link-match-m1-a").getAttribute("href")).toBe(
      "/cups/C1/teams/a",
    );
    expect(screen.getByTestId("team-roster-link-match-m1-b").getAttribute("href")).toBe(
      "/cups/C1/teams/b",
    );
    // Le bracket chronologique reprend les mêmes liens.
    expect(screen.getByTestId("team-roster-link-bracket-m1-a").getAttribute("href")).toBe(
      "/cups/C1/teams/a",
    );
  });

  it("offre au commissaire le raccourci des feuilles à valider", async () => {
    const withPending = {
      ...CUP,
      isCreator: true,
      rounds: [
        {
          id: "r1",
          roundNumber: 1,
          name: null,
          system: "random",
          kind: "regular",
          bracketSlot: null,
          status: "in_progress",
          scheduledAt: null,
          createdAt: "2026-10-01T10:00:00.000Z",
          pairings: [
            {
              id: "cp1",
              tableNumber: 1,
              status: "scheduled",
              scheduledAt: null,
              homeTeam: { ...team("a", "Orcs"), logoUrl: null, ownerId: "o-a", coachName: "A" },
              awayTeam: { ...team("b", "Rats"), logoUrl: null, ownerId: "o-b", coachName: "B" },
              localMatch: null,
              matchSheet: { status: "both_submitted" },
            },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url.endsWith("/auth/me")
            ? { user: { id: "o-a", roles: [] } }
            : { cup: withPending },
      })),
    );
    render(
      <LanguageProvider>
        <CupDetailPage />
      </LanguageProvider>,
    );
    const link = await screen.findByTestId("cup-pending-validations-link");
    expect(link.getAttribute("href")).toBe("/cups/C1/pending-validations");
    expect(link.textContent).toContain("1 feuille à valider");
  });
});

