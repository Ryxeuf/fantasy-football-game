/**
 * Contenu éditorial d'un positionnel (image, description, fluff).
 *
 * Les colonnes `Position.imageUrl / descriptionFr / descriptionEn / fluffFr /
 * fluffEn` sont NULLABLES et posées sans backfill (`prisma db push`, cf.
 * CLAUDE.md) : tout consommateur doit donc tolérer l'absence totale de
 * contenu. Ce module est **pur** (aucune I/O) et partagé par les routes
 * publiques `/api/positions` et `/api/rosters/:slug` pour que les deux ne
 * divergent jamais sur la localisation ni sur la normalisation.
 */

/** Colonnes éditoriales telles que lues en base (toutes optionnelles). */
export interface PositionContentRow {
  readonly imageUrl?: string | null;
  readonly descriptionFr?: string | null;
  readonly descriptionEn?: string | null;
  readonly fluffFr?: string | null;
  readonly fluffEn?: string | null;
}

/** Contenu éditorial résolu pour une langue d'affichage. */
export interface PositionContentView {
  /** Illustration du poste (URL), `null` si non renseignée. */
  readonly imageUrl: string | null;
  /** Description de jeu localisée (repli FR si l'EN manque). */
  readonly description: string | null;
  /** Fluff / lore localisé (repli FR si l'EN manque). */
  readonly fluff: string | null;
}

/** `"  "` → `null` : une chaîne vide n'est pas du contenu. */
function clean(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Choisit la version anglaise si elle existe, sinon retombe sur le français.
 * Le repli est volontaire : un contenu FR vaut mieux qu'un trou dans la fiche.
 */
function localize(
  fr: string | null | undefined,
  en: string | null | undefined,
  isEnglish: boolean,
): string | null {
  const frClean = clean(fr);
  const enClean = clean(en);
  return isEnglish ? (enClean ?? frClean) : frClean;
}

/** Résout le contenu éditorial d'une position pour la langue demandée. */
export function resolvePositionContent(
  row: PositionContentRow | null | undefined,
  isEnglish: boolean,
): PositionContentView {
  return {
    imageUrl: clean(row?.imageUrl),
    description: localize(row?.descriptionFr, row?.descriptionEn, isEnglish),
    fluff: localize(row?.fluffFr, row?.fluffEn, isEnglish),
  };
}
