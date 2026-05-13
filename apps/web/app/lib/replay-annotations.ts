/**
 * Lot 3.E.3 — annotations on-pitch dérivées d'un `Move`.
 *
 * Helper pur qui, à partir du `Move` courant + l'état précédent + l'état
 * courant, retourne une liste typée d'annotations à afficher en
 * overlay SVG sur le terrain Pixi :
 *
 * - `movement` : flèche from→to (MOVE, LEAP, DODGE, ON_THE_BALL_MOVE)
 * - `blitz`    : flèche from→to + halo cible (BLITZ)
 * - `block`    : halo attaquant + halo cible (BLOCK, MULTI_BLOCK, FOUL)
 * - `pass`     : ligne pointillée passeur → cible (PASS, HANDOFF, BOMB_THROW)
 *
 * Le rendu (SVG) est responsable de l'interprétation visuelle ; ce
 * module reste 100% logique pour rester unit-testable.
 */

import type { GameState, Move, Position } from "@bb/game-engine";

export type AnnotationKind = "movement" | "blitz" | "block" | "pass";

export interface MovementAnnotation {
  readonly kind: "movement";
  readonly from: Position;
  readonly to: Position;
  readonly team: "A" | "B" | null;
  readonly variant: "MOVE" | "LEAP" | "DODGE";
}

export interface BlitzAnnotation {
  readonly kind: "blitz";
  readonly from: Position;
  readonly to: Position;
  readonly targetPos: Position;
  readonly team: "A" | "B" | null;
}

export interface BlockAnnotation {
  readonly kind: "block";
  readonly attackerPos: Position;
  readonly targetPositions: readonly Position[];
  readonly team: "A" | "B" | null;
  readonly variant: "BLOCK" | "MULTI_BLOCK" | "FOUL";
}

export interface PassAnnotation {
  readonly kind: "pass";
  readonly from: Position;
  readonly to: Position;
  readonly team: "A" | "B" | null;
  readonly variant: "PASS" | "HANDOFF" | "BOMB_THROW";
}

export type ReplayAnnotation =
  | MovementAnnotation
  | BlitzAnnotation
  | BlockAnnotation
  | PassAnnotation;

interface PlayerLite {
  readonly id: string;
  readonly team?: "A" | "B";
  readonly pos: Position;
}

function findPlayer(state: GameState | null, id: string | null): PlayerLite | null {
  if (!state || !id) return null;
  const players = (state as { players?: readonly PlayerLite[] }).players;
  if (!players) return null;
  return players.find((p) => p.id === id) ?? null;
}

function teamOf(player: PlayerLite | null): "A" | "B" | null {
  return player?.team ?? null;
}

/**
 * Calcule les annotations à afficher pour un `Move` donné.
 *
 * @param move        Move courant (typiquement `useFullReplay.currentMove`)
 * @param prevState   État *avant* le move (states[i-1] ou initialState)
 * @param currState   État *après* le move (states[i])
 */
export function getReplayAnnotations(
  move: Move | null | undefined,
  prevState: GameState | null,
  currState: GameState | null,
): readonly ReplayAnnotation[] {
  if (!move || !prevState) return [];

  switch (move.type) {
    case "MOVE":
    case "LEAP":
    case "ON_THE_BALL_MOVE": {
      const actor = findPlayer(prevState, move.playerId);
      if (!actor) return [];
      return [
        {
          kind: "movement",
          from: actor.pos,
          to: move.to,
          team: teamOf(actor),
          variant: move.type === "LEAP" ? "LEAP" : "MOVE",
        },
      ];
    }

    case "DODGE": {
      const actor = findPlayer(prevState, move.playerId);
      return [
        {
          kind: "movement",
          from: move.from,
          to: move.to,
          team: teamOf(actor),
          variant: "DODGE",
        },
      ];
    }

    case "BLITZ": {
      const actor = findPlayer(prevState, move.playerId);
      const target = findPlayer(prevState, move.targetId);
      if (!actor || !target) return [];
      return [
        {
          kind: "blitz",
          from: actor.pos,
          to: move.to,
          targetPos: target.pos,
          team: teamOf(actor),
        },
      ];
    }

    case "BLOCK": {
      const actor = findPlayer(prevState, move.playerId);
      const target = findPlayer(prevState, move.targetId);
      if (!actor || !target) return [];
      return [
        {
          kind: "block",
          attackerPos: actor.pos,
          targetPositions: [target.pos],
          team: teamOf(actor),
          variant: "BLOCK",
        },
      ];
    }

    case "MULTI_BLOCK": {
      const actor = findPlayer(prevState, move.playerId);
      const t1 = findPlayer(prevState, move.firstTargetId);
      const t2 = findPlayer(prevState, move.secondTargetId);
      if (!actor) return [];
      const targets: Position[] = [];
      if (t1) targets.push(t1.pos);
      if (t2) targets.push(t2.pos);
      if (targets.length === 0) return [];
      return [
        {
          kind: "block",
          attackerPos: actor.pos,
          targetPositions: targets,
          team: teamOf(actor),
          variant: "MULTI_BLOCK",
        },
      ];
    }

    case "FOUL": {
      const actor = findPlayer(prevState, move.playerId);
      const target = findPlayer(prevState, move.targetId);
      if (!actor || !target) return [];
      return [
        {
          kind: "block",
          attackerPos: actor.pos,
          targetPositions: [target.pos],
          team: teamOf(actor),
          variant: "FOUL",
        },
      ];
    }

    case "PASS":
    case "HANDOFF": {
      const passer = findPlayer(prevState, move.playerId);
      const receiver =
        findPlayer(prevState, move.targetId) ??
        findPlayer(currState, move.targetId);
      if (!passer || !receiver) return [];
      return [
        {
          kind: "pass",
          from: passer.pos,
          to: receiver.pos,
          team: teamOf(passer),
          variant: move.type,
        },
      ];
    }

    case "BOMB_THROW": {
      const actor = findPlayer(prevState, move.playerId);
      if (!actor) return [];
      return [
        {
          kind: "pass",
          from: actor.pos,
          to: move.target,
          team: teamOf(actor),
          variant: "BOMB_THROW",
        },
      ];
    }

    default:
      return [];
  }
}
