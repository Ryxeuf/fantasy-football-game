/**
 * Lot 3 « cerveau du coach » — PERSONNALITÉ d'un joueur : cinq traits dans
 * [0, 100] dérivés de l'identifiant du joueur (stables d'un match à l'autre,
 * sans colonne : le lot 4 pourra les persister et les faire évoluer).
 *
 * - `aggression` : goût du blocage et du blitz ;
 * - `caution` : refus des jets risqués ;
 * - `greed` : envie de porter / recevoir le ballon ;
 * - `discipline` : retenue sur les agressions et les GFI ;
 * - `clutch` : sang-froid aux tours 7-8 (température réduite).
 */

export interface PlayerPersonality {
  readonly aggression: number;
  readonly caution: number;
  readonly greed: number;
  readonly discipline: number;
  readonly clutch: number;
}

/** FNV-1a 32 bits, suffisant pour dériver des traits reproductibles. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function trait(playerId: string, salt: string): number {
  // Centré autour de 50 : la somme de deux tirages uniformes resserre la
  // distribution (peu de joueurs extrêmes, comme dans une vraie équipe).
  const a = hashString(`${salt}:${playerId}`) % 101;
  const b = hashString(`${playerId}:${salt}`) % 101;
  return Math.round((a + b) / 2);
}

const CACHE = new Map<string, PlayerPersonality>();

export function personalityFor(playerId: string): PlayerPersonality {
  const cached = CACHE.get(playerId);
  if (cached) return cached;
  const p: PlayerPersonality = Object.freeze({
    aggression: trait(playerId, 'aggression'),
    caution: trait(playerId, 'caution'),
    greed: trait(playerId, 'greed'),
    discipline: trait(playerId, 'discipline'),
    clutch: trait(playerId, 'clutch'),
  });
  CACHE.set(playerId, p);
  return p;
}

/** Facteur multiplicatif [1 − span, 1 + span] pour un trait 0..100. */
export function traitFactor(value: number, span: number): number {
  return 1 + ((Math.max(0, Math.min(100, value)) - 50) / 50) * span;
}
