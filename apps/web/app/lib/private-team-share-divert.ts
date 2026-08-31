/**
 * Détournement d'un lien de fiche privée vers la page publique de l'équipe.
 *
 * Le problème : un coach colle SPONTANÉMENT l'URL de sa fiche
 * (`/me/teams/:id`) dans un salon Discord, pas le lien public
 * (`/r/:token`). Or `/me/*` est gardé par le middleware : le scraper reçoit
 * un 307 vers `/auth/sync` et n'unfurle donc jamais que la carte générique
 * du site — c'est exactement ce que montre l'aperçu signalé. Aucune
 * metadata posée sur `/me/teams/[id]` ne peut y changer quoi que ce soit :
 * la redirection a lieu AVANT le rendu.
 *
 * La correction : quand la requête n'est pas authentifiée, on l'envoie sur
 * le résolveur `/r/by-id/:id`, qui la renvoie vers `/r/:token` SI l'équipe
 * est publique, et vers le parcours de connexion habituel sinon.
 *
 * Périmètre volontairement étroit :
 *  - la FEUILLE `/me/teams/:id` seulement — pas `/me/teams`, pas
 *    `/me/teams/new` (le builder), pas les sous-pages (`/edit`,
 *    `/journal`…) ;
 *  - GET sans query string, pour ne rien perdre du `?redirect=` que le
 *    middleware construit aujourd'hui ;
 *  - et le comportement ne change QUE pour une équipe que son coach a
 *    explicitement rendue publique (`isPublic`, faux par défaut) : envoyer
 *    un visiteur sans session vers la vue publique d'une équipe publiée est
 *    précisément l'intention du partage.
 *
 * Pur : pas de `NextRequest`, pas de fetch — testable directement.
 */

/** Segment réservé du résolveur. Hors de l'espace des tokens (32 hex). */
export const SHARE_RESOLVER_PREFIX = "/r/by-id";

/** Réservé aux slugs d'id Prisma (cuid) : lettres, chiffres, tirets. */
const TEAM_DETAIL_PATH = /^\/me\/teams\/([A-Za-z0-9_-]+)\/?$/;

/**
 * Segments qui ont la FORME d'une feuille sans en être une. `new` est le
 * builder : le détourner enverrait une requête d'aperçu pour une équipe qui
 * n'existe pas, à chaque visite déconnectée du builder.
 */
const RESERVED_SEGMENTS = new Set(["new"]);

export interface PrivateTeamDivertInput {
  readonly pathname: string;
  /** Query string brute (`?a=1`), telle que fournie par l'URL. */
  readonly search?: string;
  readonly method?: string;
  /**
   * `true` quand le middleware serait passé par `/auth/sync` (aucun cookie
   * d'auth : l'utilisateur peut encore avoir un jeton en localStorage).
   * Le résolveur reconduit ce choix pour les équipes non publiques.
   */
  readonly syncFallback: boolean;
}

/**
 * Chemin du résolveur, ou `null` quand la requête doit suivre le parcours
 * de connexion habituel.
 */
export function privateTeamDivertTarget(
  input: PrivateTeamDivertInput,
): string | null {
  const method = (input.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return null;
  // Une query string signifie un contexte qu'on ne sait pas reconduire
  // (retour de paiement, ancre applicative…) : on ne détourne pas.
  if (input.search && input.search !== "?") return null;

  const match = TEAM_DETAIL_PATH.exec(input.pathname);
  if (!match) return null;

  const id = match[1];
  if (RESERVED_SEGMENTS.has(id)) return null;

  const suffix = input.syncFallback ? "?sync=1" : "";
  return `${SHARE_RESOLVER_PREFIX}/${encodeURIComponent(id)}${suffix}`;
}
