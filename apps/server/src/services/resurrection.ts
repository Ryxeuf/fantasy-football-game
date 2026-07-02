/**
 * Règle du mode résurrection (coupes).
 *
 * En mode résurrection, une équipe repart de son snapshot d'inscription à
 * chaque match : aucun PSP gagné, aucune blessure/mort conservée. Concrètement,
 * à la complétion d'un match de coupe résurrection, on NE persiste PAS les
 * résultats (SPP, blessures permanentes, morts) sur les `TeamPlayer` — le
 * roster live reste donc identique au snapshot.
 */

export interface MatchOutcomePersistenceInput {
  /** La coupe du match est-elle en mode résurrection ? */
  readonly resurrectionMode: boolean;
  /** Le match a-t-il un `gameState` exploitable ? */
  readonly hasGameState: boolean;
  /** Les deux équipes sont-elles renseignées ? */
  readonly hasBothTeams: boolean;
}

/**
 * `true` si l'on doit persister les conséquences du match (SPP, blessures,
 * morts). `false` en mode résurrection — quel que soit l'état du gameState.
 */
export function shouldPersistMatchOutcome(
  input: MatchOutcomePersistenceInput,
): boolean {
  if (input.resurrectionMode) return false;
  return input.hasGameState && input.hasBothTeams;
}
