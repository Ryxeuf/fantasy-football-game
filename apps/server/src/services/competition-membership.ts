/**
 * « Mes compétitions » — UNE seule règle (change OpenSpec `my-competitions`).
 *
 * Une ligue ou une coupe est « à moi » si j'en suis le créateur
 * (commissaire), ou si une équipe dont je suis propriétaire est ou a été
 * inscrite à une de ses éditions (une saison de ligue, la coupe elle-même) :
 * quel que soit le statut de l'inscription (retrait compris), et même si
 * l'équipe a été supprimée depuis — une équipe ne se supprime qu'une fois
 * ses compétitions terminées, ses participations sont de l'HISTOIRE. Une
 * invitation en attente ne suffit pas, le rôle d'admin non plus.
 *
 * La règle était réécrite quatre fois (listing des ligues, listing et
 * archives des coupes, garde de visibilité), avec des variantes : équipe
 * retirée comptée d'un côté, équipe supprimée exclue de l'autre. Ici, elle
 * s'exprime en filtres Prisma PAR RELATION (`team: { ownerId }`), qui
 * suivent le propriétaire COURANT de l'équipe et comptent les équipes
 * supprimées sans pré-chargement.
 *
 * Invariant : « à moi » ⊆ « visible ». Les filtres de visibilité des
 * listings CONTIENNENT ces clauses (cf. `listLeagues`, `buildCupListWhere`),
 * donc une compétition « à moi » n'est jamais cachée à son lecteur.
 *
 * `buildViewerRoles` (pur) tranche le rôle servi sur chaque carte.
 */

/** Filtre Prisma `League` : ligues créées par l'utilisateur OU jouées par une de ses équipes. */
export function leagueMineWhere(userId: string): {
  OR: Array<Record<string, unknown>>;
} {
  return {
    OR: [
      { creatorId: userId },
      {
        seasons: {
          some: { participants: { some: { team: { ownerId: userId } } } },
        },
      },
    ],
  };
}

/** Filtre Prisma `Cup` : coupes créées par l'utilisateur OU jouées par une de ses équipes. */
export function cupMineWhere(userId: string): {
  OR: Array<Record<string, unknown>>;
} {
  return {
    OR: [
      { creatorId: userId },
      { participants: { some: { team: { ownerId: userId } } } },
    ],
  };
}

/** `scope` des listings : tout ce qui est visible, ou « les miennes ». */
export type CompetitionScope = "all" | "mine";

/**
 * Participation du lecteur :
 *  - `active`    : inscrit à l'édition courante ;
 *  - `withdrawn` : inscrit à l'édition courante, mais retiré ;
 *  - `former`    : seulement à des éditions antérieures ;
 *  - `null`      : aucune.
 */
export type ViewerParticipation = "active" | "withdrawn" | "former" | null;

export interface ViewerRoles {
  readonly commissioner: boolean;
  readonly participant: ViewerParticipation;
  /** Équipes du lecteur ENGAGÉES (non retirées) dans l'édition courante. */
  readonly teams: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

export interface ViewerParticipationRow {
  /**
   * Numéro d'édition (saison de ligue). Une coupe n'a qu'une édition :
   * l'appelant passe la même valeur que `currentEdition`.
   */
  readonly edition: number;
  /** Statut de l'inscription (`active`, `withdrawn`…). */
  readonly status: string;
  readonly team: { readonly id: string; readonly name: string };
}

export interface BuildViewerRolesInput {
  readonly viewerId: string | null | undefined;
  readonly creatorId: string;
  /** Plus haut numéro d'édition de la compétition (null = aucune). */
  readonly currentEdition: number | null;
  /** Inscriptions des équipes du lecteur, toutes éditions confondues. */
  readonly participations: readonly ViewerParticipationRow[];
}

const WITHDRAWN = "withdrawn";

export function buildViewerRoles(input: BuildViewerRolesInput): ViewerRoles {
  const commissioner = !!input.viewerId && input.viewerId === input.creatorId;
  if (input.participations.length === 0) {
    return { commissioner, participant: null, teams: [] };
  }
  const current = input.participations.filter(
    (p) => input.currentEdition !== null && p.edition === input.currentEdition,
  );
  if (current.length === 0) {
    return { commissioner, participant: "former", teams: [] };
  }
  const engaged = current.filter((p) => p.status !== WITHDRAWN);
  if (engaged.length === 0) {
    return { commissioner, participant: "withdrawn", teams: [] };
  }
  return {
    commissioner,
    participant: "active",
    teams: engaged.map((p) => ({ id: p.team.id, name: p.team.name })),
  };
}
