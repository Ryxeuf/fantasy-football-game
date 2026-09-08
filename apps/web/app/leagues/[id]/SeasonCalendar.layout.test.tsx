/**
 * Nouvelle présentation des journées : cartes de rencontre (score au
 * centre), mise en avant « Mon match », avancement de la journée et filtre
 * À jouer / Jouées.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  SeasonCalendar,
  effectiveRoundStatus,
  filterRounds,
  roundProgress,
} from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail, LeaguePairingDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));
vi.mock("../../lib/api-client", () => ({ apiRequest: vi.fn() }));

function pairing(
  id: string,
  status: string,
  score?: { scoreHome: number; scoreAway: number },
): LeaguePairingDetail {
  return {
    id,
    status,
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
    matchSheet: score ? { status: "validated", ...score } : null,
  };
}

function round(
  id: string,
  roundNumber: number,
  status: string,
  pairings: LeaguePairingDetail[],
): LeagueRoundDetail {
  return { id, roundNumber, name: null, status, startDate: null, endDate: null, pairings };
}

const ROUNDS = [
  round("r1", 1, "completed", [
    pairing("pa1", "played", { scoreHome: 2, scoreAway: 1 }),
    pairing("pa2", "forfeit_home"),
  ]),
  round("r2", 2, "in_progress", [
    pairing("pa3", "played", { scoreHome: 0, scoreAway: 0 }),
    pairing("pa4", "scheduled"),
  ]),
  round("r3", 3, "pending", [pairing("pa5", "scheduled")]),
];

function renderCalendar(currentUserId: string | null = null) {
  render(
    <LanguageProvider>
      <SeasonCalendar rounds={ROUNDS} currentUserId={currentUserId} />
    </LanguageProvider>,
  );
}

describe("roundProgress / filterRounds (purs)", () => {
  it("compte les rencontres terminées (joué, forfait, annulé)", () => {
    expect(roundProgress(ROUNDS[0])).toEqual({ played: 2, total: 2 });
    expect(roundProgress(ROUNDS[1])).toEqual({ played: 1, total: 2 });
    expect(roundProgress({ pairings: [] })).toEqual({ played: 0, total: 0 });
  });
  it("montre « en cours » une journée entamée mais pas terminée", () => {
    expect(effectiveRoundStatus(ROUNDS[0])).toBe("completed");
    // En base la journée reste `pending` : une rencontre terminée suffit.
    expect(effectiveRoundStatus({ ...ROUNDS[1], status: "pending" })).toBe("in_progress");
    expect(effectiveRoundStatus(ROUNDS[2])).toBe("pending");
  });
  it("filtre les journées jouées / à jouer", () => {
    expect(filterRounds(ROUNDS, "played").map((r) => r.id)).toEqual(["r1"]);
    expect(filterRounds(ROUNDS, "upcoming").map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(filterRounds(ROUNDS, "all")).toHaveLength(3);
  });
});

describe("SeasonCalendar — nouvelle présentation", () => {
  it("affiche le score au centre et l'avancement de chaque journée", () => {
    renderCalendar();
    expect(screen.getByTestId("pairing-score-pa1").textContent).toBe("2 – 1");
    expect(screen.getByTestId("league-round-progress-r1").textContent).toBe("2/2 joués");
    expect(screen.getByTestId("league-round-progress-r2").textContent).toBe("1/2 joués");
    expect(screen.getByTestId("league-round-status-r2").textContent).toBe("En cours");
    // Une rencontre validée porte un badge « Résultat validé », un forfait le sien.
    expect(screen.getByTestId("pairing-validated-pa1")).toBeTruthy();
    expect(screen.getByTestId("pairing-status-pa2").textContent).toBe("Forfait");
  });

  it("met en avant les rencontres du coach connecté", () => {
    renderCalendar("o2");
    expect(screen.getByTestId("league-pairing-pa4-mine").textContent).toBe("Mon match");
    expect(screen.getByTestId("league-pairing-pa4").getAttribute("data-highlighted")).toBe(
      "true",
    );
  });

  it("ne met rien en avant pour un visiteur", () => {
    renderCalendar("visitor");
    expect(screen.queryByTestId("league-pairing-pa4-mine")).toBeNull();
  });

  it("filtre les journées à jouer / jouées", () => {
    renderCalendar();
    expect(screen.getByTestId("calendar-filter-all").textContent).toContain("3");
    fireEvent.click(screen.getByTestId("calendar-filter-played"));
    expect(screen.getByTestId("league-round-r1")).toBeTruthy();
    expect(screen.queryByTestId("league-round-r2")).toBeNull();
    fireEvent.click(screen.getByTestId("calendar-filter-upcoming"));
    expect(screen.queryByTestId("league-round-r1")).toBeNull();
    expect(screen.getByTestId("league-round-r2")).toBeTruthy();
    expect(screen.getByTestId("league-round-r3")).toBeTruthy();
  });

  it("n'affiche pas de filtre pour une saison à une seule journée", () => {
    render(
      <LanguageProvider>
        <SeasonCalendar rounds={[ROUNDS[2]]} currentUserId={null} />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("calendar-filters")).toBeNull();
    expect(screen.getByTestId("league-round-r3")).toBeTruthy();
  });
});
