/**
 * Ce que la page d'édition d'une équipe autorise, à partir des deux gels
 * servis par `GET /team/:id/available-positions`.
 *
 * Ils ne disent pas la même chose et les confondre a coûté cher :
 *
 *  - `frozen` — la COMPOSITION est figée. Tombe dès l'INSCRIPTION à une
 *    ligue ou une coupe (anti-triche : on ne remanie pas son effectif entre
 *    deux journées).
 *  - `buildLocked` — les ACHATS DE CONSTRUCTION sont figés. Ne tombe qu'à
 *    l'ENTRÉE EN JEU (feuille de match ouverte, match lancé).
 *
 * La page redirigeait sur `frozen`. Un coach inscrit à une saison qui n'a pas
 * commencé n'avait donc plus AUCUN moyen de défaire une compétence achetée
 * sur son pool de PSP — il fallait recréer l'équipe. Elle redirige désormais
 * sur `buildLocked` et n'affiche en lecture seule que ce que le serveur
 * refuserait vraiment.
 *
 * Les deux champs sont optionnels : avant le premier chargement, et face à un
 * serveur antérieur qui ne sert pas `buildLocked`, on retombe sur le
 * comportement le plus fermé — c'est un garde-fou, il ne s'ouvre jamais par
 * défaut.
 */

export interface EditAccessInput {
  /** Aucun match en cours (sélection pending/active) sur cette équipe. */
  readonly canEdit: boolean;
  readonly frozen?: boolean;
  readonly buildLocked?: boolean;
}

export interface EditAccess {
  /** Renvoyer le coach vers la fiche détail : il n'y a plus rien à éditer. */
  readonly redirect: boolean;
  /** Effectif, staff, Star Players, budget et nom en lecture seule. */
  readonly rosterLocked: boolean;
}

export function resolveEditAccess(input: EditAccessInput): EditAccess {
  const frozen = input.frozen ?? true;
  // Un serveur antérieur ne sert pas `buildLocked` : on retombe alors sur
  // l'ancien comportement (gel de composition = redirection).
  const buildLocked = input.buildLocked ?? frozen;
  return {
    redirect: !input.canEdit || buildLocked,
    rosterLocked: frozen,
  };
}
