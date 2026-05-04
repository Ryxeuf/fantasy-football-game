/**
 * S27.2 — Tests du helper `processThrowTeamMateClick` (mobile).
 *
 * Port de la logique web `handle-throw-team-mate-click.ts` (S26.0q)
 * pour donner la parite Throw Team-Mate sur mobile. Logique pure :
 *  - Phase 1 : selectionne un coequipier lancable.
 *  - Phase 2 : selectionne la case d'arrivee et retourne le Move legal.
 *
 * Conserve l'API "decision" (no-op si flow inactif) pour que le caller
 * puisse decider d'enchainer ou de short-circuit.
 */

import { describe, it, expect } from "vitest";
import {
  processThrowTeamMateClick,
  type ThrowTeamMateClickResult,
  type LegalThrow,
} from "./throw-team-mate-click";
import type { GameState, Player, Position } from "@bb/game-engine";

function makePlayer(
  id: string,
  team: "A" | "B",
  pos: Position,
): Player {
  return {
    id,
    team,
    name: id,
    pos,
    stunned: false,
    casualty: false,
    knockedOut: false,
    onPitch: true,
    activated: false,
    movementUsed: 0,
    state: "standing",
    statsBase: { ma: 6, st: 3, ag: 3, av: 8 },
    skills: [],
  } as unknown as Player;
}

function makeState(
  selectedPlayerId: string,
  players: Player[],
  currentPlayer: "A" | "B" = "A",
): GameState {
  return {
    width: 26,
    height: 15,
    players,
    currentPlayer,
    selectedPlayerId,
  } as unknown as GameState;
}

const thrower = makePlayer("p1", "A", { x: 5, y: 5 });
const teammate = makePlayer("p2", "A", { x: 6, y: 5 });
const enemy = makePlayer("e1", "B", { x: 7, y: 5 });

const legal: LegalThrow[] = [
  {
    type: "THROW_TEAM_MATE",
    playerId: "p1",
    thrownPlayerId: "p2",
    targetPos: { x: 8, y: 5 },
  },
  {
    type: "THROW_TEAM_MATE",
    playerId: "p1",
    thrownPlayerId: "p2",
    targetPos: { x: 9, y: 5 },
  },
];

describe("processThrowTeamMateClick (S27.2)", () => {
  it("inactif : retourne `inactive` quand currentAction n'est pas THROW_TEAM_MATE", () => {
    const r = processThrowTeamMateClick({
      pos: { x: 6, y: 5 },
      state: makeState("p1", [thrower, teammate]),
      legal,
      currentAction: null,
      throwTeamMateThrownId: null,
    });
    expect(r.kind).toBe("inactive");
  });

  it("Phase 1 : selectionne le coequipier lancable", () => {
    const r = processThrowTeamMateClick({
      pos: { x: 6, y: 5 },
      state: makeState("p1", [thrower, teammate, enemy]),
      legal,
      currentAction: "THROW_TEAM_MATE",
      throwTeamMateThrownId: null,
    });
    expect(r.kind).toBe("selectThrown");
    if (r.kind === "selectThrown") expect(r.thrownPlayerId).toBe("p2");
  });

  it("Phase 1 : ignore un clic sur ennemi ou sur soi-meme", () => {
    const onSelf = processThrowTeamMateClick({
      pos: { x: 5, y: 5 },
      state: makeState("p1", [thrower, teammate]),
      legal,
      currentAction: "THROW_TEAM_MATE",
      throwTeamMateThrownId: null,
    });
    expect(onSelf.kind).toBe("noop");

    const onEnemy = processThrowTeamMateClick({
      pos: { x: 7, y: 5 },
      state: makeState("p1", [thrower, teammate, enemy]),
      legal,
      currentAction: "THROW_TEAM_MATE",
      throwTeamMateThrownId: null,
    });
    expect(onEnemy.kind).toBe("noop");
  });

  it("Phase 2 : retourne le Move legal quand la cible est en portee", () => {
    const r = processThrowTeamMateClick({
      pos: { x: 8, y: 5 },
      state: makeState("p1", [thrower, teammate]),
      legal,
      currentAction: "THROW_TEAM_MATE",
      throwTeamMateThrownId: "p2",
    });
    expect(r.kind).toBe("submit");
    if (r.kind === "submit") {
      expect(r.move.type).toBe("THROW_TEAM_MATE");
      expect(r.move.targetPos).toEqual({ x: 8, y: 5 });
    }
  });

  it("Phase 2 : noop si la case n'est pas dans les options legales (hors portee)", () => {
    const r = processThrowTeamMateClick({
      pos: { x: 20, y: 5 },
      state: makeState("p1", [thrower, teammate]),
      legal,
      currentAction: "THROW_TEAM_MATE",
      throwTeamMateThrownId: "p2",
    });
    expect(r.kind).toBe("noop");
  });

  it("inactif si selectedPlayerId est null", () => {
    const state = makeState("", [thrower, teammate]);
    (state as unknown as { selectedPlayerId: null }).selectedPlayerId = null;
    const r = processThrowTeamMateClick({
      pos: { x: 6, y: 5 },
      state,
      legal,
      currentAction: "THROW_TEAM_MATE",
      throwTeamMateThrownId: null,
    });
    expect(r.kind).toBe("inactive");
  });
});
