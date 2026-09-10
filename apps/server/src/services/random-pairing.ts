/**
 * Tirage au sort d'une ronde (moteur PUR, sans I/O).
 *
 * La ronde suisse apparie sur le CLASSEMENT : c'est ce qu'on veut à partir
 * de la ronde 2, mais pas pour la première — à la ronde 1 le classement est
 * vide et l'appariement « suisse » se réduit à l'ordre alphabétique, ce qui
 * n'a rien d'un tirage. La plupart des tournois tirent donc la première
 * ronde au sort.
 *
 * Plutôt que d'écrire un second appariement, on MÉLANGE l'ordre des équipes
 * et on rend la main au moteur suisse : lui seul sait éviter les rematches
 * (avec retour arrière), choisir l'exempt tournant et équilibrer les
 * réceptions. Un tirage au sort n'est donc rien d'autre qu'un appariement
 * suisse sur un ordre aléatoire — et il hérite gratuitement de toutes ces
 * garanties.
 *
 * DÉTERMINISTE à graine donnée : deux appels avec la même graine rendent la
 * même ronde. C'est ce qui rend le tirage rejouable et testable, et ce qui
 * évite qu'un double clic ne produise deux rondes différentes.
 */

import { generateSwissRound, type SwissHistory, type SwissRoundResult } from "./swiss-pairing";

/**
 * PRNG déterministe (mulberry32). 32 bits d'état, distribution suffisante
 * pour un mélange de quelques dizaines d'équipes, et surtout reproductible
 * d'une machine à l'autre — `Math.random()` ne l'est pas.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hachage stable d'une graine textuelle (FNV-1a 32 bits). */
export function seedToInt(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Mélange de Fisher-Yates piloté par la graine. Ne mute pas l'entrée.
 */
export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const out = [...items];
  const rand = mulberry32(seedToInt(seed));
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Ronde tirée au sort. `seed` doit identifier la ronde (coupe + numéro) pour
 * que le tirage soit rejouable : deux rondes de la même coupe ne doivent pas
 * partager leur graine, sinon elles rendraient le même ordre.
 */
export function generateRandomRound(
  teamIds: readonly string[],
  history: SwissHistory,
  seed: string,
): SwissRoundResult {
  const shuffled = shuffleWithSeed(teamIds, seed);
  return generateSwissRound(
    shuffled.map((teamId) => ({ teamId })),
    history,
  );
}
