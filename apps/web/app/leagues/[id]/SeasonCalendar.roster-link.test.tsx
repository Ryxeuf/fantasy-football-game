/**
 * Accès au roster depuis le calendrier : le nom d'une équipe mène à sa
 * fiche de roster de ligue — même page que le bouton « Voir le roster »
 * de la liste des participants, qui était jusqu'ici le seul chemin.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonCalendar } from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));

function round(): LeagueRoundDetail {
  return {
    id: "r1",
    roundNumber: 1,
    name: null,
    status: "pending",
    startDate: null,
    endDate: null,
    pairings: [
      {
        id: "pa1",
        status: "scheduled",
        scheduledAt: null,
        deadlineAt: null,
        homeParticipant: {
          id: "p1",
          teamId: "t1",
          team: { id: "t1", name: "Reikland", roster: "human", ownerId: "o1" },
        },
        awayParticipant: {
          id: "p2",
          teamId: "t2",
          team: {
            id: "t2",
            name: "Skavenblight",
            roster: "skaven",
            ownerId: "o2",
          },
        },
        match: null,
        matchSheet: null,
      },
    ],
  };
}

function renderCalendar(props: {
  leagueId?: string | null;
  canViewRosters?: boolean;
}) {
  render(
    <LanguageProvider>
      <SeasonCalendar rounds={[round()]} currentUserId={null} {...props} />
    </LanguageProvider>,
  );
}

describe("SeasonCalendar — acces au roster depuis le nom d'equipe", () => {
  it("rend les deux noms cliquables vers leur fiche de roster", () => {
    renderCalendar({ leagueId: "L1", canViewRosters: true });
    expect(
      screen.getByTestId("team-roster-link-pairing-home-t1").getAttribute("href"),
    ).toBe("/leagues/L1/teams/t1");
    expect(
      screen.getByTestId("team-roster-link-pairing-away-t2").getAttribute("href"),
    ).toBe("/leagues/L1/teams/t2");
  });

  it("laisse les noms en texte quand la consultation n'est pas autorisee", () => {
    renderCalendar({ leagueId: "L1", canViewRosters: false });
    expect(screen.queryByTestId("team-roster-link-pairing-home-t1")).toBeNull();
    expect(screen.getByTestId("pairing-team-home").textContent).toContain(
      "Reikland",
    );
  });

  it("laisse les noms en texte sans leagueId (pas de lien mort)", () => {
    renderCalendar({ canViewRosters: true });
    expect(screen.queryByTestId("team-roster-link-pairing-home-t1")).toBeNull();
  });
});
