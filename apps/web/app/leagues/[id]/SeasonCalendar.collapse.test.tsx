/**
 * Pliage / dépliage du calendrier : par journée, et « Tout replier » /
 * « Tout déplier » pour le calendrier complet.
 */
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SeasonCalendar } from "./SeasonCalendar";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail, LeaguePairingDetail } from "./types";

vi.mock("./PairingBonusBreakdown", () => ({
  PairingBonusBreakdown: () => null,
}));
vi.mock("../../lib/api-client", () => ({ apiRequest: vi.fn() }));

function pairing(id: string, status: string): LeaguePairingDetail {
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
    matchSheet: null,
  };
}

function round(
  id: string,
  roundNumber: number,
  status: string,
  pairings: LeaguePairingDetail[],
): LeagueRoundDetail {
  return {
    id,
    roundNumber,
    name: null,
    status,
    startDate: null,
    endDate: null,
    pairings,
  };
}

const ROUNDS = [
  round("r1", 1, "completed", [pairing("pa1", "played")]),
  round("r2", 2, "pending", [pairing("pa2", "scheduled")]),
];

function renderCalendar(rounds: LeagueRoundDetail[] = ROUNDS) {
  render(
    <LanguageProvider>
      <SeasonCalendar rounds={rounds} currentUserId={null} />
    </LanguageProvider>,
  );
}

/** Le corps d'une journée est masqué via l'attribut `hidden`. */
function bodyHidden(roundId: string): boolean {
  const body = document.getElementById(`league-round-${roundId}-body`);
  expect(body).toBeTruthy();
  return (body as HTMLElement).hidden;
}

describe("SeasonCalendar — pliage par journée", () => {
  it("arrive entièrement déplié", () => {
    renderCalendar();
    expect(bodyHidden("r1")).toBe(false);
    expect(bodyHidden("r2")).toBe(false);
  });

  it("replie UNE journée sans toucher aux autres", () => {
    renderCalendar();
    fireEvent.click(screen.getByTestId("league-round-toggle-r1"));
    expect(bodyHidden("r1")).toBe(true);
    expect(bodyHidden("r2")).toBe(false);
  });

  it("redéplie la journée repliée", () => {
    renderCalendar();
    const toggle = screen.getByTestId("league-round-toggle-r1");
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(bodyHidden("r1")).toBe(false);
  });

  it("garde l'en-tête de la journée visible une fois repliée", () => {
    renderCalendar();
    fireEvent.click(screen.getByTestId("league-round-toggle-r1"));
    // Numéro, statut et avancement restent lisibles.
    expect(screen.getByTestId("league-round-status-r1")).toBeTruthy();
    expect(screen.getByTestId("league-round-progress-r1")).toBeTruthy();
  });

  it("reflète l'état dans aria-expanded", () => {
    renderCalendar();
    const toggle = screen.getByTestId("league-round-toggle-r1");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("SeasonCalendar — pliage du calendrier complet", () => {
  it("replie toutes les journées d'un coup, puis les redéplie", () => {
    renderCalendar();
    const all = screen.getByTestId("calendar-toggle-all");
    expect(all.textContent).toBe("Tout replier");

    fireEvent.click(all);
    expect(bodyHidden("r1")).toBe(true);
    expect(bodyHidden("r2")).toBe(true);
    expect(screen.getByTestId("calendar-toggle-all").textContent).toBe(
      "Tout déplier",
    );

    fireEvent.click(screen.getByTestId("calendar-toggle-all"));
    expect(bodyHidden("r1")).toBe(false);
    expect(bodyHidden("r2")).toBe(false);
  });

  it("propose « Tout replier » tant qu'une journée reste dépliée", () => {
    renderCalendar();
    // Une seule journée repliée : il en reste une à replier.
    fireEvent.click(screen.getByTestId("league-round-toggle-r1"));
    expect(screen.getByTestId("calendar-toggle-all").textContent).toBe(
      "Tout replier",
    );
    fireEvent.click(screen.getByTestId("calendar-toggle-all"));
    expect(bodyHidden("r1")).toBe(true);
    expect(bodyHidden("r2")).toBe(true);
  });

  it("ne propose rien quand aucune journée n'est visible", () => {
    // Deux journées JOUÉES : la barre de filtres est rendue (elle exige
    // plus d'une journée), mais le filtre « À jouer » ne retient rien.
    renderCalendar([
      round("r1", 1, "completed", [pairing("pa1", "played")]),
      round("r2", 2, "completed", [pairing("pa2", "played")]),
    ]);
    fireEvent.click(screen.getByTestId("calendar-filter-upcoming"));
    expect(screen.queryByTestId("calendar-toggle-all")).toBeNull();
    expect(screen.getByTestId("league-rounds-filter-empty")).toBeTruthy();
  });
});
