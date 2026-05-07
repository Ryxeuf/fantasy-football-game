/**
 * S27.8.1 — Handlers d'actions speciales extraits de `actions.ts`.
 *
 * Six actions one-shot avec la meme structure (lookup attaquant +
 * cible eventuelle, gates `team`/`hasPlayerActed`/`can*`, execution
 * via la mecanique dediee, marquage `setPlayerAction` puis
 * `checkPlayerTurnEnd`). Aucune dependance entre handlers : ce
 * module est purement compose de fonctions independantes.
 *
 * Reduction de bruit dans `actions.ts` : ~125 lignes en moins, sans
 * changement de comportement (smoke tests dans `actions.test.ts` +
 * tests dedies de chaque mecanique inchanges).
 */

import type { GameState, RNG, Position } from '../core/types';
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
} from '../core/game-state';
import { canHypnoticGaze, executeHypnoticGaze } from '../mechanics/hypnotic-gaze';
import {
  canProjectileVomit,
  executeProjectileVomit,
} from '../mechanics/projectile-vomit';
import { canStab, executeStab } from '../mechanics/stab';
import { canChainsaw, executeChainsaw } from '../mechanics/chainsaw';
import { canBallAndChain, executeBallAndChain } from '../mechanics/ball-and-chain';
import { canBombThrow, executeBombThrow } from '../mechanics/bombardier';

/**
 * Gere une action de Regard Hypnotique (Hypnotic Gaze).
 */
export function handleHypnoticGaze(
  state: GameState,
  move: { type: 'HYPNOTIC_GAZE'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const gazer = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!gazer || !target) return state;
  if (gazer.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, gazer.id)) return state;
  if (!canHypnoticGaze(state, gazer, target)) return state;

  let newState = executeHypnoticGaze(state, gazer, target, rng);
  newState = setPlayerAction(newState, gazer.id, 'HYPNOTIC_GAZE');
  newState = checkPlayerTurnEnd(newState, gazer.id);
  return newState;
}

/**
 * Gere une action de Vomissement Projectile (Projectile Vomit).
 */
export function handleProjectileVomit(
  state: GameState,
  move: { type: 'PROJECTILE_VOMIT'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const vomiter = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!vomiter || !target) return state;
  if (vomiter.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, vomiter.id)) return state;
  if (!canProjectileVomit(state, vomiter, target)) return state;

  let newState = executeProjectileVomit(state, vomiter, target, rng);
  newState = setPlayerAction(newState, vomiter.id, 'PROJECTILE_VOMIT');
  newState = checkPlayerTurnEnd(newState, vomiter.id);
  return newState;
}

/**
 * Gere une action de Poignard (Stab).
 */
export function handleStab(
  state: GameState,
  move: { type: 'STAB'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const stabber = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!stabber || !target) return state;
  if (stabber.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, stabber.id)) return state;
  if (!canStab(state, stabber, target)) return state;

  let newState = executeStab(state, stabber, target, rng);
  newState = setPlayerAction(newState, stabber.id, 'STAB');
  newState = checkPlayerTurnEnd(newState, stabber.id);
  return newState;
}

/**
 * Gere une action de Tronconneuse (Chainsaw).
 */
export function handleChainsaw(
  state: GameState,
  move: { type: 'CHAINSAW'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!attacker || !target) return state;
  if (attacker.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, attacker.id)) return state;
  if (!canChainsaw(state, attacker, target)) return state;

  let newState = executeChainsaw(state, attacker, target, rng);
  newState = setPlayerAction(newState, attacker.id, 'CHAINSAW');
  newState = checkPlayerTurnEnd(newState, attacker.id);
  return newState;
}

/**
 * Gere une action Ball and Chain (Chaine et Boulet).
 * Remplace le Move normal du Fanatic : deplacement aleatoire automatique.
 */
export function handleBallAndChain(
  state: GameState,
  move: { type: 'BALL_AND_CHAIN'; playerId: string },
  rng: RNG,
): GameState {
  const player = state.players.find((p) => p.id === move.playerId);
  if (!player) return state;
  if (player.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, player.id)) return state;
  if (!canBallAndChain(state, move.playerId)) return state;

  let newState = executeBallAndChain(state, move.playerId, rng);
  newState = setPlayerAction(newState, move.playerId, 'MOVE');
  newState = checkPlayerTurnEnd(newState, move.playerId);
  return newState;
}

/**
 * Gere une action Bomb Throw (Lancer de Bombe) pour un Bombardier.
 */
export function handleBombThrow(
  state: GameState,
  move: { type: 'BOMB_THROW'; playerId: string; target: Position },
  rng: RNG,
): GameState {
  const player = state.players.find((p) => p.id === move.playerId);
  if (!player) return state;
  if (player.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, player.id)) return state;
  if (!canBombThrow(state, move.playerId, move.target)) return state;

  let newState = executeBombThrow(state, move.playerId, move.target, rng);
  newState = setPlayerAction(newState, move.playerId, 'BOMB_THROW');
  newState = checkPlayerTurnEnd(newState, move.playerId);
  return newState;
}
