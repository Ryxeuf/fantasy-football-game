import { describe, it, expect } from "vitest";
import { rosterPlayersOf } from "./roster-players";

const ALIVE = { id: "p1", dead: false, firedAt: null };
/** Tué en match : la validation de la feuille le sort du roster. */
const DEAD_REMOVED = { id: "p2", dead: true, firedAt: "2026-08-28T10:00:00Z" };
const FIRED = { id: "p3", dead: false, firedAt: "2026-08-20T10:00:00Z" };
/** Mort antérieur à la règle « mort ⇒ hors roster » : retrait manuel. */
const LEGACY_DEAD = { id: "p4", dead: true, firedAt: null };

describe("rosterPlayersOf", () => {
  it("retire le joueur tué en match dès qu'il est sorti du roster", () => {
    expect(rosterPlayersOf([ALIVE, DEAD_REMOVED]).map((p) => p.id)).toEqual([
      "p1",
    ]);
  });

  it("retire aussi les licenciés de fin de match", () => {
    expect(rosterPlayersOf([ALIVE, FIRED]).map((p) => p.id)).toEqual(["p1"]);
  });

  it("garde un mort legacy (encore au roster) pour son retrait manuel", () => {
    expect(rosterPlayersOf([ALIVE, LEGACY_DEAD]).map((p) => p.id)).toEqual([
      "p1",
      "p4",
    ]);
  });

  it("tolère une liste absente", () => {
    expect(rosterPlayersOf(undefined)).toEqual([]);
    expect(rosterPlayersOf(null)).toEqual([]);
  });
});
