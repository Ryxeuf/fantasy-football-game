/**
 * N.4b — IA contrainte aux 5 equipes prioritaires (Sprint 15).
 *
 * L'IA adversaire (mode pratique N.4, tutoriel interactif N.1/N.2) ne peut
 * etre affectee qu'aux rosters du MVP tant que le contenu n'est pas complete
 * pour les autres equipes. Ce module expose la whitelist partagee, un garde
 * d'autorisation et un helper de selection reproductible via RNG seede.
 *
 * La whitelist est strictement derivee de `PRIORITY_TEAM_ROSTERS` afin que les
 * deux sources de verite restent alignees sans duplication.
 */

import type { RNG } from '../core/types';
import { makeRNG } from '../utils/rng';
import {
  PRIORITY_TEAM_ROSTERS,
  type PriorityTeamRoster,
} from '../rosters/priority-teams';

export type AIOpponentRoster = PriorityTeamRoster;

export const AI_OPPONENT_ALLOWED_ROSTERS: readonly AIOpponentRoster[] = Object.freeze(
  [...PRIORITY_TEAM_ROSTERS],
);

const ALLOWED_SET: ReadonlySet<string> = new Set<string>(AI_OPPONENT_ALLOWED_ROSTERS);

export function listAIOpponentAllowedRosters(): readonly AIOpponentRoster[] {
  return AI_OPPONENT_ALLOWED_ROSTERS;
}

export function isAIOpponentRosterAllowed(slug: string): slug is AIOpponentRoster {
  return ALLOWED_SET.has(slug);
}

export interface PickAIOpponentRosterOptions {
  readonly rng?: RNG;
  readonly exclude?: readonly string[];
}

export function pickAIOpponentRoster(
  options: PickAIOpponentRosterOptions = {},
): AIOpponentRoster | null {
  const exclusions = new Set<string>(options.exclude ?? []);
  const pool = AI_OPPONENT_ALLOWED_ROSTERS.filter(slug => !exclusions.has(slug));
  if (pool.length === 0) return null;

  const rng: RNG = options.rng ?? makeRNG('ai-opponent-default');
  const raw = Math.floor(rng() * pool.length);
  const idx = Math.max(0, Math.min(raw, pool.length - 1));
  return pool[idx];
}
