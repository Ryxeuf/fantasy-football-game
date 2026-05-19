/**
 * Types fondamentaux du package @bb/nfl-mapper.
 *
 * - 8 races BB officielles (cf. docs/nfl-fantasy/04-race-mapping.md)
 * - 32 codes equipes NFL (standard NFL officiel : 2 lettres pour la
 *   plupart, 3 pour quelques-unes). Aligne avec le champ `team` du CSV
 *   nflverse `stats_player_week_{year}.csv`.
 * - TeamMeta : metadonnees consolidees par equipe.
 */

export type BbRace =
  | 'Skaven'
  | 'WoodElf'
  | 'Orc'
  | 'Human'
  | 'Norse'
  | 'Dwarf'
  | 'Khorne'
  | 'Necromantic';

export const BB_RACES: readonly BbRace[] = [
  'Skaven',
  'WoodElf',
  'Orc',
  'Human',
  'Norse',
  'Dwarf',
  'Khorne',
  'Necromantic',
];

/**
 * Codes equipes NFL (32). Stable d'annee en annee.
 *
 * Note : LA disambiguation = LAR (Rams), LAC (Chargers).
 *        NY disambiguation = NYG (Giants), NYJ (Jets).
 *        Quelques codes ESPN utilisent "WSH" pour les Commanders alors
 *        que nflverse utilise "WAS" — la traduction est faite au niveau
 *        du service d'ingestion, pas ici (on s'aligne sur nflverse).
 */
export type NflTeamCode =
  | 'ARI'
  | 'ATL'
  | 'BAL'
  | 'BUF'
  | 'CAR'
  | 'CHI'
  | 'CIN'
  | 'CLE'
  | 'DAL'
  | 'DEN'
  | 'DET'
  | 'GB'
  | 'HOU'
  | 'IND'
  | 'JAX'
  | 'KC'
  | 'LAC'
  | 'LAR'
  | 'LV'
  | 'MIA'
  | 'MIN'
  | 'NE'
  | 'NO'
  | 'NYG'
  | 'NYJ'
  | 'PHI'
  | 'PIT'
  | 'SEA'
  | 'SF'
  | 'TB'
  | 'TEN'
  | 'WAS';

export interface TeamPalette {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
}

export interface TeamMeta {
  readonly code: NflTeamCode;
  /** Ville pseudonymisee utilisee dans l'UI (cf. Q8 pseudonymisation). */
  readonly city: string;
  /** Race BB attribuee a l'equipe (Q5 : fixe par equipe). */
  readonly race: BbRace;
  /** Libelle complet ex. "Kansas City Skaven", utilise en branding UI. */
  readonly raceLabel: string;
  /** Couleurs officielles (utilisees pour avatars BB + UI). */
  readonly palette: TeamPalette;
}
