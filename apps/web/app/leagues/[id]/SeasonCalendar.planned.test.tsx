/**
 * « Prévu le … » : une rencontre à jouer dont la date a été convenue
 * n'affiche plus « À jouer ». L'éditeur de date n'est proposé qu'aux
 * coachs de la rencontre (et au commissaire), et seulement si le parent
 * sait recharger la saison.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonCalendar, pairingPlannedLabel } from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));
vi.mock("../../lib/api-client", () => ({ apiRequest: vi.fn() }));

const DATE = "2026-09-12T18:30:00.000Z";

function round(status: string, scheduledAt: string | null): LeagueRoundDetail {
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
        status,
        scheduledAt,
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
}

function renderCalendar(
  rounds: LeagueRoundDetail[],
  props: {
    currentUserId?: string | null;
    canRecordResult?: boolean;
    onPairingChanged?: () => void;
  } = {},
) {
  render(
    <LanguageProvider>
      <SeasonCalendar
        rounds={rounds}
        currentUserId={props.currentUserId ?? null}
        canRecordResult={props.canRecordResult}
        onPairingChanged={props.onPairingChanged}
      />
    </LanguageProvider>,
  );
}

describe("pairingPlannedLabel", () => {
  it("injecte la date dans le gabarit", () => {
    const label = pairingPlannedLabel(
      { status: "scheduled", scheduledAt: DATE },
      "Prévu le {{date}}",
      "fr",
    );
    expect(label).toMatch(/^Prévu le .*2026/);
  });
  it("ne dit rien sans date ou une fois jouée", () => {
    expect(
      pairingPlannedLabel({ status: "scheduled", scheduledAt: null }, "x {{date}}", "fr"),
    ).toBeNull();
    expect(
      pairingPlannedLabel({ status: "played", scheduledAt: DATE }, "x {{date}}", "fr"),
    ).toBeNull();
  });
});

describe("SeasonCalendar — date prévisionnelle", () => {
  it("remplace « À jouer » par « Prévu le … » quand la date est posée", () => {
    renderCalendar([round("scheduled", DATE)]);
    expect(screen.getByTestId("pairing-planned-pa1").textContent).toMatch(/Prévu le/);
    expect(screen.queryByText("À jouer")).toBeNull();
  });

  it("garde « À jouer » sans date", () => {
    renderCalendar([round("scheduled", null)]);
    expect(screen.queryByTestId("pairing-planned-pa1")).toBeNull();
    expect(screen.getByText("À jouer")).toBeTruthy();
  });

  it("propose l'éditeur au coach impliqué, pas à un tiers", () => {
    renderCalendar([round("scheduled", null)], {
      currentUserId: "o2",
      onPairingChanged: () => {},
    });
    expect(screen.getByTestId("pairing-schedule-open-pa1")).toBeTruthy();
  });

  it("ne propose rien à un tiers, ni sans callback de rechargement", () => {
    renderCalendar([round("scheduled", null)], {
      currentUserId: "stranger",
      onPairingChanged: () => {},
    });
    expect(screen.queryByTestId("pairing-schedule-open-pa1")).toBeNull();
  });

  it("le commissaire peut planifier n'importe quelle rencontre à jouer", () => {
    renderCalendar([round("scheduled", null)], {
      currentUserId: "commish",
      canRecordResult: true,
      onPairingChanged: () => {},
    });
    expect(screen.getByTestId("pairing-schedule-open-pa1")).toBeTruthy();
  });

  it("n'offre plus l'éditeur une fois la rencontre jouée", () => {
    renderCalendar([round("played", DATE)], {
      currentUserId: "o1",
      canRecordResult: true,
      onPairingChanged: () => {},
    });
    expect(screen.queryByTestId("pairing-schedule-open-pa1")).toBeNull();
    expect(screen.queryByTestId("pairing-planned-pa1")).toBeNull();
  });
});
