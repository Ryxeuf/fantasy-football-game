/**
 * Budget de construction PAR DÉFAUT proposé par le builder, en kpo.
 *
 * Audit statique vs base — lot 5 (W2). Le builder affichait le budget compilé
 * du format (`getFormatConstraints().startingBudget`) alors que
 * `POST /team/build` accepte la valeur envoyée par le client : le « Restant »
 * affiché divergeait de l'équipe réellement construite dès qu'un admin
 * corrigeait `Roster.budget`.
 *
 * DEUX AXES À NE PAS CONFONDRE :
 *  - `Roster.budget` (base, éditable en admin) est le budget de construction
 *    du roster **en Blood Bowl à 11** — c'est la valeur que porte la fiche
 *    publique du roster ;
 *  - `FORMAT_CONSTRAINTS[format].startingBudget` est le plafond du FORMAT
 *    (BB11 1 000 kpo, Sevens 600 kpo).
 *
 * Il n'existe pas de budget par couple roster × format en base :
 * `Roster.budget` ne fait donc autorité QUE pour le BB11 ; tout autre format
 * garde son propre plafond, sinon une équipe Sevens partirait avec les
 * 1 000 kpo du BB11 au lieu de ses 600.
 *
 * Lot 6.7 — la règle est désormais PARTAGÉE avec le serveur
 * (`defaultBuildBudgetK`, `@bb/game-engine`) : `POST /team/build` applique le
 * même défaut, donc le « Restant » affiché ne peut plus diverger de l'équipe
 * réellement construite. Ce module reste l'entrée du builder (et ses tests).
 *
 * 100 % pur : testable sans rendu React.
 */

import { defaultBuildBudgetK, type GameFormat } from "@bb/game-engine";

export function defaultBudgetK(
  rosterBudgetK: number | null | undefined,
  format: GameFormat,
): number {
  return defaultBuildBudgetK(rosterBudgetK, format);
}
