/**
 * Mecanique de Bombardier (Bomb Throw) pour Blood Bowl — BB3 Season 2/3 /
 * Blood Bowl 2020.
 *
 * Resume:
 * - Un joueur avec `bombardier` peut effectuer une action speciale "Lancer de
 *   Bombe" a la place d'un blocage.
 * - La cible est une case du terrain dans la portee Quick ou Short (1 a 6
 *   cases Chebyshev). Long / Long Bomb non autorises.
 * - Jet de D6 contre la PA du lanceur, modifie par la portee (Quick +1,
 *   Short 0).
 * - Fumble (jet brut = 1) : la bombe explose sur la case du Bombardier
 *   lui-meme. Armor roll +1 sur le Bombardier, puis jet de blessure si
 *   percee.
 * - Echec non-fumble : la bombe devie d'une case dans une direction aleatoire
 *   (D8) depuis la cible, puis explose sur la case atteinte.
 * - Succes : la bombe explose directement sur la case cible.
 * - Impact : tout joueur sur la case finale subit un jet d'armure avec
 *   modificateur +1 (BOMB_ARMOR_BONUS). Armure percee -> jet de blessure.
 * - Pas de turnover (regle officielle BB2020).
 * - `pm = 0` apres l'action.
 *
 * Utilisateur principal : Goblin Bomma + Star Players bombardier.
 */

import type { GameState, Player, Position, RNG, DiceResult } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { rollD6, performArmorRoll } from '../utils/dice';
import { performInjuryRoll } from './injury';
import { getRandomDirection } from './ball';
import { inBounds } from './movement';
import { createLogEntry } from '../utils/logging';
import { getPassRange, getPassRangeModifier } from './passing';

export const BOMB_ARMOR_BONUS = 1;
export const BOMB_MAX_RANGE = 6; // Quick (1-3) + Short (4-6)

/** Predicat : le joueur possede le trait Bombardier. */
export function hasBombardier(player: Player): boolean {
  return hasSkill(player, 'bombardier');
}

/** Verifie qu'une case cible est valide pour un Lancer de Bombe. */
export function canBombThrow(
  state: GameState,
  playerId: string,
  target: Position,
): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  if (!hasBombardier(player)) return false;
  if (player.stunned) return false;
  if (player.state !== undefined && player.state !== 'active') return false;
  if (player.team !== state.currentPlayer) return false;
  if (!inBounds(state, target)) return false;
  if (target.x === player.pos.x && target.y === player.pos.y) return false;

  const dx = Math.abs(target.x - player.pos.x);
  const dy = Math.abs(target.y - player.pos.y);
  const distance = Math.max(dx, dy);
  if (distance === 0 || distance > BOMB_MAX_RANGE) return false;

  return true;
}

/** Clamp une position aux limites du terrain. */
function clampToBoard(state: GameState, pos: Position): Position {
  return {
    x: Math.max(0, Math.min(state.width - 1, pos.x)),
    y: Math.max(0, Math.min(state.height - 1, pos.y)),
  };
}

/** Applique les degats d'une explosion sur la case indiquee. */
function applyBombImpact(
  state: GameState,
  attackerId: string,
  impactPos: Position,
  rng: RNG,
): GameState {
  const victim = state.players.find(
    p => p.pos.x === impactPos.x && p.pos.y === impactPos.y,
  );
  let newState = state;

  const explosionLog = createLogEntry(
    'action',
    `La bombe explose en (${impactPos.x}, ${impactPos.y}) !`,
    attackerId,
    newState.players.find(p => p.id === attackerId)?.team,
  );
  newState = { ...newState, gameLog: [...newState.gameLog, explosionLog] };

  if (!victim) return newState;

  const armorResult = performArmorRoll(victim, rng, -BOMB_ARMOR_BONUS);
  newState = { ...newState, lastDiceResult: armorResult };

  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure de ${victim.name} (bombe +${BOMB_ARMOR_BONUS}): ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '(tient)' : '(percee)'}`,
    victim.id,
    victim.team,
    {
      diceRoll: armorResult.diceRoll,
      targetNumber: armorResult.targetNumber,
      bombBonus: BOMB_ARMOR_BONUS,
    },
  );
  newState = { ...newState, gameLog: [...newState.gameLog, armorLog] };

  if (!armorResult.success) {
    const currentVictim = newState.players.find(p => p.id === victim.id);
    if (currentVictim) {
      newState = performInjuryRoll(newState, currentVictim, rng, 0, attackerId);
    }
  }

  return newState;
}

/** Termine l'activation du lanceur (pm = 0). */
function endActivation(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, pm: 0 } : p)),
  };
}

/**
 * Execute un Lancer de Bombe.
 */
export function executeBombThrow(
  state: GameState,
  playerId: string,
  target: Position,
  rng: RNG,
): GameState {
  if (!canBombThrow(state, playerId, target)) return state;

  const bomber = state.players.find(p => p.id === playerId);
  if (!bomber) return state;

  let newState: GameState = {
    ...state,
    gameLog: [
      ...state.gameLog,
      createLogEntry(
        'action',
        `${bomber.name} lance une bombe vers (${target.x}, ${target.y}) !`,
        bomber.id,
        bomber.team,
        { skill: 'bombardier', target: { ...target } },
      ),
    ],
  };

  // Jet de lancement : D6 contre la PA, modifie par la portee.
  const range = getPassRange(bomber.pos, target); // 'quick' | 'short' (valide)
  const rangeModifier = range ? getPassRangeModifier(range) : 0;
  const diceRoll = rollD6(rng);
  const modifiers = rangeModifier;
  // target = max(2, min(6, PA - modifiers))
  const targetNumber = Math.max(2, Math.min(6, bomber.pa - modifiers));
  const fumble = diceRoll === 1;
  const success = !fumble && diceRoll >= targetNumber;

  const throwResult: DiceResult = {
    type: 'pass',
    playerId: bomber.id,
    diceRoll,
    targetNumber,
    success,
    modifiers,
  };
  newState = { ...newState, lastDiceResult: throwResult };

  const throwLog = createLogEntry(
    'dice',
    `Lancer de Bombe: ${diceRoll}/${targetNumber} ${success ? '✓' : fumble ? 'FUMBLE !' : '✗'}`,
    bomber.id,
    bomber.team,
    { diceRoll, targetNumber, modifiers, fumble },
  );
  newState = { ...newState, gameLog: [...newState.gameLog, throwLog] };

  let impactPos: Position;
  if (fumble) {
    // La bombe explose sur le lanceur.
    const fumbleLog = createLogEntry(
      'action',
      `Fumble ! La bombe retombe sur ${bomber.name} !`,
      bomber.id,
      bomber.team,
    );
    newState = { ...newState, gameLog: [...newState.gameLog, fumbleLog] };
    impactPos = { ...bomber.pos };
  } else if (!success) {
    // Deviation : D8 scatter depuis la cible.
    const dir = getRandomDirection(rng);
    const scattered: Position = {
      x: target.x + dir.x,
      y: target.y + dir.y,
    };
    impactPos = clampToBoard(newState, scattered);
    const scatterLog = createLogEntry(
      'info',
      `La bombe devie vers (${impactPos.x}, ${impactPos.y}).`,
      bomber.id,
      bomber.team,
    );
    newState = { ...newState, gameLog: [...newState.gameLog, scatterLog] };
  } else {
    impactPos = { ...target };
  }

  newState = applyBombImpact(newState, bomber.id, impactPos, rng);
  return endActivation(newState, playerId);
}
