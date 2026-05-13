/**
 * Lot 3.E.2 — densification de la séquence full-replay.
 *
 * Le full driver émet 1 `Move` par action game-engine, ce qui inclut
 * beaucoup de moves de "choix tactique" (BLOCK_CHOOSE, PUSH_CHOOSE,
 * FOLLOW_UP_CHOOSE, REROLL_CHOOSE, APOTHECARY_CHOOSE, ...) qui ne
 * changent rien de visuellement perceptible sur le terrain. Visionnés
 * à 1 move/seconde, ces filler ralentissent inutilement la lecture
 * d'un match (~150 moves bruts vs ~60 moves "intéressants").
 *
 * Ce module fournit :
 * - `isFillerMove(move)` : prédicat pur sur le type de move.
 * - `compactReplaySequence({ moves, states })` : produit une séquence
 *   filtrée + le tableau des indices originaux, utile pour mapper un
 *   index compact vers un event MatchEvent[] non filtré.
 *
 * Sémantique : on retire les moves filler et leurs states associés.
 * L'état final reste cohérent : `compactStates[k]` est l'état après
 * application du k-ième move non-filler, qui inclut implicitement les
 * effets des fillers situés entre lui et le précédent move non-filler.
 */

import type { GameState, Move } from "@bb/game-engine";

const FILLER_MOVE_TYPES: ReadonlySet<Move["type"]> = new Set<Move["type"]>([
  "BLOCK_CHOOSE",
  "PUSH_CHOOSE",
  "FOLLOW_UP_CHOOSE",
  "REROLL_CHOOSE",
  "APOTHECARY_CHOOSE",
  "DUMP_OFF_CHOOSE",
]);

export function isFillerMove(move: Move | null | undefined): boolean {
  if (!move) return false;
  return FILLER_MOVE_TYPES.has(move.type);
}

export interface CompactReplayInput {
  readonly moves: readonly Move[];
  readonly states: readonly GameState[];
}

export interface CompactReplayOutput {
  readonly moves: readonly Move[];
  readonly states: readonly GameState[];
  /** Index original (dans `input.moves`) du k-ième move compact. */
  readonly originalIndices: readonly number[];
}

export function compactReplaySequence(
  input: CompactReplayInput,
): CompactReplayOutput {
  const moves: Move[] = [];
  const states: GameState[] = [];
  const originalIndices: number[] = [];
  for (let i = 0; i < input.moves.length; i += 1) {
    const move = input.moves[i];
    if (isFillerMove(move)) continue;
    moves.push(move);
    states.push(input.states[i]);
    originalIndices.push(i);
  }
  return { moves, states, originalIndices };
}
