import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageProvider } from "../../contexts/LanguageContext";
import CupNextMatchesPanel from "./CupNextMatchesPanel";
import { selectCupUpcomingMatches } from "./next-matches";
import type { CupPairingView, CupRoundView } from "./CupRoundsView";

const team = (id: string, ownerId: string) => ({
  id,
  name: `Team ${id}`,
  roster: "orc",
  logoUrl: null,
  ownerId,
  coachName: `Coach ${id}`,
});

const pairing = (over: Partial<CupPairingView>): CupPairingView => ({
  id: "p",
  tableNumber: 1,
  status: "scheduled",
  scheduledAt: null,
  homeTeam: team("a", "me"),
  awayTeam: team("b", "other"),
  localMatch: null,
  ...over,
});

const round = (roundNumber: number, pairings: CupPairingView[]): CupRoundView => ({
  id: `r${roundNumber}`,
  roundNumber,
  name: null,
  system: "swiss",
  status: "pending",
  scheduledAt: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  pairings,
});

const ROUNDS = [
  round(2, [pairing({ id: "late", homeTeam: team("c", "other"), awayTeam: team("a", "me") })]),
  round(1, [
    pairing({ id: "played", status: "played" }),
    pairing({ id: "bye", awayTeam: null }),
    pairing({ id: "first" }),
    // Placeholder de bracket : pas encore d'adversaire.
    pairing({ id: "placeholder", awayTeam: team("a", "me") }),
    pairing({ id: "others", homeTeam: team("x", "x"), awayTeam: team("y", "y") }),
  ]),
];

describe("selectCupUpcomingMatches", () => {
  it("ne garde que les rencontres à jouer du coach, ronde par ronde", () => {
    const out = selectCupUpcomingMatches(ROUNDS, "me");
    expect(out.map((m) => m.pairing.id)).toEqual(["first", "late"]);
    expect(out[0]).toMatchObject({ roundNumber: 1, side: "home" });
    expect(out[0].opponent.id).toBe("b");
    expect(out[1]).toMatchObject({ roundNumber: 2, side: "away" });
    expect(out[1].opponent.id).toBe("c");
  });

  it("rend une liste vide sans lecteur ou sans place", () => {
    expect(selectCupUpcomingMatches(ROUNDS, null)).toEqual([]);
    expect(selectCupUpcomingMatches(ROUNDS, "me", 0)).toEqual([]);
  });
});

describe("CupNextMatchesPanel", () => {
  it("liste les rencontres avec la feuille et le roster de l'adversaire", () => {
    render(
      <LanguageProvider>
        <CupNextMatchesPanel cupId="C1" rounds={ROUNDS} currentUserId="me" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("cup-next-match-first")).toBeTruthy();
    expect(
      screen.getByTestId("cup-next-match-sheet-first").getAttribute("href"),
    ).toBe("/cups/pairings/first/sheet");
    expect(
      screen.getByTestId("team-roster-link-next-first").getAttribute("href"),
    ).toBe("/cups/C1/teams/b");
  });

  it("disparaît pour un visiteur sans rencontre", () => {
    render(
      <LanguageProvider>
        <CupNextMatchesPanel cupId="C1" rounds={ROUNDS} currentUserId="nobody" />
      </LanguageProvider>,
    );
    expect(screen.queryByTestId("cup-next-matches")).toBeNull();
  });
});
