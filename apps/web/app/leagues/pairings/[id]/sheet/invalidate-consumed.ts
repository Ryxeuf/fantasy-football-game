/**
 * Déblocage de l'invalidation refusée pour « advancement-consumed » :
 * un joueur a dépensé ses PSP (évolution prise) APRÈS la validation de
 * la feuille. Le serveur accepte un second appel avec
 * `removeConsumedAdvancements: true` qui retire ces évolutions
 * post-match (PSP remboursés, compétence/caractéristique retirée, VE
 * recalculée) avant d'annuler la validation.
 *
 * Extrait de `page.tsx` (pas d'export non-conventionnel dans un
 * fichier page) pour rester testable.
 */

/** Marqueur renvoyé par l'API dans « Reversion impossible: … ». */
export const ADVANCEMENT_CONSUMED_MARKER = "advancement-consumed";

/** True si l'erreur d'invalidation est le refus « advancement-consumed ». */
export function isAdvancementConsumedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(ADVANCEMENT_CONSUMED_MARKER)
  );
}

/** Message de confirmation avant le retrait des évolutions post-match. */
export const REMOVE_CONSUMED_CONFIRM_MESSAGE =
  "Des joueurs ont dépensé leurs PSP (compétence ou évolution prise) " +
  "APRÈS la validation de ce match.\n\n" +
  "Invalider quand même retirera ces évolutions prises après le match : " +
  "PSP remboursés, compétences/caractéristiques retirées, valeur d'équipe " +
  "recalculée.\n\nContinuer ?";
