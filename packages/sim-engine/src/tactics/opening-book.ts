/**
 * Sprint Pro League — Lot 3.A.0.c : opening book par race.
 *
 * Le scoring AI (`scoreMove`, `scoreMove2Ply`) est neutre — il évalue
 * chaque coup sur la position courante. Mais en BB, l'**opening de
 * match** dépend largement de la race :
 *
 *  - Wood Elves / Skaven   → ouvrir vite, pass / breakaway
 *  - Orcs / Khorne / Norse → form a cage, blitz le porteur
 *  - Halflings             → turtle, attendre le Treeman
 *  - Dwarves               → ralentir le tempo, build position
 *
 * L'opening book est un **bonus additif** appliqué par-dessus
 * `scoreMove` :
 *
 *     score(move) = scoreMove(...) + openingBookBonus(rules, turn, move.type)
 *
 * Avantages de ce design :
 *  - Aucun couplage avec game-engine (AI module reste vierge)
 *  - Bonus = simple addition → garde le scoring déterministe
 *  - Per-turn → l'IA "sort" naturellement de l'opening après les
 *    premiers tours et retombe sur la stratégie générale
 *  - Per-race → signature racée préservée même si la stratégie de
 *    base est identique
 *
 * Le full driver (Lot 3.A.2) applique ces bonus côté orchestrateur,
 * pas dans le sim de game-engine.
 */

import type { Move } from '@bb/game-engine';

/** Type discriminant des Move BB. Sous-ensemble couvert par l'opening
 *  book — les autres moves ne sont pas biaisés en opening. */
export type OpeningBookMoveType =
  | 'MOVE'
  | 'BLOCK'
  | 'BLITZ'
  | 'PASS'
  | 'HANDOFF'
  | 'FOUL'
  | 'END_TURN';

export interface OpeningBookRule {
  /** Plage [start, end] inclusive de turns BB où la règle s'applique. */
  readonly turnRange: readonly [number, number];
  /** Type de coup biaisé. Le scoring d'un autre type reste inchangé. */
  readonly moveType: OpeningBookMoveType;
  /** Bonus additif au scoreMove. Peut être négatif pour décourager. */
  readonly bonus: number;
  /** Free-form note pour l'audit / debug ("Wood Elves love passes"). */
  readonly note?: string;
}

export interface RaceOpeningBook {
  /** Race exacte (match strict avec `ProTeamProfile.race`). */
  readonly race: string;
  /** Règles à composer additivement par tour. */
  readonly rules: readonly OpeningBookRule[];
}

/**
 * Catalogue des opening books par race. Volontairement léger et
 * conservateur — biais ±5 à ±25 par règle pour ne pas écraser le
 * scoring 1-ply / 2-ply existant.
 *
 * Tuning à faire en Lot 3.A.3 sur la base du benchmark FUMBBL.
 */
export const RACE_OPENING_BOOKS: readonly RaceOpeningBook[] = Object.freeze([
  {
    race: 'Wood Elf',
    rules: [
      { turnRange: [1, 3], moveType: 'PASS', bonus: 20, note: 'Open with deep passes' },
      { turnRange: [1, 2], moveType: 'MOVE', bonus: 5, note: 'Spread receivers' },
    ],
  },
  {
    race: 'Pro Elf',
    rules: [
      { turnRange: [1, 4], moveType: 'PASS', bonus: 15 },
      { turnRange: [1, 2], moveType: 'MOVE', bonus: 4 },
    ],
  },
  {
    race: 'Dark Elf',
    rules: [
      { turnRange: [1, 4], moveType: 'BLITZ', bonus: 8, note: 'Punish exposed carriers' },
      { turnRange: [1, 3], moveType: 'PASS', bonus: 10 },
    ],
  },
  {
    race: 'Skaven',
    rules: [
      { turnRange: [1, 3], moveType: 'PASS', bonus: 18, note: 'Gutter Runner deep' },
      { turnRange: [1, 2], moveType: 'MOVE', bonus: 6, note: 'Wide formation' },
    ],
  },
  {
    race: 'Amazon',
    rules: [
      { turnRange: [1, 4], moveType: 'BLOCK', bonus: 8, note: 'Dodge skill, abuse blocks' },
      { turnRange: [1, 3], moveType: 'BLITZ', bonus: 6 },
    ],
  },
  {
    race: 'Orc',
    rules: [
      { turnRange: [1, 5], moveType: 'BLOCK', bonus: 14, note: 'Bash everything down' },
      { turnRange: [1, 3], moveType: 'BLITZ', bonus: 10 },
      { turnRange: [1, 2], moveType: 'PASS', bonus: -15, note: 'Orcs hate passing' },
    ],
  },
  {
    race: 'Norse',
    rules: [
      { turnRange: [1, 5], moveType: 'BLOCK', bonus: 12 },
      { turnRange: [1, 3], moveType: 'BLITZ', bonus: 8 },
    ],
  },
  {
    race: 'Beastmen',
    rules: [
      { turnRange: [1, 5], moveType: 'BLOCK', bonus: 10 },
      { turnRange: [1, 3], moveType: 'FOUL', bonus: 5 },
    ],
  },
  {
    race: 'Undead',
    rules: [
      { turnRange: [1, 8], moveType: 'BLOCK', bonus: 8, note: 'Mummies grind' },
      { turnRange: [1, 5], moveType: 'BLITZ', bonus: 6 },
    ],
  },
  {
    race: 'Tomb Kings',
    rules: [
      { turnRange: [1, 8], moveType: 'BLOCK', bonus: 10 },
      { turnRange: [1, 4], moveType: 'BLITZ', bonus: 6 },
    ],
  },
  {
    race: 'Lizardmen',
    rules: [
      { turnRange: [1, 4], moveType: 'BLITZ', bonus: 12, note: 'Saurus blitz' },
      { turnRange: [1, 6], moveType: 'BLOCK', bonus: 6 },
    ],
  },
  {
    race: 'Dwarf',
    rules: [
      { turnRange: [1, 8], moveType: 'BLOCK', bonus: 10, note: 'Stand firm grind' },
      { turnRange: [3, 8], moveType: 'END_TURN', bonus: -3, note: 'Burn clock late' },
    ],
  },
  {
    race: 'Halfling',
    rules: [
      { turnRange: [1, 8], moveType: 'END_TURN', bonus: -2, note: 'Turtle until trees act' },
      { turnRange: [1, 5], moveType: 'BLOCK', bonus: -10, note: 'Avoid fights' },
    ],
  },
  {
    race: 'Ogre',
    rules: [
      { turnRange: [1, 8], moveType: 'BLOCK', bonus: 16, note: 'Smash with snotlings cover' },
      { turnRange: [1, 4], moveType: 'BLITZ', bonus: 12 },
    ],
  },
]);

const BOOK_BY_RACE: ReadonlyMap<string, RaceOpeningBook> = new Map(
  RACE_OPENING_BOOKS.map((b) => [b.race, b])
);

/** Lookup case-sensitive sur le nom de race. Retourne `undefined` si
 *  la race n'a pas d'entry (utile pour les tests / mock teams). */
export function getOpeningBookForRace(race: string): RaceOpeningBook | undefined {
  return BOOK_BY_RACE.get(race);
}

/**
 * Calcule le bonus additif à appliquer sur `scoreMove` pour un coup
 * donné, en fonction du tour BB courant et de la race.
 *
 * Convention : si `book` est `undefined` ou si aucune règle ne
 * matche, retourne 0 (pas de biais → comportement legacy strict).
 *
 * @param book Opening book de la race ou undefined
 * @param turnNumber Tour BB en cours (1-based, comme `state.turnNumber`)
 * @param moveType Type du Move scoré
 */
export function openingBookBonus(
  book: RaceOpeningBook | undefined,
  turnNumber: number,
  moveType: Move['type']
): number {
  if (!book) return 0;
  let bonus = 0;
  for (const rule of book.rules) {
    if (turnNumber < rule.turnRange[0] || turnNumber > rule.turnRange[1]) {
      continue;
    }
    if (rule.moveType !== moveType) continue;
    bonus += rule.bonus;
  }
  return bonus;
}

/**
 * Convenience overload : lookup par race + appel direct, courant
 * dans le full driver.
 */
export function openingBookBonusForRace(
  race: string,
  turnNumber: number,
  moveType: Move['type']
): number {
  return openingBookBonus(getOpeningBookForRace(race), turnNumber, moveType);
}
