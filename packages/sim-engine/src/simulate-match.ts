/**
 * Public entrypoint for the Pro League sim engine.
 *
 * Sprint Pro League — taches 0.A.1 a 0.A.5 lui ont fourni le contrat,
 * la PRNG seedee, le format MatchEvent et les resolvers BB. La tache
 * 0.A.2 (driver hybride) execute desormais effectivement le match en
 * orchestrant ces pieces : `simulateMatch` ne fait que valider les
 * inputs et deleguer a `runHybridDriver`.
 */

import { runHybridDriver } from './driver/hybrid-driver';
import type { SimInput, SimResult } from './types';

function validate(input: SimInput): void {
  if (!input || typeof input !== 'object') {
    throw new Error('simulateMatch: input is required');
  }
  if (typeof input.seed !== 'number' || !Number.isFinite(input.seed)) {
    throw new Error('simulateMatch: input.seed must be a finite number');
  }
  if (!input.home || !input.away) {
    throw new Error('simulateMatch: input.home and input.away are required');
  }
  if (input.home.id === input.away.id) {
    throw new Error('simulateMatch: home and away teams must have distinct ids');
  }
  if (input.home.side !== 'home' || input.away.side !== 'away') {
    throw new Error('simulateMatch: team sides are inverted');
  }
}

export function simulateMatch(input: SimInput): SimResult {
  validate(input);
  return runHybridDriver(input);
}
