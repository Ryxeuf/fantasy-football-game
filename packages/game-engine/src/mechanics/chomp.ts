/**
 * Grande Gueule (Monstrous Mouth), texte 2025 — Action Spéciale de Croquement.
 *
 * Le joueur choisit un adversaire Debout qu'il Marque et jette un D6 : sur 3+,
 * la cible est Croquée et ne peut plus quitter sa case tant que CE joueur la
 * Marque. L'effet prend fin dès qu'il ne la Marque plus, quelle qu'en soit la
 * raison, et ne revient pas s'il la Marque à nouveau : il se purge donc après
 * chaque coup (`clearExpiredChomps`).
 *
 * « Quitter sa case » vise les déplacements du joueur (Mouvement, Esquive,
 * Saut, Blitz, Filature, Sur le Ballon, Lancer de Coéquipier). Une poussée
 * subie reste possible : elle rompt le Marquage, donc l'effet.
 */

import type { GameState, Move, Player, RNG } from '../core/types';
import { isSeason2Rules } from '../core/ruleset';
import { hasSkill } from '../skills/skill-effects';
import { rollD6 } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { getAdjacentOpponents } from './movement';

/** Seuil du D6 pour Croquer. */
export const CHOMP_TARGET = 3;

const LEAVING_MOVE_TYPES: ReadonlySet<Move['type']> = new Set<Move['type']>([
  'MOVE',
  'LEAP',
  'DODGE',
  'BLITZ',
  'BALL_AND_CHAIN',
  'ON_THE_BALL_MOVE',
]);

export function hasMonstrousMouth(player: Player): boolean {
  return (
    hasSkill(player, 'monstrous-mouth') || hasSkill(player, 'monstrous_mouth')
  );
}

function isOnPitch(player: Player): boolean {
  return player.pos.x >= 0 && player.pos.y >= 0;
}

function isStanding(player: Player): boolean {
  return !player.stunned && (player.state === undefined || player.state === 'active');
}

/** `markerId` Marque-t-il `target` ? (mêmes exclusions que les zones de tacle) */
function isMarkedBy(state: GameState, target: Player, markerId: string): boolean {
  return (
    isOnPitch(target) &&
    getAdjacentOpponents(state, target.pos, target.team).some(
      (opponent) => opponent.id === markerId && isOnPitch(opponent),
    )
  );
}

/** Le joueur est-il Croqué, donc cloué sur sa case ? */
export function isChomped(state: GameState, player: Player): boolean {
  return (player.chompedBy ?? []).some((id) => isMarkedBy(state, player, id));
}

/** Le coup ferait-il quitter sa case à un joueur Croqué ? */
export function isMoveBlockedByChomp(state: GameState, move: Move): boolean {
  if (!LEAVING_MOVE_TYPES.has(move.type) || !('playerId' in move)) return false;
  const player = state.players.find((p) => p.id === move.playerId);
  return player !== undefined && isChomped(state, player);
}

/** Croquement possible ? Absent au texte 2020 (Saison 2). */
export function canChomp(
  state: GameState,
  chomper: Player,
  target: Player,
): boolean {
  if (isSeason2Rules(state.ruleset)) return false;
  if (!hasMonstrousMouth(chomper)) return false;
  if (chomper.team === target.team) return false;
  if (!isStanding(chomper) || !isStanding(target)) return false;
  if ((target.chompedBy ?? []).includes(chomper.id)) return false;
  return isMarkedBy(state, target, chomper.id);
}

/** Jette le D6 du Croquement ; l'activation du joueur s'arrête là. */
export function executeChomp(
  state: GameState,
  chomper: Player,
  target: Player,
  rng: RNG,
): GameState {
  const roll = rollD6(rng);
  const success = roll >= CHOMP_TARGET;
  const log = createLogEntry(
    'dice',
    `Croquement de ${chomper.name} sur ${target.name}: ${roll}/${CHOMP_TARGET} ${success ? '✓' : '✗'}`,
    chomper.id,
    chomper.team,
    { diceRoll: roll, targetNumber: CHOMP_TARGET, success, skill: 'monstrous-mouth' },
  );
  return {
    ...state,
    gameLog: [...state.gameLog, log],
    players: state.players.map((p) => {
      if (p.id === chomper.id) return { ...p, pm: 0, gfiUsed: 2 };
      if (p.id === target.id && success) {
        return { ...p, chompedBy: [...(p.chompedBy ?? []), chomper.id] };
      }
      return p;
    }),
  };
}

/** Retire les Croquements dont l'auteur ne Marque plus sa cible. */
export function clearExpiredChomps(state: GameState): GameState {
  let changed = false;
  const players = state.players.map((player) => {
    if (!player.chompedBy) return player;
    const remaining = player.chompedBy.filter((id) =>
      isMarkedBy(state, player, id),
    );
    if (remaining.length === player.chompedBy.length) return player;
    changed = true;
    if (remaining.length > 0) return { ...player, chompedBy: remaining };
    const { chompedBy: _expired, ...released } = player;
    return released;
  });
  return changed ? { ...state, players } : state;
}
