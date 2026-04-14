/**
 * Mécanique de Délestage (Dump-off) pour Blood Bowl — BB3 Season 2/3.
 *
 * Règles :
 * - Déclenchement : lorsque ce joueur est **désigné comme cible d'une action
 *   de Blocage** (ou Blitz) et qu'il **possède le ballon**, il peut
 *   immédiatement effectuer une action de **Passe Rapide** (Quick Pass)
 *   — interrompant l'activation du joueur adverse effectuant le blocage.
 * - Un seul Dump-off par blocage/blitz.
 * - La passe est une **Passe Rapide** (portée 1-3 cases uniquement).
 * - Les modificateurs classiques s'appliquent (adversaires en zone de tacle
 *   du passeur/receveur), ainsi que les interceptions.
 * - **Ne provoque JAMAIS de turnover** si la passe ou la réception échoue
 *   — le ballon rebondit simplement à l'endroit indiqué (rebond normal).
 *   Note : un turnover peut tout de même résulter d'un rebond en zone
 *   adverse, ce qui sort du cadre de cette fonction.
 * - Après résolution (succès ou échec), le blocage initial se poursuit
 *   normalement — la cible n'a alors plus le ballon.
 */

import { GameState, Player, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { getDistance, getPassRange, executePass } from './passing';
import { samePos } from './movement';
import { createLogEntry } from '../utils/logging';

/**
 * Indique si un joueur cible est éligible pour déclencher un Dump-off.
 */
export function canDumpOff(state: GameState, target: Player): boolean {
  if (!hasSkill(target, 'dump-off')) return false;
  if (!target.hasBall) return false;
  if (target.stunned) return false;
  if (target.state !== undefined && target.state !== 'active') return false;
  return true;
}

/**
 * Liste des coéquipiers pouvant recevoir un Dump-off :
 * - Même équipe, debout, actif
 * - À portée de Passe Rapide (1-3 cases)
 * - Sans `no-hands`
 */
export function getDumpOffReceivers(state: GameState, passer: Player): Player[] {
  return state.players.filter(p => {
    if (p.id === passer.id) return false;
    if (p.team !== passer.team) return false;
    if (p.stunned) return false;
    if (p.state !== undefined && p.state !== 'active') return false;
    if (samePos(p.pos, passer.pos)) return false;
    if (hasSkill(p, 'no-hands')) return false;
    const range = getPassRange(passer.pos, p.pos);
    if (range !== 'quick') return false;
    // Ignore la distance 0 (déjà filtré par samePos) et >3
    const dist = getDistance(passer.pos, p.pos);
    if (dist < 1 || dist > 3) return false;
    return true;
  });
}

/**
 * Exécute une Passe Rapide de Dump-off depuis `passerId` vers `receiverId`.
 *
 * IMPORTANT : cette fonction ré-utilise `executePass` pour la mécanique
 * mais force `isTurnover = false` à la sortie. Le Dump-off ne provoque
 * jamais de turnover côté attaquant (qui effectue le blocage), ni côté
 * défenseur (qui n'est pas en phase active).
 */
export function executeDumpOff(
  state: GameState,
  passerId: string,
  receiverId: string,
  rng: RNG,
): GameState {
  const passer = state.players.find(p => p.id === passerId);
  const receiver = state.players.find(p => p.id === receiverId);
  if (!passer || !receiver) return state;

  const announceLog = createLogEntry(
    'action',
    `Délestage (Dump-off) — ${passer.name} tente une Passe Rapide vers ${receiver.name}`,
    passer.id,
    passer.team,
    { skill: 'dump-off' },
  );
  let newState: GameState = {
    ...state,
    gameLog: [...state.gameLog, announceLog],
  };

  // Snapshot du drapeau de turnover avant la passe pour le restaurer si la
  // passe échoue (Dump-off ne cause PAS de turnover).
  const turnoverBefore = newState.isTurnover;

  newState = executePass(newState, passer, receiver, rng);

  // Dump-off ne provoque jamais de turnover (règle explicite). On restaure
  // l'état initial de `isTurnover` pour annuler les éventuels flags levés
  // par `executePass` en cas d'échec de passe/réception/interception.
  if (newState.isTurnover && !turnoverBefore) {
    newState = { ...newState, isTurnover: false };
    const noTurnoverLog = createLogEntry(
      'info',
      `Délestage — pas de turnover (règle Dump-off)`,
      passer.id,
      passer.team,
      { skill: 'dump-off' },
    );
    newState = { ...newState, gameLog: [...newState.gameLog, noTurnoverLog] };
  }

  return newState;
}
