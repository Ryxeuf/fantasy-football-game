/**
 * Profil de SAISIE de la feuille de match : ce que le formulaire demande.
 *
 * Une coupe peut être réglée en saisie simplifiée (`Cup.sheetEntryMode`,
 * servi dans `competitionRules.entryMode`). La feuille reste celle de la
 * ligue — mêmes onglets, même formulaire, mêmes libellés, même parcours —
 * dont on RETIRE ce qui n'a aucun effet en coupe : on ne garde que le
 * forfait et les cinq types d'évènement que le classement et les tops
 * lisent.
 *
 * Défini UNE fois et lu par la page de la feuille ET par la feuille papier
 * PDF : ce qu'on note à table est exactement ce qu'on saisit ensuite.
 * Module PUR, sans React ni I/O.
 */

import {
  EVENT_KIND_OPTIONS,
  type EventKind,
  type EventKindOption,
} from "../leagues/pairings/[id]/sheet/event-fields";

export type SheetEntryMode = "full" | "simplified";

export interface SheetEntryProfile {
  readonly mode: SheetEntryMode;
  /** Types proposés par le sélecteur, avec leur libellé. */
  readonly eventKinds: ReadonlyArray<EventKindOption>;
  /** Listes « Mi-temps » et « Tour » (et séparateurs de mi-temps). */
  readonly halfAndTurn: boolean;
  /** Gravité de la blessure et caractéristique d'une Séquelle. */
  readonly injuryDetails: boolean;
  /** Réceptionneur d'une passe réussie. */
  readonly passReceiver: boolean;
  /** Résultat de la table de coup d'envoi (et sa table imprimée). */
  readonly kickoffDetails: boolean;
  /** Rappels de règle (PSP) sous le sélecteur de type. */
  readonly kindHints: boolean;
  /** Avant-match complet, ou réduit au seul forfait. */
  readonly preMatch: "full" | "forfeit-only";
  /** Choix du poste des journaliers. */
  readonly journeymanPosition: boolean;
  /** « Relever le Mort » / Contagieux. */
  readonly raiseDead: boolean;
  /**
   * Une agression saisie est une SORTIE marquée `meta.eliminated`, faute de
   * gravité à saisir (cf. `cup-match-sheet` côté serveur).
   */
  readonly markAggressionEliminated: boolean;
}

/** Les cinq types que la coupe compte, dans l'ordre du sélecteur de ligue. */
const SIMPLIFIED_KINDS: ReadonlySet<EventKind> = new Set([
  "touchdown",
  "casualty",
  "pass_complete",
  "interception",
  "aggression",
]);

/**
 * Seul libellé propre à la saisie simplifiée : sans gravité à saisir, une
 * agression n'y est retenue que si elle SORT sa cible — d'où un libellé
 * calqué sur « Élimination sur Blocage ».
 */
const SIMPLIFIED_LABELS: Readonly<Partial<Record<EventKind, string>>> = {
  aggression: "Élimination sur Agression",
};

const SIMPLIFIED_EVENT_KINDS: ReadonlyArray<EventKindOption> =
  EVENT_KIND_OPTIONS.filter((k) => SIMPLIFIED_KINDS.has(k.value)).map((k) => ({
    value: k.value,
    label: SIMPLIFIED_LABELS[k.value] ?? k.label,
  }));

const FULL_PROFILE: SheetEntryProfile = {
  mode: "full",
  eventKinds: EVENT_KIND_OPTIONS,
  halfAndTurn: true,
  injuryDetails: true,
  passReceiver: true,
  kickoffDetails: true,
  kindHints: true,
  preMatch: "full",
  journeymanPosition: true,
  raiseDead: true,
  markAggressionEliminated: false,
};

const SIMPLIFIED_PROFILE: SheetEntryProfile = {
  mode: "simplified",
  eventKinds: SIMPLIFIED_EVENT_KINDS,
  halfAndTurn: false,
  injuryDetails: false,
  passReceiver: false,
  kickoffDetails: false,
  kindHints: false,
  preMatch: "forfeit-only",
  journeymanPosition: false,
  raiseDead: false,
  markAggressionEliminated: true,
};

export interface SheetEntryProfileInput {
  readonly competitionKind?: "league" | "cup" | null;
  readonly competitionRules?: { readonly entryMode?: string | null } | null;
}

/**
 * Profil de la feuille servie. Seule une COUPE peut être simplifiée ; un
 * serveur antérieur (pas de `entryMode`) ou une valeur inconnue donnent la
 * saisie complète.
 */
export function sheetEntryProfile(
  input: SheetEntryProfileInput,
): SheetEntryProfile {
  const simplified =
    input.competitionKind === "cup" &&
    input.competitionRules?.entryMode === "simplified";
  return simplified ? SIMPLIFIED_PROFILE : FULL_PROFILE;
}
