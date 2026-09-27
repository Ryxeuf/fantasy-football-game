/**
 * Noms de fichiers des exports. Module léger (aucune dépendance jsPDF) :
 * l'écran l'importe statiquement, le rendu reste chargé à la demande.
 */

export type CompetitionPdfKind =
  | "matchday"
  | "calendar"
  | "standings"
  | "leaderboards"
  | "bracket"
  | "stats"
  | "match-sheet";

export const FILE_PREFIX: Record<CompetitionPdfKind, string> = {
  matchday: "journee",
  calendar: "calendrier",
  standings: "classement",
  leaderboards: "tops",
  bracket: "play-offs",
  stats: "statistiques",
  "match-sheet": "feuille-de-rencontre",
};

/** « classement-ligue-du-vieux-monde.pdf » — ASCII, sans accents. */
export function pdfFilename(kind: CompetitionPdfKind, name: string, suffix?: string | null): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
  const parts = [FILE_PREFIX[kind], slug(name), suffix ? slug(suffix) : null].filter(
    (p): p is string => !!p,
  );
  return `${parts.join("-")}.pdf`;
}

