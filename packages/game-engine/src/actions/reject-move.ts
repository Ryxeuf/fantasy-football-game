/**
 * Helper centralise pour les rejets de coups dans le dispatcher.
 *
 * Audit 2026-05-19 quick win ST3 (bug H2).
 *
 * Probleme : ~10 sites dans actions/ retournent silencieusement `state`
 * inchange quand une validation echoue (canBlitz, canPerformMultipleBlock,
 * direction push invalide, etc.). UX confuse cote client : le coup est
 * accepte (dispatch), aucun feedback d'erreur, l'UI attend une reponse
 * qui ne viendra jamais.
 *
 * Solution : `rejectMove(state, reason)` logge un GameLogEntry de type
 * 'info' avec prefixe `[reject]` pour le tracing, puis retourne le state.
 *
 * Choix : pas d'extension du union `GameLogEntry['type']` vers
 * 'warning'/'error' pour eviter de casser les filtres UI existants.
 * Le prefixe `[reject]` est grep-friendly et permet l'extraction
 * cote UI/observability sans changement de schema.
 */

import type { GameState } from '../core/types';
import { createLogEntry } from '../utils/logging';

/**
 * Rejette un coup en loggant la raison et en retournant le state.
 *
 * @param state - state actuel (retourne inchange dans le state.gameLog enrichi)
 * @param reason - description courte de la raison (ex: "BLITZ non legal", "FOUL pendant blitz kickoff")
 * @param context - contexte optionnel (playerId, targetId, etc.) pour le debug
 */
export function rejectMove(
  state: GameState,
  reason: string,
  context?: Record<string, unknown>
): GameState {
  const log = createLogEntry(
    'info',
    `[reject] ${reason}`,
    undefined,
    undefined,
    context
  );
  return { ...state, gameLog: [...state.gameLog, log] };
}
