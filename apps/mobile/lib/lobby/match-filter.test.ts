/**
 * S27.3.4 — Tests des helpers purs de filtre du lobby.
 *
 * Extraits de `apps/mobile/app/lobby.tsx` pour permettre la
 * testabilite et le refactor en sous-composants.
 */

import { describe, expect, it } from "vitest";
import {
  filterMatches,
  countMyTurn,
  type LobbyFilter,
  type MatchSummary,
} from "./match-filter";

function makeMatch(partial: Partial<MatchSummary>): MatchSummary {
  return {
    id: partial.id ?? "m1",
    status: partial.status ?? "active",
    createdAt: partial.createdAt ?? "2026-05-05T10:00:00Z",
    lastMoveAt: partial.lastMoveAt ?? null,
    isMyTurn: partial.isMyTurn ?? false,
    score: partial.score ?? { teamA: 0, teamB: 0 },
    myScore: partial.myScore ?? 0,
    opponentScore: partial.opponentScore ?? 0,
    half: partial.half ?? 0,
    turn: partial.turn ?? 0,
    myTeam: partial.myTeam ?? null,
    opponent: partial.opponent ?? null,
  };
}

describe("filterMatches", () => {
  const matches: MatchSummary[] = [
    makeMatch({ id: "a", status: "active", isMyTurn: true }),
    makeMatch({ id: "b", status: "active", isMyTurn: false }),
    makeMatch({ id: "c", status: "pending" }),
    makeMatch({ id: "d", status: "prematch" }),
    makeMatch({ id: "e", status: "prematch-setup" }),
    makeMatch({ id: "f", status: "ended" }),
  ];

  it("retourne tous les matchs pour le filtre 'all'", () => {
    expect(filterMatches(matches, "all").map((m) => m.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("retourne uniquement les matchs actifs ou je dois jouer pour 'my-turn'", () => {
    expect(filterMatches(matches, "my-turn").map((m) => m.id)).toEqual(["a"]);
  });

  it("ignore isMyTurn=true sur un match qui n'est pas active pour 'my-turn'", () => {
    const onlyPendingTurn = [
      makeMatch({ id: "x", status: "pending", isMyTurn: true }),
    ];
    expect(filterMatches(onlyPendingTurn, "my-turn")).toEqual([]);
  });

  it("retourne active + prematch + prematch-setup pour 'active'", () => {
    expect(filterMatches(matches, "active").map((m) => m.id)).toEqual([
      "a",
      "b",
      "d",
      "e",
    ]);
  });

  it("retourne uniquement les matchs ended pour 'ended'", () => {
    expect(filterMatches(matches, "ended").map((m) => m.id)).toEqual(["f"]);
  });

  it("retourne tous les matchs pour un filtre inconnu (defensif)", () => {
    const unknown = "zzz" as unknown as LobbyFilter;
    expect(filterMatches(matches, unknown).map((m) => m.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
  });

  it("est immutable (ne mute pas le tableau d'entree)", () => {
    const original = [...matches];
    filterMatches(matches, "ended");
    expect(matches).toEqual(original);
  });
});

describe("countMyTurn", () => {
  it("compte uniquement les matchs actifs ou c'est mon tour", () => {
    const matches: MatchSummary[] = [
      makeMatch({ status: "active", isMyTurn: true }),
      makeMatch({ status: "active", isMyTurn: true }),
      makeMatch({ status: "active", isMyTurn: false }),
      makeMatch({ status: "pending", isMyTurn: true }),
      makeMatch({ status: "ended", isMyTurn: true }),
    ];
    expect(countMyTurn(matches)).toBe(2);
  });

  it("retourne 0 si aucun match ne match", () => {
    expect(countMyTurn([])).toBe(0);
    expect(
      countMyTurn([makeMatch({ status: "ended", isMyTurn: false })]),
    ).toBe(0);
  });
});
