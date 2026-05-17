/**
 * S27.8.3 — Handlers de fin de tour et faute extraits de `actions.ts`.
 *
 * Trois handlers avec aucune dependance interne au dispatcher
 * monolithique :
 *  - `handleEndPlayerTurn` : un coach abandonne explicitement la
 *    suite d'activation d'un joueur (PM=0, gfiUsed=2).
 *  - `handleEndTurn` : changement de tour, reinitialisation des
 *    flags one-shot, gestion post-TD / kickoff blitz / passage de
 *    mi-temps.
 *  - `handleFoul` : action FOUL avec gate "1 par tour", consomme
 *    `mechanics/foul`.
 *
 * Reduction de bruit dans `actions.ts` : ~134 lignes en moins.
 */

import type { GameState, RNG, ActionType, TeamId } from '../core/types';
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
  advanceHalfIfNeeded,
  handlePostTouchdown,
} from '../core/game-state';
import { checkTouchdowns } from '../mechanics/ball';
import { canFoul, executeFoul } from '../mechanics/foul';
import { createLogEntry } from '../utils/logging';

/**
 * Termine explicitement l'activation d'un joueur (PM = 0, gfiUsed = 2).
 * Marque l'action MOVE si le joueur n'avait pas encore d'action posee.
 */
export function handleEndPlayerTurn(
  state: GameState,
  move: { type: 'END_PLAYER_TURN'; playerId: string },
): GameState {
  const player = state.players.find((p) => p.id === move.playerId);
  if (!player) return state;
  if (player.team !== state.currentPlayer) return state;

  // Mettre les PM du joueur a 0 pour empecher d'autres actions
  const newState = {
    ...state,
    players: state.players.map((p) =>
      p.id === move.playerId ? { ...p, pm: 0, gfiUsed: 2 } : p,
    ),
    selectedPlayerId: null,
  };

  // Marquer le joueur comme ayant agi s'il ne l'a pas encore ete
  if (!hasPlayerActed(newState, move.playerId)) {
    return setPlayerAction(newState, move.playerId, 'MOVE');
  }

  return newState;
}

/**
 * Gere la fin de tour. Distingue 4 cas :
 *  - match termine (ne change rien)
 *  - phase post-TD (delegue a `handlePostTouchdown`)
 *  - tour de blitz kickoff (rend le controle a l'equipe receveuse)
 *  - changement de tour normal (currentPlayer flip + reset des flags)
 */
export function handleEndTurn(state: GameState, rng: RNG): GameState {
  // Si le match est termine, ne rien faire
  if (state.gamePhase === 'ended') return state;

  // Si on est en phase post-TD, faire le reset et kickoff
  if (state.gamePhase === 'post-td') {
    return handlePostTouchdown(state, rng);
  }

  // Si c'est un tour de blitz kickoff, le tour du kicking team est termine
  // Retourner le controle a l'equipe qui recoit
  if (state.kickoffBlitzTurn) {
    const receivingTeam = state.kickingTeam === 'A' ? 'B' : 'A';
    return {
      ...state,
      kickoffBlitzTurn: undefined,
      currentPlayer: receivingTeam,
      selectedPlayerId: null,
      players: state.players.map((p) => ({
        ...p,
        pm: p.ma,
        gfiUsed: 0,
        breakTackleUsed: false,
      })),
      isTurnover: false,
      playerActions: {},
      teamBlitzCount: {},
      teamFoulCount: {},
      rerollUsedThisTurn: false,
      hypnotizedPlayers: [],
      usedRunningPassThisTurn: [],
      usedOnTheBallThisTurn: [],
      usedMultipleBlockThisTurn: [],
    };
  }

  // Changement de tour - le porteur de ballon garde le ballon.
  //
  // BB rule : un "round" = équipe receveuse joue puis équipe kickeuse joue.
  // Le compteur `turn` représente le numéro de round (1..8 par half). On
  // l'incrémente après l'END_TURN de l'équipe **kickeuse** (la 2e à
  // jouer dans le round), pas après la 1ère.
  //
  // BUG fix : avant, l'incrément était hardcodé à `currentPlayer === 'B'`,
  // ce qui supposait que A joue toujours en premier (A = receveur). Quand
  // A kicke en half 1 (donc B reçoit et joue en premier), l'incrément
  // bumpait après B = receveur → après 8 END_TURN de B, turn=9 → halftime
  // alors que A n'avait joué que 7 activations. Inéquité 8 vs 7. Fix : on
  // bump quand l'équipe qui finit son tour est `kickingTeam`. Fallback sur
  // 'B' (= comportement legacy) quand `kickingTeam` est undefined, pour
  // préserver la compat des tests qui ne définissent pas explicitement
  // l'équipe kickeuse.
  const bumpingTeam: TeamId = state.kickingTeam ?? 'B';
  const newState: GameState = {
    ...state,
    currentPlayer: state.currentPlayer === 'A' ? 'B' : 'A',
    turn: state.currentPlayer === bumpingTeam ? state.turn + 1 : state.turn,
    selectedPlayerId: null,
    players: state.players.map((p) => ({ ...p, pm: p.ma, gfiUsed: 0 })),
    isTurnover: false,
    lastDiceResult: undefined,
    playerActions: {} as Record<string, ActionType>,
    teamBlitzCount: {} as Record<string, number>,
    teamFoulCount: {} as Record<string, number>,
    rerollUsedThisTurn: false,
    hypnotizedPlayers: [],
    usedRunningPassThisTurn: [],
    usedOnTheBallThisTurn: [],
    usedMultipleBlockThisTurn: [],
  };

  // Log du changement de tour
  const turnLogEntry = createLogEntry(
    'action',
    `Fin du tour - ${
      newState.currentPlayer === 'A'
        ? newState.teamNames.teamA
        : newState.teamNames.teamB
    } joue maintenant`,
    undefined,
    newState.currentPlayer,
  );
  newState.gameLog = [...newState.gameLog, turnLogEntry];

  // Le porteur de ballon garde le ballon lors du changement de tour
  // Verifier touchdowns, puis passage de mi-temps si besoin
  return advanceHalfIfNeeded(checkTouchdowns(newState), rng);
}

/**
 * Gere une action de faute (FOUL). Limite a 1 faute par tour d'equipe.
 */
export function handleFoul(
  state: GameState,
  move: { type: 'FOUL'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!attacker || !target) return state;
  if (attacker.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, attacker.id)) return state;

  // Verifier la limite de 1 foul par tour
  const team = attacker.team;
  if (((state.teamFoulCount && state.teamFoulCount[team]) || 0) >= 1)
    return state;

  if (!canFoul(state, attacker, target)) return state;

  let newState = executeFoul(state, attacker, target, rng);

  // Incrementer le compteur de foul
  const currentFoulCount = newState.teamFoulCount || {};
  newState.teamFoulCount = {
    ...currentFoulCount,
    [team]: (currentFoulCount[team] || 0) + 1,
  };

  newState = setPlayerAction(newState, attacker.id, 'FOUL');
  newState = checkPlayerTurnEnd(newState, attacker.id);
  return newState;
}
