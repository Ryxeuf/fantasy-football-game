/**
 * Garde runtime pour l'invariant d'exclusivite mutuelle des pendingX.
 *
 * Audit 2026-05-19 quick win ST4 (bug B4).
 *
 * Probleme : 10 champs `pendingX` dans GameState sont tous `?`. Aucune
 * garantie statique que deux pending ne coexistent pas (e.g.
 * pendingBlock + pendingMultipleBlock simultanement → dispatcher
 * confus).
 *
 * Solution ideale : discriminated union `PendingState`. Mais 574 call
 * sites referencent les champs individuels, le refacto est trop
 * intrusif en autonomie.
 *
 * Solution intermediaire : garde runtime + helper `getActivePending`
 * qui detecte les violations et permet d'inspecter le pending actif
 * sans connaitre son type a l'avance.
 *
 * Quand le refacto type-level sera fait dans une session dediee, ce
 * fichier servira de spec executable (les tests verifient deja
 * l'exclusivite).
 */

import type { GameState } from './types';

/** Liste exhaustive des noms de champs pendingX dans GameState. */
export const PENDING_FIELDS = [
  'pendingApothecary',
  'pendingKickoffEvent',
  'pendingBlock',
  'pendingDumpOff',
  'pendingPushChoice',
  'pendingFollowUpChoice',
  'pendingReroll',
  'pendingMultipleBlock',
  'pendingFrenzyBlock',
  'pendingOnTheBall',
] as const;

export type PendingFieldName = (typeof PENDING_FIELDS)[number];

/**
 * Retourne le nom du champ pending actif, ou `null` si aucun.
 * Si plusieurs sont actifs (violation d'invariant), retourne le
 * premier dans l'ordre PENDING_FIELDS.
 */
export function getActivePending(state: GameState): PendingFieldName | null {
  for (const field of PENDING_FIELDS) {
    if (state[field] != null) return field;
  }
  return null;
}

/**
 * Retourne tous les champs pending actifs simultanement. Devrait
 * toujours retourner 0 ou 1 element. Si ≥ 2 → violation d'invariant.
 */
export function listActivePendings(state: GameState): PendingFieldName[] {
  return PENDING_FIELDS.filter((field) => state[field] != null);
}

/**
 * Assertion runtime : levees si plus d'un pending actif. A appeler
 * apres une transition de drive (post-TD, halftime) pour detecter
 * un bug d'oubli de clear.
 *
 * En production (NODE_ENV=production), log un console.error au lieu
 * de throw (eviter de crasher un match en cours sur un bug latent).
 */
export function assertSinglePending(state: GameState, context: string): void {
  const active = listActivePendings(state);
  if (active.length <= 1) return;

  const msg = `[pending-state invariant] ${context}: ${active.length} pendings actifs simultanement: ${active.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    console.error(msg);
  } else {
    throw new Error(msg);
  }
}
