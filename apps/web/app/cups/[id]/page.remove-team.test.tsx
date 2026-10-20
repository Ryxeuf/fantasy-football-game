/**
 * Page d'une coupe : le commissaire retire l'équipe d'un coach depuis la
 * liste des inscrits, coupe en cours comprise. Un coach ordinaire ne voit
 * aucun bouton de retrait sur l'équipe d'un autre.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: "C1" }),
}));
vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(async (path: string) =>
    path.includes("/predictions")
      ? { scope: "off", scopeConfigured: true, rounds: [], coach: [], stands: [],
          viewer: { userId: null, isCommissioner: false, isMember: false, group: null } }
      : { teams: [] },
  ),
  ApiClientError: class extends Error {},
}));
vi.mock("../../lib/tournament-rulesets", () => ({
  useTournamentRulesetDefinition: () => null,
}));
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

function cup(isCreator: boolean) {
  return {
    id: "C1",
    name: "Coupe du Chaos",
    ruleset: "season_3",
    creator: { id: "commish", coachName: "Commish" },
    creatorId: "commish",
    validated: true,
    isPublic: true,
    status: "en_cours",
    participantCount: 2,
    participants: [team("a", "Orcs"), team("b", "Rats")],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    isCreator,
    rounds: [],
    standings: [],
    matches: [],
  };
}

function serve(viewerId: string, isCreator: boolean) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    json: async () =>
      url.endsWith("/auth/me")
        ? { user: { id: viewerId, roles: [] } }
        : init?.method === "POST"
          ? { cup: cup(isCreator), message: "ok" }
          : { cup: cup(isCreator) },
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  render(
    <LanguageProvider>
      <CupDetailPage />
    </LanguageProvider>,
  );
}

describe("page coupe — retrait d'une équipe", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("le commissaire retire l'équipe d'un coach d'une coupe en cours", async () => {
    const fetchMock = serve("commish", true);
    renderPage();

    const button = await screen.findByTestId("cup-remove-team-b");
    expect(button.textContent).toBe("Retirer");
    expect(screen.getByTestId("cup-remove-team-a")).toBeTruthy();

    fireEvent.click(button);

    const confirmText = (confirm as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(confirmText).toContain("« Rats » de Coach b");
    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith("/cup/C1/unregister"),
      );
      expect(call).toBeTruthy();
      expect(JSON.parse(String(call![1]!.body))).toEqual({ teamId: "b" });
    });
  });

  it("un coach ordinaire ne peut pas retirer l'équipe d'un autre", async () => {
    serve("o-a", false);
    renderPage();
    await screen.findByTestId("team-roster-link-participant-b");
    expect(screen.queryByTestId("cup-remove-team-b")).toBeNull();
  });
});
