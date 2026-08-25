/**
 * Détection des modifications non enregistrées du brouillon de roster.
 *
 * La fiche d'édition accumule en local le nom d'équipe, les noms/numéros de
 * joueurs et les ajouts/retraits ; rien n'est persisté avant « Enregistrer ».
 * On compare donc une SIGNATURE du brouillon à celle de l'état chargé.
 *
 * Ne portent PAS sur ce brouillon (donc jamais « non enregistrés ») les
 * achats appliqués immédiatement côté serveur : compétences, pool de PSP,
 * Star Players, staff.
 */

/** Champs du brouillon qui partent au `PUT /team/:id/roster`. */
export interface RosterDraftPlayer {
  readonly id: string;
  readonly position: string;
  readonly name: string;
  readonly number: number;
}

/**
 * Signature stable d'un brouillon. L'ordre des joueurs dans le tableau ne
 * compte pas (la liste est triée à l'affichage) : on trie par id.
 */
export function rosterDraftSignature(
  teamName: string,
  players: readonly RosterDraftPlayer[],
): string {
  const rows = players
    .map((p) => `${p.id}|${p.position}|${p.name.trim()}|${p.number}`)
    .sort();
  return JSON.stringify([teamName.trim(), rows]);
}
