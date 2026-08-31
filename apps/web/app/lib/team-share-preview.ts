/**
 * Aperçu de partage d'une équipe, résolu par son id.
 *
 * Cette fiche est la page de travail du coach — privée, derrière une
 * session. C'est pourtant CE lien qu'un coach colle dans un salon Discord,
 * et jusqu'ici l'aperçu retombait sur la carte générique du site.
 *
 * Règle : on n'enrichit l'aperçu QUE si l'équipe a activé le partage
 * public. `GET /api/public/teams/by-id/:id` applique la même porte que
 * `/r/:token` (`isPublic`) et rend 404 sinon — une équipe privée reste donc
 * indiscernable d'une équipe inexistante, et ni son nom, ni son logo, ni sa
 * description ne fuitent hors de la session du coach.
 */
import { safeServerJson, getServerApiBase } from "./serverApi";

export interface TeamSharePreview {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string;
  readonly teamValue: number;
  readonly playerCount: number;
  readonly starPlayerNames: readonly string[];
  readonly logoUrl: string | null;
  readonly description: string | null;
  readonly shareToken: string | null;
}

/**
 * `null` quand l'équipe n'est pas partagée publiquement, n'existe pas, ou
 * que l'API est injoignable. `safeServerJson` (et non `fetchServerJson`) :
 * un backend indisponible doit dégrader vers l'aperçu générique, pas faire
 * planter le rendu de la page du coach.
 */
export async function fetchTeamSharePreview(
  teamId: string,
): Promise<TeamSharePreview | null> {
  if (!teamId) return null;
  const base = getServerApiBase();
  const data = await safeServerJson<{ preview?: TeamSharePreview }>(
    `${base}/api/public/teams/by-id/${encodeURIComponent(teamId)}`,
    { next: { revalidate: 600 } },
  );
  return data?.preview ?? null;
}
