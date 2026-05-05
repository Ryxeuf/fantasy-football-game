/**
 * IA temperature — sprint Pro League 0.B.5.
 *
 * Au lieu de toujours prendre l'action max-EV (deterministe et tres
 * previsible), le driver hybride (0.A.2) sample sur les top-K candidats
 * via un softmax dont la temperature est pilotee par le `riskAppetite`
 * du `TacticalProfile` (0.B.2). Cela genere de la variance entre matchs
 * theoriquement identiques (par exemple deux Pittsburgh-vs-Chicago
 * lances avec le meme TV mais des seeds differents).
 *
 * Reference : softmax stable (Vigna/StackExchange) — soustraction du
 * max avant exp pour eviter l'overflow numerique.
 */

import type { Rng } from '../rng/seeded';

/** Candidate avec un score brut (EV / heuristique / weight). Le score
 *  peut etre negatif ou positif ; seules les *differences* comptent. */
export interface WeightedCandidate<T> {
  value: T;
  score: number;
}

/**
 * Mappe `riskAppetite` (0..100) vers une temperature softmax :
 * - 0 → 0 (argmax pur, IA glaciale)
 * - 50 → ~1.0 (baseline neutre, distribution balancee)
 * - 100 → ~2.5 (IA brulante, presque uniforme)
 *
 * Choix d'une fonction lineaire `risk / 40` sur [0, 100], donne :
 * - risk=0 → T=0
 * - risk=50 → T=1.25
 * - risk=100 → T=2.5
 *
 * Volontairement simple — la tuning loop (lot 0.E.1) pourra basculer
 * vers une courbe non-lineaire si besoin sans casser l'API.
 */
export function riskAppetiteToTemperature(riskAppetite: number): number {
  if (!Number.isFinite(riskAppetite)) return 0;
  const clamped = Math.max(0, Math.min(100, riskAppetite));
  return clamped / 40;
}

/**
 * Sample un candidat selon une distribution softmax stabilisee.
 * - `temperature === 0` -> argmax deterministe (premier max si egalites).
 * - `temperature > 0` -> probabilite `exp(score_i / T) / sum(exp(score_j / T))`.
 *
 * Throws sur input vide, scores non-finis, temperature negative.
 */
export function softmaxSample<T>(
  rng: Pick<Rng, 'next'>,
  candidates: readonly WeightedCandidate<T>[],
  temperature: number
): T {
  if (candidates.length === 0) {
    throw new Error('softmaxSample: candidates list must be non-empty');
  }
  if (!Number.isFinite(temperature) || temperature < 0) {
    throw new Error('softmaxSample: temperature must be a non-negative finite number');
  }
  for (const c of candidates) {
    if (!Number.isFinite(c.score)) {
      throw new Error('softmaxSample: each candidate score must be a finite number');
    }
  }

  if (candidates.length === 1) return candidates[0].value;

  if (temperature === 0) {
    // Argmax (first occurrence wins on ties).
    let bestIdx = 0;
    let bestScore = candidates[0].score;
    for (let i = 1; i < candidates.length; i += 1) {
      if (candidates[i].score > bestScore) {
        bestScore = candidates[i].score;
        bestIdx = i;
      }
    }
    return candidates[bestIdx].value;
  }

  // Stable softmax : subtract max score to avoid exp overflow.
  let maxScore = candidates[0].score;
  for (let i = 1; i < candidates.length; i += 1) {
    if (candidates[i].score > maxScore) maxScore = candidates[i].score;
  }

  const weights: number[] = new Array(candidates.length);
  let totalWeight = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    const w = Math.exp((candidates[i].score - maxScore) / temperature);
    weights[i] = w;
    totalWeight += w;
  }

  // Inverse-CDF sampling.
  const draw = rng.next() * totalWeight;
  let acc = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    acc += weights[i];
    if (draw < acc) return candidates[i].value;
  }
  // Floating-point fallback : return the last candidate.
  return candidates[candidates.length - 1].value;
}
