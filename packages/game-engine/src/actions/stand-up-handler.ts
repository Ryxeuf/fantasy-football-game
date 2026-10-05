/**
 * Lot 1 « match complet » — action « se relever » (STAND_UP).
 *
 * Règle BB 2020/2025 : un joueur À TERRE (Prone) peut se relever au début
 * de son activation. Cela coûte 3 PM (toute l'allocation si MA < 3) ; un
 * joueur avec *Jump Up* se relève gratuitement. Après s'être relevé, le
 * joueur poursuit son activation normalement (déplacement, blitz…).
 *
 * Avant ce handler, aucun chemin ne remettait `stunned` à `false` pendant
 * un drive : un joueur plaqué était perdu jusqu'au touchdown ou à la
 * mi-temps (mesuré : 0 relevé sur 96 mises à terre). Cf.
 * `docs/roadmap/explorations/2026-10-05-pro-league-match-integral.md`.
 */

import type { GameState } from '../core/types';
import { canPlayerStandUp, setPlayerAction } from '../core/game-state';
import { hasSkill } from '../skills/skill-effects';
import { createLogEntry } from '../utils/logging';

/** Coût en PM pour se relever (règle p.44). */
export const STAND_UP_COST = 3;

export function handleStandUp(
  state: GameState,
  move: { type: 'STAND_UP'; playerId: string },
): GameState {
  if (!canPlayerStandUp(state, move.playerId)) return state;
  const player = state.players.find((p) => p.id === move.playerId);
  if (!player) return state;

  const free = hasSkill(player, 'jump-up');
  const cost = free ? 0 : STAND_UP_COST;
  const newPm = Math.max(0, player.pm - cost);

  const log = createLogEntry(
    'action',
    free
      ? `${player.name} se relève d'un bond (Jump Up)`
      : `${player.name} se relève (${cost} PM)`,
    player.id,
    player.team,
    { standUp: true, cost },
  );

  const stood: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === player.id ? { ...p, stunned: false, state: 'active' as const, pm: newPm } : p,
    ),
    selectedPlayerId: player.id,
    gameLog: [...state.gameLog, log],
  };

  // L'activation commence par le relevé : on la marque comme une action de
  // Mouvement pour que le joueur puisse continuer (ou blitzer au contact).
  return setPlayerAction(stood, player.id, 'MOVE');
}
