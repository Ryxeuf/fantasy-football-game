/**
 * Options du summarizer pour UNE feuille de match — ce qui décide si une
 * élimination est une SORTIE (et rapporte des PSP), cf.
 * `eliminationEarnsSpp` :
 *
 *  - les compétences du COUP D'ENVOI, relues dans le gel de la feuille
 *    (« Innovateur Violent » pour une Action Spéciale, « Vol Fatal » pour
 *    un atterrissage sur un adversaire) ;
 *  - les Prières à Nuffle de chaque côté (« Frénésie d'Agression »).
 *
 * Trois lectures en dépendent et NE DOIVENT PAS diverger : la feuille
 * (affichage et validation, `league-match-sheet`), les classements
 * individuels de la saison (`league-player-stats`) et la resynchronisation
 * d'une feuille déjà validée. Toutes construisent leurs options ici.
 *
 * Module PUR : aucune I/O, testable sans Prisma.
 */

import type { MatchSummaryOptions } from "./league-match-summary";
import {
  FATAL_FLIGHT_SLUG,
  VIOLENT_INNOVATOR_SLUG,
  frozenSkillHolders,
  type LivePlayer,
} from "./league-sheet-frozen-skills";
import { foulingFrenzySides } from "./league-sheet-prayer-spp";

/** Colonnes de la feuille dont dépend la qualification des sorties. */
export interface SheetSummarySource {
  readonly rosterSnapshotHome?: unknown;
  readonly rosterSnapshotAway?: unknown;
  readonly prayersHome?: unknown;
  readonly prayersAway?: unknown;
}

/** Joueurs de chaque côté, tels que chargés par l'appelant. */
export interface SheetSidePlayers {
  readonly home: readonly LivePlayer[];
  readonly away: readonly LivePlayer[];
}

function union(a: ReadonlySet<string>, b: ReadonlySet<string>): Set<string> {
  return new Set([...a, ...b]);
}

/**
 * Construit les options du summarizer d'une feuille. Chaque côté est
 * rapproché de SON gel (les numéros de maillot se répètent d'une équipe à
 * l'autre) ; sans gel exploitable, les compétences live font office de
 * meilleure approximation (cf. `frozenSkillsByPlayerId`).
 */
export function buildSheetSummaryOptions(
  players: SheetSidePlayers,
  sheet: SheetSummarySource,
): MatchSummaryOptions {
  const holders = (slug: string): Set<string> =>
    union(
      frozenSkillHolders(players.home, sheet.rosterSnapshotHome, slug),
      frozenSkillHolders(players.away, sheet.rosterSnapshotAway, slug),
    );
  return {
    violentInnovators: holders(VIOLENT_INNOVATOR_SLUG),
    fatalFlighters: holders(FATAL_FLIGHT_SLUG),
    foulingFrenzy: foulingFrenzySides(sheet.prayersHome, sheet.prayersAway),
  };
}
