/**
 * Le bouton « Relancer » d'une journée n'appartient qu'au commissaire : c'est
 * lui qui porte la discipline du calendrier, et c'est en son nom que le
 * message part. Un coach ne doit pas même le voir (le serveur re-tranche).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonCalendar } from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));

vi.mock("../../lib/api-client", () => ({
  apiRequest: vi.fn(),
}));

const ROUND: LeagueRoundDetail = {
  id: "r1",
  roundNumber: 4,
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
        team: { id: "t2", name: "Skavenblight", roster: "skaven", ownerId: "o2" },
      },
      match: null,
      matchSheet: null,
    },
  ],
};

function renderCalendar(isCommissioner: boolean) {
  return render(
    <LanguageProvider>
      <SeasonCalendar
        rounds={[ROUND]}
        currentUserId="o1"
        isCommissioner={isCommissioner}
      />
    </LanguageProvider>,
  );
}

describe("SeasonCalendar — bouton de relance", () => {
  it("propose la relance au commissaire, sur CETTE journée", () => {
    renderCalendar(true);
    const button = screen.getByTestId("round-followup-r1");
    expect(button.getAttribute("aria-label")).toContain("journée 4");
  });

  it("ne le montre pas à un coach", () => {
    renderCalendar(false);
    expect(screen.queryByTestId("round-followup-r1")).toBeNull();
  });

  it("le masque par défaut (prop absente)", () => {
    render(
      <LanguageProvider>
        <SeasonCalendar rounds={[ROUND]} currentUserId="o1" />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("round-followup-r1")).toBeNull();
  });
});
