/**
 * Pure helper functions for Block/Push/FollowUp/Reroll popup logic in online matches.
 * Mirrors apps/web/app/play/[id]/hooks/useBlockPopups.ts so mobile and web share
 * the same move-building contract.
 */
import type {
  GameState,
  Move,
  Position,
  Player,
  BlockResult,
} from "@bb/game-engine";

export function shouldShowBlockPopup(state: GameState): boolean {
  return !!state.pendingBlock;
}

export function shouldShowPushPopup(state: GameState): boolean {
  return !!state.pendingPushChoice;
}

export function shouldShowFollowUpPopup(state: GameState): boolean {
  return !!state.pendingFollowUpChoice;
}

export function shouldShowRerollPopup(state: GameState): boolean {
  return !!state.pendingReroll;
}

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

export function buildRerollChooseMove(useReroll: boolean): Move {
  return { type: "REROLL_CHOOSE", useReroll } as Move;
}

export function computeBlockTargets(
  selectedPlayerId: string | null,
  legalMoves: Move[],
  players: Player[],
): Position[] {
  if (!selectedPlayerId) return [];
  return legalMoves
    .filter(
      (m): m is Extract<Move, { type: "BLOCK" }> =>
        m.type === "BLOCK" && (m as { playerId: string }).playerId === selectedPlayerId,
    )
    .map((m) => {
      const target = players.find(
        (p) => p.id === (m as { targetId: string }).targetId,
      );
      return target ? target.pos : null;
    })
    .filter((pos): pos is Position => pos !== null);
}

export interface DirectionInfo {
  label: string;
  arrow: string;
}

export function describeDirection(dir: Position): DirectionInfo {
  if (dir.x === 0 && dir.y === -1) return { label: "Nord", arrow: "↑" };
  if (dir.x === 0 && dir.y === 1) return { label: "Sud", arrow: "↓" };
  if (dir.x === -1 && dir.y === 0) return { label: "Ouest", arrow: "←" };
  if (dir.x === 1 && dir.y === 0) return { label: "Est", arrow: "→" };
  if (dir.x === -1 && dir.y === -1) return { label: "Nord-Ouest", arrow: "↖" };
  if (dir.x === 1 && dir.y === -1) return { label: "Nord-Est", arrow: "↗" };
  if (dir.x === -1 && dir.y === 1) return { label: "Sud-Ouest", arrow: "↙" };
  if (dir.x === 1 && dir.y === 1) return { label: "Sud-Est", arrow: "↘" };
  return { label: `(${dir.x}, ${dir.y})`, arrow: "?" };
}

const rollTypeLabels: Record<string, string> = {
  dodge: "Esquive",
  pickup: "Ramassage",
  gfi: "Going For It",
};

export function rollTypeLabel(rollType: string): string {
  return rollTypeLabels[rollType] ?? rollType;
}
