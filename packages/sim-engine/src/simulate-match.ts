/**
 * Public entrypoint for the Pro League sim engine.
 *
 * Sprint Pro League — taches 0.A.1 a 0.A.5 lui ont fourni le contrat,
 * la PRNG seedee, le format MatchEvent et les resolvers BB. La tache
 * 0.A.2 (driver hybride) execute desormais effectivement le match en
 * orchestrant ces pieces : `simulateMatch` valide les inputs puis
 * delegue au driver choisi.
 *
 * Lot 3.B.1 — `simulateMatch` accepte desormais un `driverKind`
 * optionnel (`'hybrid'` par defaut) pour selectionner entre :
 *   - `runHybridDriver` (lot 0.A.2)  — synthese archetype-vs-archetype
 *   - `runFullDriver`   (lot 3.A.2)  — auto-play game-engine roster-aware
 *
 * Le sim-runner cote serveur (`pro-league-sim-runner`) lit le toggle
 * `season.driverKind` + `match.driverKindOverride` et passe la valeur
 * resolue ici. Les anciens callers sans options gardent leur behavior
 * (hybrid).
 */

import { runFullDriver } from './driver/full-driver';
import { runHybridDriver } from './driver/hybrid-driver';
import type { SimInput, SimResult } from './types';

export type SimulateDriverKind = 'hybrid' | 'full';

export interface SimulateMatchOptions {
  /** Driver de simulation. Default `'hybrid'` (rétrocompat). */
  readonly driverKind?: SimulateDriverKind;
}

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

export function simulateMatch(
  input: SimInput,
  options: SimulateMatchOptions = {}
): SimResult {
  validate(input);
  const driverKind = options.driverKind ?? 'hybrid';
  return driverKind === 'full' ? runFullDriver(input) : runHybridDriver(input);
}
