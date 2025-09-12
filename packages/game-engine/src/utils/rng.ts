/**
 * Système de génération de nombres aléatoires déterministe
 * Utilise l'algorithme mulberry32 pour assurer la reproductibilité
 */

import { RNG } from '../core/types';

/**
 * Crée un générateur de nombres aléatoires déterministe à partir d'une graine
 * @param seed - La graine pour initialiser le générateur
 * @returns Une fonction RNG qui génère des nombres entre 0 et 1
 */
export function makeRNG(seed: string): RNG {
  // hash string -> 32-bit
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let t = h >>> 0;
  return function mulberry32() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
