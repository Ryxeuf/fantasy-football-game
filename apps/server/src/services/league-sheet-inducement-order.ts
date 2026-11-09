/**
 * Ordre d'achat des coups de pouce d'avant-match — PUR.
 *
 * BB2025 : le favori (VEA la plus haute) dépense d'abord sa trésorerie, puis
 * l'outsider reçoit sa Petite Monnaie (écart de VEA + dépense du favori). Le
 * favori le signale par « J'ai fini mes achats » (`inducementsDone<Side>At`).
 * Tant qu'il ne l'a pas fait, l'outsider est prévenu que son budget est
 * PROVISOIRE — sans blocage : il peut saisir, et le commissaire n'attend
 * jamais personne.
 *
 * Pas de favori à VEA égales, ni quand le favori n'a rien à dépenser (coupe
 * sans trésorerie, trésorerie vide) : il n'y a alors rien à attendre.
 */

import type { SheetSide } from "./league-sheet-inducement-budget";

export interface InducementOrderInput {
  /** Côté à la VEA strictement la plus haute, `null` à égalité. */
  readonly favorite: SheetSide | null;
  /** Budget de coups de pouce du favori (0 = rien à acheter). */
  readonly favoriteMaxBudget: number;
  readonly doneHomeAt: Date | string | null | undefined;
  readonly doneAwayAt: Date | string | null | undefined;
  /** Feuille validée : l'avant-match est clos, plus rien à attendre. */
  readonly validated: boolean;
}

export interface InducementOrderState {
  /** Favori qui achète en premier, `null` si l'ordre ne s'applique pas. */
  readonly favorite: SheetSide | null;
  /** Le favori a confirmé avoir fini ses achats. */
  readonly favoriteDone: boolean;
  /** Côté dont on attend les achats (le favori non confirmé), sinon `null`. */
  readonly waitingFor: SheetSide | null;
  /** Côté dont le budget est provisoire (l'outsider en attente), sinon `null`. */
  readonly provisionalSide: SheetSide | null;
}

function otherSide(side: SheetSide): SheetSide {
  return side === "home" ? "away" : "home";
}

export function inducementOrderState(
  input: InducementOrderInput,
): InducementOrderState {
  const favorite =
    input.favorite && input.favoriteMaxBudget > 0 ? input.favorite : null;
  if (!favorite) {
    return {
      favorite: null,
      favoriteDone: false,
      waitingFor: null,
      provisionalSide: null,
    };
  }
  const doneAt = favorite === "home" ? input.doneHomeAt : input.doneAwayAt;
  const favoriteDone = doneAt != null;
  const waiting = !favoriteDone && !input.validated;
  return {
    favorite,
    favoriteDone,
    waitingFor: waiting ? favorite : null,
    provisionalSide: waiting ? otherSide(favorite) : null,
  };
}

function parseList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * La liste de coups de pouce d'un côté change-t-elle ? Tolérant au stockage
 * (array natif PG ou chaîne SQLite) ; `null`/absent vaut liste vide. Une
 * modification efface la confirmation « fini mes achats » du côté.
 */
export function inducementListChanged(stored: unknown, next: unknown): boolean {
  return JSON.stringify(parseList(stored)) !== JSON.stringify(parseList(next));
}
