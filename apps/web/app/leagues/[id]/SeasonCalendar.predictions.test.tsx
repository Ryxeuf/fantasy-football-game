/**
 * Bouton 🔮 de chaque journée : mène à la page des pronostics de la journée
 * et dit ce qui attend le lecteur. Pas de bouton sans pronostics.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonCalendar } from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail, LeaguePairingDetail } from "./types";
import type { RoundPredictionLink } from "../_components/prediction-rounds";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));
vi.mock("../../lib/api-client", () => ({ apiRequest: vi.fn() }));

function pairing(id: string): LeaguePairingDetail {
  return {
    id,
    status: "scheduled",
    scheduledAt: null,
    deadlineAt: null,
    homeParticipant: {
      id: `${id}-h`,
      teamId: "t1",
      team: { id: "t1", name: "Reikland", roster: "human", ownerId: "o1" },
    },
    awayParticipant: {
      id: `${id}-a`,
      teamId: "t2",
      team: { id: "t2", name: "Skavenblight", roster: "skaven", ownerId: "o2" },
    },
    match: null,
    matchSheet: null,
  };
}

const ROUNDS: LeagueRoundDetail[] = [
  {
    id: "r1",
    roundNumber: 1,
    name: null,
    status: "pending",
    startDate: null,
    endDate: null,
    pairings: [pairing("pa1")],
  },
  {
    id: "r2",
    roundNumber: 2,
    name: null,
    status: "pending",
    startDate: null,
    endDate: null,
    pairings: [pairing("pa2")],
  },
];

function renderCalendar(
  predictionLinks?: Readonly<Record<string, RoundPredictionLink>>,
) {
  render(
    <LanguageProvider>
      <SeasonCalendar
        rounds={ROUNDS}
        currentUserId={null}
        predictionLinks={predictionLinks}
      />
    </LanguageProvider>,
  );
}

describe("SeasonCalendar — bouton pronostics par journée", () => {
  it("un bouton par journée qui a un lien, avec son libellé et son état", () => {
    renderCalendar({
      r1: { href: "/leagues/lg/seasons/s/predictions/r1", label: "Pronostiquer (2)", state: "todo" },
    });
    const button = screen.getByTestId("league-round-predictions-r1");
    expect(button.getAttribute("href")).toBe("/leagues/lg/seasons/s/predictions/r1");
    expect(button.textContent).toContain("Pronostiquer (2)");
    expect(button.getAttribute("data-state")).toBe("todo");
    expect(screen.queryByTestId("league-round-predictions-r2")).toBeNull();
  });

  it("aucun bouton sans pronostics", () => {
    renderCalendar();
    expect(screen.queryByTestId("league-round-predictions-r1")).toBeNull();
    expect(screen.queryByTestId("league-round-predictions-r2")).toBeNull();
  });
});
