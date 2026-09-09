import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextMatchesPanel } from "./NextMatchesPanel";
import { LanguageProvider } from "../../contexts/LanguageContext";
import type { LeaguePairingDetail, LeagueRoundDetail } from "./types";

const ME = "coach-me";
const RIVAL = "coach-rival";

function participant(ownerId: string, name: string) {
  return {
    id: `part-${name}`,
    teamId: `team-${name}`,
    team: { id: `team-${name}`, name, roster: "human", ownerId },
  } as LeaguePairingDetail["homeParticipant"];
}

function pairing(
  id: string,
  homeOwner: string,
  awayOwner: string,
  overrides: Partial<LeaguePairingDetail> = {},
): LeaguePairingDetail {
  return {
    id,
    status: "scheduled",
    scheduledAt: null,
    deadlineAt: null,
    homeParticipant: participant(homeOwner, `Reikland-${id}`),
    awayParticipant: participant(awayOwner, `Gouged-${id}`),
    match: null,
    ...overrides,
  };
}

function round(
  roundNumber: number,
  pairings: LeaguePairingDetail[],
): LeagueRoundDetail {
  return {
    id: `round-${roundNumber}`,
    roundNumber,
    name: null,
    status: "pending",
    startDate: null,
    endDate: null,
    pairings,
  };
}

function renderPanel(rounds: LeagueRoundDetail[], userId: string | null) {
  return render(
    <LanguageProvider>
      <NextMatchesPanel rounds={rounds} currentUserId={userId} />
    </LanguageProvider>,
  );
}

describe("NextMatchesPanel", () => {
  it("affiche les 3 prochains matchs du coach avec leur n° de journée", () => {
    const rounds = [1, 2, 3, 4].map((n) =>
      round(n, [pairing(`p${n}`, ME, RIVAL)]),
    );
    renderPanel(rounds, ME);

    for (const n of [1, 2, 3]) {
      const row = screen.getByTestId(`next-match-p${n}`);
      expect(row.textContent).toContain(`J${n}`);
      expect(row.textContent).toContain(`Gouged-p${n}`);
    }
    // Le 4e est hors des 3 prochains.
    expect(screen.queryByTestId("next-match-p4")).toBeNull();
  });

  it("nomme l'ADVERSAIRE, pas l'équipe du coach", () => {
    renderPanel([round(1, [pairing("ext", RIVAL, ME)])], ME);
    const row = screen.getByTestId("next-match-ext");
    // Le coach joue à l'extérieur : l'adversaire est l'équipe à domicile.
    expect(row.textContent).toContain("Reikland-ext");
    expect(row.textContent).not.toContain("Gouged-ext");
    expect(row.textContent).toContain("à l'extérieur");
  });

  it("indique le côté à domicile", () => {
    renderPanel([round(1, [pairing("dom", ME, RIVAL)])], ME);
    expect(screen.getByTestId("next-match-dom").textContent).toContain(
      "à domicile",
    );
  });

  it("ancre le badge de journée sur la journée du calendrier", () => {
    renderPanel([round(5, [pairing("p", ME, RIVAL)])], ME);
    expect(
      screen.getByTestId("next-match-round-p").getAttribute("href"),
    ).toBe("#journee-5");
  });

  it("mène à la feuille de match", () => {
    renderPanel([round(1, [pairing("p", ME, RIVAL)])], ME);
    expect(screen.getByTestId("next-match-sheet-p").getAttribute("href")).toBe(
      "/leagues/pairings/p/sheet",
    );
  });

  it("affiche la date prévisionnelle, ou « Date à convenir »", () => {
    renderPanel(
      [
        round(1, [
          pairing("date", ME, RIVAL, {
            scheduledAt: "2026-09-20T18:00:00.000Z",
          }),
        ]),
        round(2, [pairing("sans", ME, RIVAL)]),
      ],
      ME,
    );
    expect(screen.getByTestId("next-match-date-date").textContent).toMatch(
      /2026/,
    );
    expect(screen.getByTestId("next-match-date-sans").textContent).toBe(
      "Date à convenir",
    );
  });

  it("affiche un message quand le coach n'a plus de match à jouer", () => {
    renderPanel(
      [round(1, [pairing("p", ME, RIVAL, { status: "played" })])],
      ME,
    );
    expect(screen.getByTestId("league-next-matches-empty")).toBeTruthy();
    expect(screen.queryByTestId("next-match-p")).toBeNull();
  });

  it("se masque entièrement pour un visiteur non connecté", () => {
    renderPanel([round(1, [pairing("p", ME, RIVAL)])], null);
    expect(screen.queryByTestId("league-next-matches")).toBeNull();
  });
});
