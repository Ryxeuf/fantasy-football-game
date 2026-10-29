/**
 * Fraîcheur de la « version du match » d'une feuille de ligue.
 *
 * Le gel est posé à l'ouverture. Si une autre feuille d'une des deux équipes
 * est validée (ou invalidée) après, l'état figé ne correspond plus à
 * l'équipe : le serveur le signale (`snapshotFreshness`) et la feuille se
 * met à jour (`POST …/sheet/refresh`) tant que personne n'a soumis. Module
 * PUR : il ne fait que traduire la réponse en bandeau.
 */

export interface SheetChangeView {
  readonly pairingId: string;
  readonly kind: "validated" | "invalidated";
  /** ISO 8601. */
  readonly at: string;
  readonly roundLabel: string;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
}

/** `snapshotFreshness` de `GET …/sheet` (absent d'un serveur antérieur). */
export interface SnapshotFreshnessView {
  readonly home: SheetChangeView | null;
  readonly away: SheetChangeView | null;
  readonly refreshable: boolean;
}

export interface FreshnessBanner {
  /** Le gel ne reflète plus au moins une des deux équipes. */
  readonly stale: boolean;
  /** Une phrase par équipe concernée. */
  readonly lines: readonly string[];
  /** Le viewer peut mettre la feuille à jour maintenant. */
  readonly canRefresh: boolean;
  /** Pourquoi la mise à jour n'est pas possible en l'état, s'il y a lieu. */
  readonly blockedHint: string | null;
}

function frDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function changeLine(teamName: string, change: SheetChangeView): string {
  const verb = change.kind === "validated" ? "validée" : "invalidée";
  return (
    `${teamName} : la feuille de ${change.roundLabel} ` +
    `(${change.homeTeamName} – ${change.awayTeamName}) a été ${verb} le ` +
    `${frDate(change.at)}, après l'ouverture de celle-ci.`
  );
}

/**
 * Bandeau de fraîcheur, ou `null` quand la feuille n'en a pas (coupe,
 * feuille validée, serveur antérieur).
 */
export function freshnessBanner(input: {
  readonly freshness: SnapshotFreshnessView | null | undefined;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  /** Coach du match ou commissaire, feuille non validée. */
  readonly canEdit: boolean;
}): FreshnessBanner | null {
  const f = input.freshness;
  if (!f) return null;
  const lines: string[] = [];
  if (f.home) lines.push(changeLine(input.homeTeamName, f.home));
  if (f.away) lines.push(changeLine(input.awayTeamName, f.away));
  const stale = lines.length > 0;
  const canRefresh = input.canEdit && f.refreshable;
  return {
    stale,
    lines,
    canRefresh,
    blockedHint:
      stale && input.canEdit && !f.refreshable
        ? "La feuille a déjà été soumise : retirez les soumissions pour pouvoir la mettre à jour."
        : null,
  };
}
