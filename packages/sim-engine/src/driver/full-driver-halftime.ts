/**
 * Headless halftime sequence for the full driver.
 *
 * BB 2025 halftime sequence (déjà appliquée par `advanceHalfIfNeeded`
 * dans game-engine) :
 *   1. Expulsion des armes secrètes (effet permanent jusqu'à la fin
 *      du match).
 *   2. Récupération des joueurs KO (jet 1d6 par KO, retour en reserve
 *      sur 4+).
 *   3. Reset des positions : tous les joueurs actifs retournent en
 *      réserve, prêts pour un re-setup.
 *   4. La gamePhase passe à `halftime`, preMatch.phase à `setup`,
 *      currentCoach = receivingTeam (en general celui qui a frappé en H1).
 *
 * Le full driver headless n'a pas d'UI pour placer les joueurs ni
 * piloter la séquence de kickoff interactive. On orchestre donc :
 *   1. Auto-placement de l'équipe receveuse (via `autoSetupAITeam`).
 *   2. Auto-placement de l'équipe frappeuse.
 *   3. Validation des deux placements (transitions setup → kickoff).
 *   4. Bypass de la séquence interactive de kickoff : passage direct
 *      en `playing` et appel à `executeHeadlessKickoff` pour la
 *      résolution scatter D8/D6 + event 2D6 + landing.
 */

import {
  autoSetupAITeam,
  validatePlayerPlacement,
  type ExtendedGameState,
} from '@bb/game-engine';
import type { GameState, RNG, TeamId } from '@bb/game-engine';

import { executeHeadlessKickoff } from './full-driver-kickoff';

/**
 * Exécute la séquence de mi-temps headless : auto-setup + kickoff H2.
 *
 * Précondition : `state.gamePhase === 'halftime'` et
 * `state.preMatch.phase === 'setup'` (entrée par `advanceHalfIfNeeded`).
 *
 * Postcondition : `state.gamePhase === 'playing'` avec les 11 joueurs
 * de chaque équipe placés et le ballon résolu (chez un receveur, au
 * sol dans la moitié receveuse ou touchback).
 */
export function executeHeadlessHalftime(
  state: GameState,
  rng: RNG,
): GameState {
  return executeHeadlessDrive(state, rng);
}

/**
 * Lot 1 « match complet » — UNE séquence « placement + coup d'envoi » pour
 * les trois entrées : mi-temps (`gamePhase === 'halftime'`) et remise en
 * jeu après un touchdown (`gamePhase === 'playing'`, les joueurs renvoyés
 * en réserve par `handlePostTouchdown`). La différence est l'état d'entrée,
 * pas la séquence.
 *
 * Précondition : `preMatch.phase === 'setup'`.
 * Postcondition : `gamePhase === 'playing'`, les deux équipes placées, le
 * ballon résolu.
 */
export function executeHeadlessDrive(
  state: GameState,
  rng: RNG,
): GameState {
  const ext = state as ExtendedGameState;
  const awaitingSetup =
    ext.preMatch?.phase === 'setup' &&
    (state.gamePhase === 'halftime' || state.gamePhase === 'playing');
  if (!awaitingSetup) {
    return state;
  }

  const receivingTeam: TeamId = ext.preMatch.receivingTeam;
  const kickingTeam: TeamId = ext.preMatch.kickingTeam;

  // 1. Auto-place receiving team
  let next = autoSetupAITeam(ext, receivingTeam);
  // 2. Validate → currentCoach becomes kickingTeam, legalSetupPositions
  //    recomputed for kicking side.
  next = validatePlayerPlacement(next);
  // 3. Auto-place kicking team
  next = autoSetupAITeam(next, kickingTeam);
  // 4. Validate → preMatch.phase becomes 'kickoff'.
  next = validatePlayerPlacement(next);

  // 5. Bypass interactive kickoff sequence : on a déjà les 22 joueurs
  //    placés ; on passe directement en `playing` et on délègue le
  //    placement/scatter/event/landing du ballon à executeHeadlessKickoff.
  const playingState: GameState = {
    ...next,
    gamePhase: 'playing',
    preMatch: {
      ...next.preMatch,
      phase: 'idle',
      placedPlayers: [],
      legalSetupPositions: [],
      kickoffStep: undefined,
      ballPosition: null,
      kickDeviation: null,
      kickoffEvent: null,
      finalBallPosition: undefined,
    },
  } as GameState;

  // 6. Run kickoff (scatter D8/D6 + event 2D6 + landing pickup/bounce).
  return executeHeadlessKickoff(playingState, kickingTeam, rng);
}
