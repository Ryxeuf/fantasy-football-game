/**
 * Pure helper functions for Block/Push/FollowUp popup logic in online matches.
 * These are stateless utilities that check GameState pending fields and build moves.
 */
import type { GameState, Move, Position, Player, BlockResult } from "@bb/game-engine";

// --- Pending state type guards ---

export function shouldShowBlockPopup(state: GameState): boolean {
  return !!state.pendingBlock;
}

export function shouldShowPushPopup(state: GameState): boolean {
  return !!state.pendingPushChoice;
}

export function shouldShowFollowUpPopup(state: GameState): boolean {
  return !!state.pendingFollowUpChoice;
}

// --- Move builders ---

export function buildBlockChooseMove(
  pending: NonNullable<GameState["pendingBlock"]>,
  result: BlockResult,
): Move {
  return {
    type: "BLOCK_CHOOSE",
    playerId: pending.attackerId,
    targetId: pending.targetId,
    result,
  } as Move;
}

export function buildPushChooseMove(
  pending: NonNullable<GameState["pendingPushChoice"]>,
  direction: Position,
): Move {
  return {
    type: "PUSH_CHOOSE",
    playerId: pending.attackerId,
    targetId: pending.targetId,
    direction,
  } as Move;
}

export function buildFollowUpChooseMove(
  pending: NonNullable<GameState["pendingFollowUpChoice"]>,
  followUp: boolean,
): Move {
  return {
    type: "FOLLOW_UP_CHOOSE",
    playerId: pending.attackerId,
    targetId: pending.targetId,
    followUp,
  } as Move;
}

// --- Block target computation ---

export function computeBlockTargets(
  selectedPlayerId: string | null,
  legalMoves: Move[],
  players: Player[],
): Position[] {
  if (!selectedPlayerId) return [];

  return legalMoves
    .filter(
      (m): m is Extract<Move, { type: "BLOCK" }> =>
        m.type === "BLOCK" && (m as any).playerId === selectedPlayerId,
    )
    .map((m) => {
      const target = players.find((p) => p.id === (m as any).targetId);
      return target ? target.pos : null;
    })
    .filter((pos): pos is Position => pos !== null);
}
