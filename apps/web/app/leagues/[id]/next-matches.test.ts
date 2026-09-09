import { describe, it, expect } from "vitest";
import { selectUpcomingMatches, NEXT_MATCHES_COUNT } from "./next-matches";
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
    homeParticipant: participant(homeOwner, `${id}-home`),
    awayParticipant: participant(awayOwner, `${id}-away`),
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

describe("selectUpcomingMatches", () => {
  it("ne retient que les rencontres DU coach", () => {
    const mine = pairing("p1", ME, RIVAL);
    const rounds = [round(1, [pairing("p0", RIVAL, "coach-x"), mine])];
    const out = selectUpcomingMatches(rounds, ME);
    expect(out.map((m) => m.pairing.id)).toEqual(["p1"]);
  });

  it("écarte les rencontres déjà tranchées", () => {
    const rounds = [
      round(1, [pairing("played", ME, RIVAL, { status: "played" })]),
      round(2, [pairing("ffh", ME, RIVAL, { status: "forfeit_home" })]),
      round(3, [pairing("ffa", ME, RIVAL, { status: "forfeit_away" })]),
      round(4, [pairing("cancelled", ME, RIVAL, { status: "cancelled" })]),
      round(5, [pairing("open", ME, RIVAL)]),
      round(6, [pairing("live", ME, RIVAL, { status: "in_progress" })]),
    ];
    expect(selectUpcomingMatches(rounds, ME).map((m) => m.pairing.id)).toEqual([
      "open",
      "live",
    ]);
  });

  it("plafonne à 3 rencontres par défaut", () => {
    const rounds = [1, 2, 3, 4, 5].map((n) =>
      round(n, [pairing(`p${n}`, ME, RIVAL)]),
    );
    const out = selectUpcomingMatches(rounds, ME);
    expect(NEXT_MATCHES_COUNT).toBe(3);
    expect(out.map((m) => m.pairing.id)).toEqual(["p1", "p2", "p3"]);
  });

  it("respecte une limite explicite", () => {
    const rounds = [1, 2, 3].map((n) => round(n, [pairing(`p${n}`, ME, RIVAL)]));
    expect(selectUpcomingMatches(rounds, ME, 1).map((m) => m.pairing.id)).toEqual(
      ["p1"],
    );
    expect(selectUpcomingMatches(rounds, ME, 0)).toEqual([]);
  });

  it("ordonne par numéro de journée croissant, même si les journées arrivent mélangées", () => {
    const rounds = [
      round(3, [pairing("p3", ME, RIVAL)]),
      round(1, [pairing("p1", ME, RIVAL)]),
      round(2, [pairing("p2", ME, RIVAL)]),
    ];
    expect(selectUpcomingMatches(rounds, ME).map((m) => m.pairing.id)).toEqual([
      "p1",
      "p2",
      "p3",
    ]);
  });

  it("départage une même journée par date prévisionnelle, sans date en dernier", () => {
    const rounds = [
      round(1, [
        pairing("sans-date", ME, RIVAL),
        pairing("tard", ME, RIVAL, { scheduledAt: "2026-09-20T20:00:00.000Z" }),
        pairing("tot", ME, RIVAL, { scheduledAt: "2026-09-10T20:00:00.000Z" }),
      ]),
    ];
    expect(selectUpcomingMatches(rounds, ME).map((m) => m.pairing.id)).toEqual([
      "tot",
      "tard",
      "sans-date",
    ]);
  });

  it("expose le côté du coach et son ADVERSAIRE", () => {
    const rounds = [
      round(1, [pairing("dom", ME, RIVAL)]),
      round(2, [pairing("ext", RIVAL, ME)]),
    ];
    const [home, away] = selectUpcomingMatches(rounds, ME);
    expect(home.side).toBe("home");
    expect(home.opponent.team.ownerId).toBe(RIVAL);
    expect(away.side).toBe("away");
    expect(away.opponent.team.ownerId).toBe(RIVAL);
  });

  it("porte le numéro et le nom de la journée", () => {
    const named = round(7, [pairing("p", ME, RIVAL)]);
    const out = selectUpcomingMatches([{ ...named, name: "Choc" }], ME);
    expect(out[0]?.roundNumber).toBe(7);
    expect(out[0]?.roundName).toBe("Choc");
  });

  it("ne rend rien sans coach connecté", () => {
    const rounds = [round(1, [pairing("p1", ME, RIVAL)])];
    expect(selectUpcomingMatches(rounds, null)).toEqual([]);
  });

  it("tolère une journée sans rencontres et un calendrier vide", () => {
    expect(selectUpcomingMatches([round(1, [])], ME)).toEqual([]);
    expect(
      selectUpcomingMatches([{ ...round(1, []), pairings: undefined }], ME),
    ).toEqual([]);
    expect(selectUpcomingMatches([], ME)).toEqual([]);
  });

  it("ne mute pas le calendrier reçu", () => {
    const rounds = [
      round(2, [pairing("p2", ME, RIVAL)]),
      round(1, [pairing("p1", ME, RIVAL)]),
    ];
    selectUpcomingMatches(rounds, ME);
    expect(rounds.map((r) => r.roundNumber)).toEqual([2, 1]);
  });
});
