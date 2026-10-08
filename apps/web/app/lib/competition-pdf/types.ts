/**
 * Modèles de VUE des exports PDF de compétition.
 *
 * Les documents ne connaissent ni l'API ni la compétition : une ligue et une
 * coupe se traduisent vers ces mêmes formes (cf. `adapters/`). C'est ce qui
 * garde UN seul rendu par document — le jour où la coupe gagne une colonne,
 * c'est son adaptateur qui change, pas un second gabarit.
 *
 * Tout libellé est déjà résolu (nom de roster lisible, statut traduit, date
 * formatée) : le rendu n'a aucune règle métier à redériver.
 */

export type CompetitionKind = "league" | "cup";

export interface PdfMeta {
  /** Nom de la ligue ou de la coupe. */
  competitionName: string;
  competitionKind: CompetitionKind;
  /** Saison (ligue) — absent pour une coupe. */
  seasonName?: string | null;
  /** Horodatage imprimé en pied de page. */
  generatedAt: Date;
}

export interface PdfTeamRef {
  name: string;
  coach?: string | null;
  /** Nom LISIBLE du roster (« Rois des Tombes »), jamais le slug. */
  rosterName?: string | null;
}

// ─── Rencontres ──────────────────────────────────────────────────────────────

export interface PdfFixture {
  home: PdfTeamRef | null;
  /** `null` = exempt (ronde suisse impaire). */
  away: PdfTeamRef | null;
  /** Statut déjà traduit (« À jouer », « Jouée », « Forfait domicile »). */
  statusLabel: string;
  score?: { home: number; away: number } | null;
  /** Date prévue déjà formatée. */
  scheduledLabel?: string | null;
  /** Bracket : le second qualifié n'est pas encore connu. */
  placeholder?: boolean;
}

export interface PdfFixtureGroup {
  /** Nom de la poule ; `null` = compétition à plat. */
  label: string | null;
  fixtures: PdfFixture[];
}

export interface PdfRound {
  /** « Journée 3 — Les Jardins de Morr », « Ronde 2 ». */
  title: string;
  /** Dates, système d'appariement… */
  subtitle?: string | null;
  statusLabel?: string | null;
  groups: PdfFixtureGroup[];
}

export interface MatchdayDocument {
  meta: PdfMeta;
  round: PdfRound;
}

export interface CalendarDocument {
  meta: PdfMeta;
  rounds: PdfRound[];
}

// ─── Classements ─────────────────────────────────────────────────────────────

export interface PdfColumn {
  /** Abréviation imprimée en en-tête (« TD+ »). */
  label: string;
  /** Définition imprimée en légende (« Touchdowns marqués »). */
  legend?: string;
  /** Colonne mise en valeur (points). */
  emphasis?: boolean;
}

export interface PdfTableRow {
  team: PdfTeamRef;
  cells: Array<string | number>;
  /** Ligne grisée (équipe retirée). */
  muted?: boolean;
}

export interface PdfStandingsTable {
  /** Nom de la poule ; `null` = classement général. */
  title: string | null;
  /** Les N premières lignes sont marquées qualifiées. */
  qualifies: number;
  columns: PdfColumn[];
  rows: PdfTableRow[];
}

export interface StandingsDocument {
  meta: PdfMeta;
  tables: PdfStandingsTable[];
  /** « Victoire 3 · Nul 1 · Défaite 0 · Forfait -1 ». */
  scoringNote?: string | null;
  /** Départages appliqués, dans l'ordre. */
  tieBreakNote?: string | null;
}

// ─── Tops ────────────────────────────────────────────────────────────────────

export interface PdfLeaderRow {
  rank: number;
  name: string;
  /** Équipe, poste, coach… */
  detail?: string | null;
  value: number | string;
}

export interface PdfLeaderCategory {
  label: string;
  description?: string | null;
  rows: PdfLeaderRow[];
}

export interface PdfLeaderSection {
  title: string;
  categories: PdfLeaderCategory[];
}

export interface LeaderboardsDocument {
  meta: PdfMeta;
  sections: PdfLeaderSection[];
}

// ─── Play-offs ───────────────────────────────────────────────────────────────

export interface PdfBracketStage {
  /** « Quarts de finale », « Demi-finales », « Finale ». */
  label: string;
  fixtures: PdfFixture[];
}

export interface BracketDocument {
  meta: PdfMeta;
  stages: PdfBracketStage[];
  champion?: PdfTeamRef | null;
  /** « Bracket provisoire — non publié », taille, etc. */
  note?: string | null;
}

// ─── Statistiques ────────────────────────────────────────────────────────────

export interface PdfKeyFigure {
  label: string;
  value: string | number;
}

export interface PdfAward {
  label: string;
  description?: string | null;
  /** Lauréats (ex-aequo séparés par des virgules). */
  winners: string;
  value: string | number;
}

export interface StatsDocument {
  meta: PdfMeta;
  keyFigures: PdfKeyFigure[];
  awards: PdfAward[];
  /** Totaux par équipe. */
  teamTable: PdfStandingsTable;
}

// ─── Feuille de rencontre ────────────────────────────────────────────────────

export interface PdfPlayerStats {
  ma: number;
  st: number;
  ag: number;
  pa: number | null;
  av: number;
}

export interface PdfSheetPlayerTally {
  td?: number;
  pass?: number;
  rec?: number;
  int?: number;
  cas?: number;
  agg?: number;
  ttm?: number;
  land?: number;
  exp?: number;
  motm?: boolean;
  injury?: string | null;
  spp?: number;
}

export interface PdfSheetPlayer {
  number: number | null;
  name: string;
  position: string;
  stats?: PdfPlayerStats | null;
  skills: string;
  spp?: number | null;
  /** Mention (« Journalier », « Star Player », « Absent : Amoché »). */
  note?: string | null;
  /** Ne joue pas ce match : ligne grisée, cases barrées. */
  unavailable?: boolean;
  /** Saisie déjà faite sur le site (feuille entamée ou validée). */
  tally?: PdfSheetPlayerTally | null;
}

export interface PdfSheetTeam {
  team: PdfTeamRef;
  teamValue?: number | null;
  currentValue?: number | null;
  treasury?: number | null;
  dedicatedFans?: number | null;
  staff?: {
    rerolls: number;
    cheerleaders: number;
    assistants: number;
    apothecary: boolean;
  } | null;
  players: PdfSheetPlayer[];
}

export interface PdfSheetEvent {
  half?: number | null;
  turn?: number | null;
  side: "home" | "away" | null;
  kind: string;
  actor?: string | null;
  target?: string | null;
  injury?: string | null;
  detail?: string | null;
}

export interface PdfSheetInducement {
  name: string;
  qty: number;
  cost: number;
}

export interface PdfSheetPrefill {
  weatherTable?: string | null;
  weather?: string | null;
  tossWinner?: "home" | "away" | null;
  tossChoice?: "kick" | "receive" | null;
  popularityHome?: number | null;
  popularityAway?: number | null;
  inducementsHome?: PdfSheetInducement[];
  inducementsAway?: PdfSheetInducement[];
  prayersHome?: string[];
  prayersAway?: string[];
  score?: { home: number; away: number } | null;
  /** Forfait déjà déclaré sur le site. */
  forfeitSide?: "home" | "away" | null;
  events?: PdfSheetEvent[];
  motm?: { home: string[]; away: string[] };
}

export interface PdfSheetRules {
  spp: boolean;
  economy: boolean;
  advancements: boolean;
  purchases: boolean;
  firings: boolean;
}

/**
 * Ce que la feuille papier fait SAISIR, dérivé du profil de saisie du site
 * (`lib/sheet-entry-profile`). Une coupe en saisie simplifiée garde le même
 * gabarit, dont on retire des sections et des colonnes.
 */
export interface PdfSheetEntry {
  /** Avant-match complet, ou réduit au forfait. */
  preMatch: "full" | "forfeit-only";
  /** Colonnes « MT » / « Tour » du journal. */
  halfAndTurn: boolean;
  /** Gravité des blessures (colonnes et légende). */
  injuryDetails: boolean;
  /** Résultat du coup d'envoi (colonne Détail et table 2D6). */
  kickoffDetails: boolean;
  /** Réceptionneur d'une passe. */
  passReceiver: boolean;
  /** Légende des évènements à saisir ; `null` = légende complète. */
  eventLegend: Array<{ code: string; label: string }> | null;
  /** Colonnes de comptage des pages d'équipe ; `null` = toutes. */
  tally: Array<{ key: keyof PdfSheetPlayerTally; legend: string }> | null;
}

export interface MatchSheetDocument {
  meta: PdfMeta;
  /** « Journée 4 », « Ronde 2 — Demi-finale ». */
  roundLabel: string;
  scheduledLabel?: string | null;
  statusLabel?: string | null;
  home: PdfSheetTeam;
  away: PdfSheetTeam;
  rules: PdfSheetRules;
  /** Profil de saisie. Absent = feuille complète (rétro-compat). */
  entry?: PdfSheetEntry | null;
  /** Table 2D6 de coup d'envoi (moteur). */
  kickoffTable: Array<{ roll: string; name: string }>;
  /** Table de météo retenue (2D6). */
  weatherTable?: { name: string; results: Array<{ roll: string; condition: string }> } | null;
  /** Prières à Nuffle (D16). */
  prayersTable?: Array<{ roll: string; name: string }>;
  prefill?: PdfSheetPrefill | null;
}
