/**
 * On the Ball (Sur le Ballon) — competence Passing BB3 Season 2/3.
 *
 * Regle officielle :
 *   "Une fois par tour d'equipe, lorsque l'entraineur adverse declare qu'un de
 *    ses joueurs effectue une action de Passe, ce joueur peut etre deplace
 *    jusqu'a trois cases avant que le jet de Passe soit effectue. Le mouvement
 *    suit les regles normales (un Esquive est requis pour quitter une zone de
 *    tacle), mais ne peut pas inclure de Saut. Le joueur doit terminer son
 *    mouvement adjacent ou sur la case cible declaree."
 *
 * Notes d'implementation :
 *   - L'usage est suivi par equipe via `state.usedOnTheBallThisTurn` (TeamId[]).
 *     Le compteur est reinitialise a chaque changement de tour (caller-side).
 *   - `executeOnTheBallMove` modelise un esquive UNIQUE au depart si le joueur
 *     se trouve dans une zone de tacle adverse. Une resolution multi-step
 *     plus precise (un esquive par sortie de zone) reste un raffinement futur.
 *   - Un echec d'esquive ne provoque PAS de turnover (le joueur n'est pas en
 *     activation : c'est une reaction). Le joueur tombe Prone a la case ciblee
 *     et subit les jets d'armure/blessure habituels.
 *   - Cette mecanique ne ramasse pas la balle ni ne tente l'interception ;
 *     ces actions restent gerees par la sequence de Passe normale apres le
 *     repositionnement.
 */

import type { GameState, Player, Position, RNG, TeamId } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { inBounds, isPositionOccupied, samePos, getAdjacentOpponents } from './movement';
import { performDodgeRoll, performArmorRoll } from '../utils/dice';
import { performInjuryRoll } from './injury';
import { createLogEntry } from '../utils/logging';

/** Cle pour le log structure */
const SKILL_KEY = 'on-the-ball';

/**
 * Indique si une equipe a deja utilise On the Ball dans le tour courant.
 */
export function hasUsedOnTheBallThisTurn(state: GameState, team: TeamId): boolean {
  return (state.usedOnTheBallThisTurn ?? []).includes(team);
}

/**
 * Marque l'equipe comme ayant utilise On the Ball ce tour. Immuable, idempotent.
 */
export function markOnTheBallUsed(state: GameState, team: TeamId): GameState {
  const current = state.usedOnTheBallThisTurn ?? [];
  if (current.includes(team)) return state;
  return { ...state, usedOnTheBallThisTurn: [...current, team] };
}

/**
 * Reinitialise la liste des equipes ayant utilise On the Ball (a appeler en
 * debut/fin de tour).
 */
export function resetOnTheBallUsage(state: GameState): GameState {
  return { ...state, usedOnTheBallThisTurn: [] };
}

/**
 * Indique si un joueur peut declencher On the Ball maintenant.
 */
export function canTriggerOnTheBall(state: GameState, player: Player): boolean {
  if (!hasSkill(player, 'on-the-ball')) return false;
  if (player.stunned) return false;
  if (player.state !== undefined && player.state !== 'active') return false;
  if (hasUsedOnTheBallThisTurn(state, player.team)) return false;
  return true;
}

/**
 * Liste les joueurs adverses eligibles pour reagir a une Passe de l'equipe
 * active `activeTeam`.
 */
export function getOnTheBallReactivePlayers(
  state: GameState,
  activeTeam: TeamId,
): Player[] {
  const opposing: TeamId = activeTeam === 'A' ? 'B' : 'A';
  if (hasUsedOnTheBallThisTurn(state, opposing)) return [];
  return state.players.filter(p => p.team === opposing && canTriggerOnTheBall(state, p));
}

/**
 * Calcule les cases atteignables via On the Ball (mouvement de 1 a `maxSquares`
 * cases, distance Chebyshev). Filtre les cases hors-bord et occupees.
 *
 * Si `targetPos` est fourni, ne renvoie que les cases adjacentes ou identiques
 * a `targetPos` (regle BB3 : terminer adjacent ou sur la case cible declaree).
 */
export function getOnTheBallReachableSquares(
  state: GameState,
  player: Player,
  targetPos?: Position,
  maxSquares: number = 3,
): Position[] {
  const result: Position[] = [];
  for (let dx = -maxSquares; dx <= maxSquares; dx++) {
    for (let dy = -maxSquares; dy <= maxSquares; dy++) {
      const cheb = Math.max(Math.abs(dx), Math.abs(dy));
      if (cheb === 0 || cheb > maxSquares) continue;
      const pos: Position = { x: player.pos.x + dx, y: player.pos.y + dy };
      if (!inBounds(state, pos)) continue;
      if (isPositionOccupied(state, pos)) continue;
      if (targetPos) {
        const tdx = Math.abs(pos.x - targetPos.x);
        const tdy = Math.abs(pos.y - targetPos.y);
        if (Math.max(tdx, tdy) > 1) continue;
      }
      result.push(pos);
    }
  }
  return result;
}

/**
 * Calcule les modificateurs d'esquive pour un depart depuis `from`.
 * BB3 standard : +1 base + Dodge skill bonus est gere ailleurs ; ici on
 * applique le malus de zones de tacle adverses uniquement (1 par adversaire
 * adjacent au depart, hors le joueur lui-meme).
 *
 * Note : la mecanique d'esquive deja existante (`actions.ts`) compte ce
 * malus + un bonus +1 base pour BB3. Pour rester aligne sur l'API publique,
 * on renvoie un modificateur "net" : +1 (BB3) - nbAdjacentOpponents.
 */
function calculateOnTheBallDodgeModifiers(state: GameState, player: Player): number {
  const opponents = getAdjacentOpponents(state, player.pos, player.team);
  return 1 - opponents.length;
}

/**
 * Execute le deplacement On the Ball.
 *
 * - Verifie l'eligibilite (`canTriggerOnTheBall`) et la legalite de la
 *   destination (Chebyshev <= 3, libre, dans le terrain).
 * - Si le joueur quitte une zone de tacle (au moins 1 adversaire adjacent
 *   au depart), un test d'esquive unique est resolu.
 * - Echec d'esquive : le joueur tombe Prone a la destination, jets d'armure
 *   et blessure si l'armure est percee. **Pas de turnover** (reaction).
 * - Marque l'equipe comme ayant utilise On the Ball ce tour.
 *
 * Retourne l'etat inchange si la destination est invalide ou si le joueur
 * n'est pas eligible.
 */
export function executeOnTheBallMove(
  state: GameState,
  playerId: string,
  to: Position,
  rng: RNG,
): GameState {
  const idx = state.players.findIndex(p => p.id === playerId);
  if (idx === -1) return state;
  const player = state.players[idx];

  if (!canTriggerOnTheBall(state, player)) return state;

  // Validation destination
  const reachable = getOnTheBallReachableSquares(state, player);
  if (!reachable.some(pos => samePos(pos, to))) return state;

  // Determine si esquive necessaire (zone de tacle adverse au depart)
  const opponents = getAdjacentOpponents(state, player.pos, player.team);
  const dodgeRequired = opponents.length > 0;

  let next: GameState = markOnTheBallUsed(state, player.team);
  next = {
    ...next,
    gameLog: [
      ...next.gameLog,
      createLogEntry(
        'action',
        `${player.name} active Sur le Ballon (${to.x},${to.y})`,
        player.id,
        player.team,
        { skill: SKILL_KEY, to },
      ),
    ],
  };

  if (dodgeRequired) {
    const modifiers = calculateOnTheBallDodgeModifiers(next, player);
    const dodgeResult = performDodgeRoll(player, rng, modifiers);
    next = {
      ...next,
      lastDiceResult: dodgeResult,
      gameLog: [
        ...next.gameLog,
        createLogEntry(
          'dice',
          `Esquive (Sur le Ballon) : ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
          player.id,
          player.team,
          {
            diceRoll: dodgeResult.diceRoll,
            targetNumber: dodgeResult.targetNumber,
            success: dodgeResult.success,
            modifiers,
            skill: SKILL_KEY,
          },
        ),
      ],
    };

    if (!dodgeResult.success) {
      // Joueur tombe a la destination, armure + blessure si percee
      const fallenPlayers = next.players.map((p, i) =>
        i === idx ? { ...p, pos: { ...to } } : p,
      );
      next = { ...next, players: fallenPlayers };

      const armorRoll = performArmorRoll(player, rng);
      next = {
        ...next,
        gameLog: [
          ...next.gameLog,
          createLogEntry(
            'dice',
            `Armure (Sur le Ballon) : ${armorRoll.diceRoll} vs ${armorRoll.targetNumber} ${armorRoll.success ? 'tient' : 'percee'}`,
            player.id,
            player.team,
            {
              diceRoll: armorRoll.diceRoll,
              targetNumber: armorRoll.targetNumber,
              success: armorRoll.success,
              skill: SKILL_KEY,
            },
          ),
        ],
      };

      if (!armorRoll.success) {
        next = performInjuryRoll(next, player, rng);
      }
      // Pas de turnover (reaction adverse, pas activation propre)
      return next;
    }
  }

  // Mouvement reussi : deplace le joueur
  const movedPlayers = next.players.map((p, i) =>
    i === idx ? { ...p, pos: { ...to } } : p,
  );
  next = { ...next, players: movedPlayers };

  return next;
}
