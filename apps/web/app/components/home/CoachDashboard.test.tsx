import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));
vi.mock("../../lib/featureFlags", () => ({
  fetchMyFlags: vi.fn().mockResolvedValue([]),
}));

import { apiRequest } from "../../lib/api-client";
import { LanguageProvider } from "../../contexts/LanguageContext";
import { FeatureFlagProvider } from "../../contexts/FeatureFlagContext";
import CoachDashboard, { type CoachUser } from "./CoachDashboard";

const mockedApiRequest = apiRequest as unknown as ReturnType<typeof vi.fn>;

function renderDashboard(user: CoachUser, children?: ReactNode) {
  return render(
    <LanguageProvider>
      <FeatureFlagProvider>
        <CoachDashboard user={user} />
        {children}
      </FeatureFlagProvider>
    </LanguageProvider>,
  );
}

/** Route les appels apiRequest selon le path (teams vs rosters). */
function wireApi(teams: unknown[], rosters: Array<{ slug: string; name: string }> = []) {
  mockedApiRequest.mockImplementation((path: string) => {
    if (path.startsWith("/team/mine")) return Promise.resolve({ teams });
    if (path.startsWith("/api/rosters")) return Promise.resolve({ rosters });
    return Promise.reject(new Error(`unexpected path ${path}`));
  });
}

describe("CoachDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("auth_token", "fake-token");
  });

  it("affiche une salutation avec le coachName", async () => {
    wireApi([]);
    renderDashboard({ id: "u1", coachName: "Griff", _count: { teams: 0 } });
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-greeting").textContent).toContain("Griff"),
    );
  });

  it("retombe sur une salutation generique sans nom", async () => {
    wireApi([]);
    renderDashboard({ id: "u1" });
    await waitFor(() =>
      expect(screen.getByTestId("dashboard-greeting").textContent).toContain("coach"),
    );
  });

  it("affiche un lien retour vers l'accueil public", async () => {
    wireApi([]);
    renderDashboard({ id: "u1", coachName: "Coach" });
    const back = await screen.findByTestId("dashboard-home-link");
    expect(back.getAttribute("href")).toBe("/");
  });

  it("rend une carte cliquable par equipe avec nom, race et valeur", async () => {
    wireApi(
      [
        { id: "t1", name: "Les Rats", roster: "skaven", currentValue: 1150000 },
      ],
      [{ slug: "skaven", name: "Skavens" }],
    );
    renderDashboard({ id: "u1", coachName: "Coach" });

    await waitFor(() => {
      const cards = screen.getAllByTestId("dashboard-team-card");
      expect(cards).toHaveLength(1);
    });
    const card = screen.getByTestId("dashboard-team-card");
    expect(card.getAttribute("href")).toBe("/me/teams/t1");
    expect(card.textContent).toContain("Les Rats");
    expect(card.textContent).toContain("Skavens");
    // 1 150 000 / 1000 = 1150 (+ suffixe kpo)
    expect(card.textContent).toContain("1150");
  });

  it("affiche un etat vide avec CTA quand le coach n'a pas d'equipe", async () => {
    wireApi([]);
    renderDashboard({ id: "u1", coachName: "Coach" });
    await waitFor(() =>
      expect(screen.queryByTestId("dashboard-team-card")).toBeNull(),
    );
    const createLink = screen.getByRole("link", { name: /créer ma première équipe/i });
    expect(createLink.getAttribute("href")).toBe("/me/teams/new");
  });

  it("retombe sur le nom FR local (jamais le slug brut) quand l'endpoint rosters echoue", async () => {
    mockedApiRequest.mockImplementation((path: string) => {
      if (path.startsWith("/team/mine"))
        return Promise.resolve({
          teams: [{ id: "t9", name: "Equipe X", roster: "orc", currentValue: 1000000 }],
        });
      if (path.startsWith("/api/rosters")) return Promise.reject(new Error("boom"));
      return Promise.reject(new Error("unexpected"));
    });
    renderDashboard({ id: "u1", coachName: "Coach" });
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-team-card");
      // RosterBadge résout via ROSTER_NAMES du moteur : « Orques », pas "orc".
      expect(card.textContent).toContain("Orques");
      expect(card.textContent).not.toMatch(/\borc\b/);
    });
  });
});
