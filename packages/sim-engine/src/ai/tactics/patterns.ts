/**
 * 5 patterns concrets — sprint Pro League 0.B.1.
 *
 * Chaque pattern exprime un biais (poids) sur les key moments produits
 * par le driver hybride. Le softmax final utilise ces poids comme
 * multiplicateurs sur les scores derivés du profil tactique : ainsi
 * un Pittsburgh Smashers (bash 85) en `cage-formation` enchainera
 * majoritairement des blocks coordonnes, tandis qu'un Kansas City
 * Soaring Hawks (passing 80) en `pass-route-deep` enchainera dodges
 * + passes deep.
 */

import type { Pattern } from '../types';

/** `cage-formation` — formation 3-3-2 en cage autour du porteur. */
const CAGE_FORMATION: Pattern = {
  id: 'cage-formation',
  weights: {
    block: 1.4,
    dodge: 0.9,
    pass: 0.4,
    gfi: 0.4,
    foul: 0.6,
    pickup: 0.6,
  },
};

/** `line-grind` — avance lente, blocks en série et fouls opportunistes. */
const LINE_GRIND: Pattern = {
  id: 'line-grind',
  weights: {
    block: 1.5,
    dodge: 0.6,
    pass: 0.2,
    gfi: 0.3,
    foul: 1.2,
    pickup: 0.6,
  },
};

/** `pass-route-deep` — receveur avance loin, le porteur dodge puis passe. */
const PASS_ROUTE_DEEP: Pattern = {
  id: 'pass-route-deep',
  weights: {
    block: 0.4,
    dodge: 1.3,
    pass: 1.6,
    gfi: 1.0,
    foul: 0.2,
    pickup: 0.7,
  },
};

/** `wedge` — formation triangle, bouclier offensif sur le porteur. */
const WEDGE: Pattern = {
  id: 'wedge',
  weights: {
    block: 1.3,
    dodge: 0.8,
    pass: 0.5,
    gfi: 0.5,
    foul: 0.8,
    pickup: 0.5,
  },
};

/** `screen` — ligne défensive en écran 4-4-2-1 pour fermer les routes. */
const SCREEN: Pattern = {
  id: 'screen',
  weights: {
    block: 1.2,
    dodge: 0.9,
    pass: 0.3,
    gfi: 0.3,
    foul: 0.4,
    pickup: 1.4,
  },
};

export const PATTERNS: readonly Pattern[] = Object.freeze([
  CAGE_FORMATION,
  LINE_GRIND,
  PASS_ROUTE_DEEP,
  WEDGE,
  SCREEN,
]);

export const PATTERN_BY_ID: Readonly<Record<string, Pattern>> = Object.freeze(
  Object.fromEntries(PATTERNS.map((p) => [p.id, p]))
);
