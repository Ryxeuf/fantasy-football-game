/**
 * Nom du coach à côté de chaque équipe d'un match du calendrier.
 * Le champ `team.owner` est optionnel (API antérieure) : sans lui,
 * seul le nom d'équipe s'affiche.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonCalendar } from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));

function round(withCoaches: boolean): LeagueRoundDetail {
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
          team: {
            id: "t1",
            name: "Reikland",
            roster: "human",
            ownerId: "o1",
            ...(withCoaches
              ? { owner: { coachName: "Coach Griff" } }
              : {}),
          },
        },
        awayParticipant: {
          id: "p2",
          teamId: "t2",
          team: {
            id: "t2",
            name: "Skavenblight",
            roster: "skaven",
            ownerId: "o2",
            ...(withCoaches ? { owner: { coachName: null } } : {}),
          },
        },
        match: null,
        matchSheet: null,
      },
    ],
  };
}

function renderCalendar(withCoaches: boolean) {
  render(
    <LanguageProvider>
      <SeasonCalendar rounds={[round(withCoaches)]} currentUserId={null} />
    </LanguageProvider>,
  );
}

describe("SeasonCalendar — nom du coach par équipe", () => {
  it("affiche le coach quand l'API le fournit", () => {
    renderCalendar(true);
    expect(screen.getByTestId("pairing-coach-home").textContent).toBe(
      "(Coach Griff)",
    );
  });

  it("n'affiche rien quand le coach est null", () => {
    renderCalendar(true);
    expect(screen.queryByTestId("pairing-coach-away")).toBeNull();
  });

  it("reste rétro-compatible avec une API sans champ owner", () => {
    renderCalendar(false);
    expect(screen.queryByTestId("pairing-coach-home")).toBeNull();
    expect(screen.getByTestId("pairing-team-home").textContent).toContain(
      "Reikland",
    );
  });
});
