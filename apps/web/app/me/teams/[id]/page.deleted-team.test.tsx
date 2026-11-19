/**
 * Une équipe supprimée s'annonce sur sa fiche et n'y offre plus aucune
 * modification. L'interdiction réelle vit côté serveur
 * (`rejectDeletedTeamWrite`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { deletedAt } = vi.hoisted(() => ({
  deletedAt: { current: null as string | null },
}));

vi.mock("../../../lib/api-client", () => ({
  apiRequest: vi.fn(async () => ({
    team: {
      id: "team-1",
      name: "Nor Vipi Hein",
      roster: "norse",
      ruleset: "season_3",
      format: "bb11",
      players: [
        {
          id: "p1",
          number: 1,
          name: "Blof",
          position: "norse_berzerker",
          skills: "",
          ma: 6,
          st: 3,
          ag: 3,
          pa: 4,
          av: 9,
          // Mort antérieur à la règle `firedAt` : seul cas du bouton « Retirer ».
          dead: true,
          firedAt: null,
        },
      ],
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
      deletedAt: deletedAt.current,
    },
    currentMatch: null,
    localMatchStats: null,
  })),
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock("./CaptainPanel", () => ({
  default: () => <div data-testid="captain-panel" />,
}));
vi.mock("./PendingAdvancementsBanner", () => ({
  PendingAdvancementsBanner: () => <div data-testid="pending-banner" />,
}));
vi.mock("./MatchReportBanner", () => ({ MatchReportBanner: () => null }));
vi.mock("./FirstTeamWelcomeBanner", () => ({ default: () => null }));
vi.mock("./TeamShareToggle", () => ({
  default: () => <div data-testid="share-toggle" />,
}));
vi.mock("../components/TeamLogoUploader", () => ({
  default: () => <div data-testid="logo-uploader" />,
}));
vi.mock("../../../lib/tournament-rulesets", () => ({
  useTournamentRulesetLabel: () => null,
}));

import { LanguageProvider } from "../../../contexts/LanguageContext";
import TeamDetailPage from "./page";

const originalFetch = global.fetch;
const editTestIds = [
  "captain-panel",
  "pending-banner",
  "share-toggle",
  "logo-uploader",
  "team-treasury-link",
  "player-identity-edit-p1",
  "player-image-upload-p1",
  "remove-player-p1",
];

function renderPage() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LanguageProvider>{children}</LanguageProvider>
  );
  return render(<TeamDetailPage />, { wrapper });
}

function editLink(container: HTMLElement): Element | null {
  return container.querySelector('a[href="/me/teams/team-1/edit"]');
}

beforeEach(() => {
  vi.clearAllMocks();
  deletedAt.current = null;
  window.history.pushState({}, "", "/me/teams/team-1");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => "token", setItem: vi.fn(), removeItem: vi.fn() },
  });
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes("/auth/me")) {
      return {
        ok: true,
        json: async () => ({
          user: { id: "u1", email: "a@test", roles: ["user", "admin"] },
        }),
      };
    }
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("fiche d'une équipe supprimée", () => {
  it("annonce la suppression et retire toute modification", async () => {
    deletedAt.current = "2026-08-25T12:00:00.000Z";
    const { container } = renderPage();

    const banner = await screen.findByTestId("team-deleted-banner");
    expect(banner.textContent).toContain("Équipe supprimée le 25/08/2026");
    expect(banner.textContent).toContain("lecture seule");
    expect(
      screen.getByTestId("team-deleted-restore-link").getAttribute("href"),
    ).toBe("/admin/teams/team-1");
    await waitFor(() => expect(screen.getAllByText("Blof").length).toBeGreaterThan(0));
    for (const id of editTestIds) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
    expect(editLink(container)).toBeNull();
  });

  it("garde la fiche habituelle sur une équipe active", async () => {
    const { container } = renderPage();

    await waitFor(() => expect(editLink(container)).toBeTruthy());
    expect(screen.queryByTestId("team-deleted-banner")).toBeNull();
    for (const id of editTestIds) {
      expect(screen.getAllByTestId(id).length).toBeGreaterThan(0);
    }
  });
});
