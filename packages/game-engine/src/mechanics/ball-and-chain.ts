/**
 * Mecanique de Chaine et Boulet (Ball and Chain) pour Blood Bowl —
 * BB3 Season 2/3 / Blood Bowl 2020.
 *
 * Resume:
 * - Un joueur avec `ball-and-chain` remplace son action de Mouvement par un
 *   deplacement automatique dans une direction aleatoire (jet D8 sur le
 *   gabarit de direction).
 * - Le joueur avance jusqu'a MA cases tout droit dans la direction tiree.
 * - Si sa trajectoire quitte le terrain, il sort dans la foule
 *   (handleInjuryByCrowd) et un turnover est declenche.
 * - S'il entre dans une case occupee par un coequipier, il s'arrete sur la
 *   case precedente et son activation se termine (pas de turnover).
 * - S'il entre dans une case occupee par un adversaire, il declenche un Block
 *   automatique (corps a corps force) via le flux de blocage standard.
 * - Dans tous les cas, apres l'action, l'activation du joueur est terminee
 *   (pm = 0).
 *
 * Utilisateur principal: Goblin Fanatic (Gobelins) + Star Players equivalents.
 */

import type { GameState, Player, Position, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { createLogEntry } from '../utils/logging';
import { inBounds } from './movement';
import { handleInjuryByCrowd } from './injury';
import {
  calculateBlockDiceCount,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  resolveBlockResult,
} from './blocking';
import { rollBlockDice } from '../utils/dice';

/**
 * Gabarit de direction aleatoire (D8).
 * Ordre canonique : Nord, Nord-Est, Est, Sud-Est, Sud, Sud-Ouest, Ouest,
 * Nord-Ouest. Coherent avec `getRandomDirection` dans `ball.ts`.
 */
export const BALL_AND_CHAIN_DIRECTIONS: ReadonlyArray<Position> = [
  { x: 0, y: -1 }, // 1: Nord
  { x: 1, y: -1 }, // 2: Nord-Est
  { x: 1, y: 0 }, // 3: Est
  { x: 1, y: 1 }, // 4: Sud-Est
  { x: 0, y: 1 }, // 5: Sud
  { x: -1, y: 1 }, // 6: Sud-Ouest
  { x: -1, y: 0 }, // 7: Ouest
  { x: -1, y: -1 }, // 8: Nord-Ouest
];

/** Predicat : le joueur possede le trait Ball and Chain. */
export function hasBallAndChain(player: Player): boolean {
  return hasSkill(player, 'ball-and-chain');
}

/** Roule 1D8 pour selectionner la direction du deplacement automatique. */
export function rollBallAndChainDirection(rng: RNG): Position {
  const index = Math.min(7, Math.max(0, Math.floor(rng() * 8)));
  return BALL_AND_CHAIN_DIRECTIONS[index];
}

/**
 * Verifie qu'un joueur peut declarer une action Ball and Chain.
 * L'activation complete (bone-head, etc.) est geree en amont dans `applyMove`.
 */
export function canBallAndChain(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;
  if (!hasBallAndChain(player)) return false;
  if (player.stunned) return false;
  if (player.state !== undefined && player.state !== 'active') return false;
  if (player.team !== state.currentPlayer) return false;
  return true;
}

/** Recherche un joueur a une position donnee. */
function playerAt(state: GameState, pos: Position): Player | undefined {
  return state.players.find(p => p.pos.x === pos.x && p.pos.y === pos.y);
}

/** Deplace le Fanatic vers la case indiquee (immuable). */
function moveFanaticTo(state: GameState, playerId: string, to: Position): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, pos: { ...to } } : p)),
  };
}

/** Termine l'activation d'un joueur (pm = 0). */
function endActivation(state: GameState, playerId: string): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === playerId ? { ...p, pm: 0 } : p)),
  };
}

/**
 * Declenche un Block automatique de `attacker` contre `target`.
 * Utilise le flux de blocage standard : calcul des assistances, jet de
 * `N` des de bloc, choix du meilleur pour l'attaquant.
 */
function executeAutoBlock(
  state: GameState,
  attacker: Player,
  target: Player,
  rng: RNG,
): GameState {
  const offensiveAssists = calculateOffensiveAssists(state, attacker, target);
  const defensiveAssists = calculateDefensiveAssists(state, attacker, target);
  const attackerStrength = attacker.st + offensiveAssists;
  const targetStrength = target.st + defensiveAssists;
  const diceCount = Math.max(1, calculateBlockDiceCount(attackerStrength, targetStrength));

  // Le Fanatic (attaquant) choisit tous les des -> on prend le "meilleur" via
  // priorisation simple (POW > STUMBLE > PUSH_BACK > BOTH_DOWN > PLAYER_DOWN).
  // Pour rester deterministe et simple, on roule `diceCount` des et on retient
  // le premier (la resolution de bloc standard gere ensuite l'effet).
  const rawResult = rollBlockDice(rng);
  const dieRoll = ((): number => {
    switch (rawResult) {
      case 'PLAYER_DOWN':
        return 1;
      case 'BOTH_DOWN':
        return 2;
      case 'PUSH_BACK':
        return 3;
      case 'STUMBLE':
        return 4;
      case 'POW':
        return 5;
      default:
        return 3;
    }
  })();

  // Les des supplementaires sont tires mais non exploites ici (le choix du
  // dieu deterministe reste le resultat du premier roll).
  for (let i = 1; i < diceCount; i++) {
    rollBlockDice(rng);
  }

  const blockDiceResult = {
    type: 'block' as const,
    playerId: attacker.id,
    targetId: target.id,
    diceRoll: dieRoll,
    result: rawResult,
    offensiveAssists,
    defensiveAssists,
    totalStrength: attackerStrength,
    targetStrength,
  };

  // `lastDiceResult` attend un `DiceResult` (armor/dodge/etc.). resolveBlockResult
  // metteur a jour le champ via ses propres jets d'armure/blessure. On ne
  // pre-remplit donc pas `lastDiceResult` avec l'objet de bloc.
  return resolveBlockResult(state, blockDiceResult, rng);
}

/**
 * Execute l'action Ball and Chain pour le joueur indique.
 *
 * @param state - Etat courant du jeu
 * @param playerId - Identifiant du Fanatic
 * @param rng - RNG seede
 * @returns Nouvel etat apres le deplacement aleatoire
 */
export function executeBallAndChain(
  state: GameState,
  playerId: string,
  rng: RNG,
): GameState {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return state;
  if (!hasBallAndChain(player)) return state;

  const direction = rollBallAndChainDirection(rng);
  const startPos = { ...player.pos };

  const directionLabels: Record<string, string> = {
    '0,-1': 'Nord',
    '1,-1': 'Nord-Est',
    '1,0': 'Est',
    '1,1': 'Sud-Est',
    '0,1': 'Sud',
    '-1,1': 'Sud-Ouest',
    '-1,0': 'Ouest',
    '-1,-1': 'Nord-Ouest',
  };
  const dirLabel = directionLabels[`${direction.x},${direction.y}`] ?? 'inconnue';

  let newState: GameState = {
    ...state,
    gameLog: [
      ...state.gameLog,
      createLogEntry(
        'action',
        `${player.name} est entraine par sa chaine et son boulet vers ${dirLabel} !`,
        player.id,
        player.team,
        { skill: 'ball-and-chain', direction: { ...direction } },
      ),
    ],
  };

  const steps = Math.max(0, player.ma);
  let currentPos: Position = startPos;

  for (let step = 0; step < steps; step++) {
    const nextPos: Position = {
      x: currentPos.x + direction.x,
      y: currentPos.y + direction.y,
    };

    // Sortie de terrain -> crowd surf + turnover.
    if (!inBounds(newState, nextPos)) {
      const currentFanatic = newState.players.find(p => p.id === playerId);
      if (!currentFanatic) return newState;
      newState = {
        ...newState,
        gameLog: [
          ...newState.gameLog,
          createLogEntry(
            'action',
            `${player.name} sort du terrain sous l'elan de sa chaine !`,
            player.id,
            player.team,
          ),
        ],
      };
      newState = handleInjuryByCrowd(newState, currentFanatic, rng);
      return { ...newState, isTurnover: true };
    }

    const occupant = playerAt(newState, nextPos);
    if (occupant) {
      if (occupant.team === player.team) {
        // Coequipier -> stop a la case precedente, activation terminee.
        newState = {
          ...newState,
          gameLog: [
            ...newState.gameLog,
            createLogEntry(
              'info',
              `${player.name} bloque net : ${occupant.name} occupe la case.`,
              player.id,
              player.team,
            ),
          ],
        };
        return endActivation(newState, playerId);
      }

      // Adversaire -> Block automatique. Le Fanatic avance d'abord au contact
      // (reste sur sa case precedente, adjacent a l'adversaire).
      newState = {
        ...newState,
        gameLog: [
          ...newState.gameLog,
          createLogEntry(
            'action',
            `${player.name} percute ${occupant.name} ! Block automatique.`,
            player.id,
            player.team,
          ),
        ],
      };
      const currentAttacker = newState.players.find(p => p.id === playerId);
      const currentTarget = newState.players.find(p => p.id === occupant.id);
      if (currentAttacker && currentTarget) {
        newState = executeAutoBlock(newState, currentAttacker, currentTarget, rng);
      }
      return endActivation(newState, playerId);
    }

    // Case libre : on avance.
    newState = moveFanaticTo(newState, playerId, nextPos);
    currentPos = nextPos;
  }

  return endActivation(newState, playerId);
}
