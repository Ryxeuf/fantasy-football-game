/**
 * BUG fix : Star Player rules « once-per-match » (Crushing Blow,
 * Pirouette, Casse-Os) gating sur `!isStarPlayerRuleUsed(...)` mais
 * `markStarPlayerRuleUsed` n'était jamais appelé. Conséquence : ces
 * skills firaient à chaque trigger → infinite uses.
 *
 * Fix : ajout de `oncePerMatchSlug` aux registrations + helper
 * `consumeOncePerMatchSkills` appelé après le jet d'armure.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyMove } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import { isStarPlayerRuleUsed } from './star-player-rules';
import { getOncePerMatchSlugsToConsume } from './skill-registry';
import { consumeOncePerMatchSkills } from './skill-bridge';
import type { GameState, Player } from '../core/types';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p', team: 'A', pos: { x: 5, y: 5 }, name: 'P', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 8,
    skills: [], pm: 6, state: 'active', ...overrides,
  };
}

describe('Star player rules — once-per-match (markUsed)', () => {
  it("getOncePerMatchSlugsToConsume retourne 'crushing-blow' pour un joueur avec ce skill au trigger on-armor", () => {
    const player = makePlayer({ skills: ['crushing-blow'] });
    const state = { ...setup(), usedStarPlayerRules: {} };
    const opponent = makePlayer({ id: 'v', team: 'B' });

    const slugs = getOncePerMatchSlugsToConsume(player, 'on-armor', { state, opponent });
    expect(slugs).toContain('crushing-blow');
  });

  it('après consumeOncePerMatchSkills, isStarPlayerRuleUsed retourne true', () => {
    const player = makePlayer({ skills: ['crushing-blow'] });
    let state: GameState = { ...setup(), usedStarPlayerRules: {} };
    const opponent = makePlayer({ id: 'v', team: 'B' });

    expect(isStarPlayerRuleUsed(state, player.id, 'crushing-blow')).toBe(false);
    state = consumeOncePerMatchSkills(state, player, 'on-armor', { state, opponent });
    expect(isStarPlayerRuleUsed(state, player.id, 'crushing-blow')).toBe(true);
  });

  it("getOncePerMatchSlugsToConsume retourne vide si déjà utilisé (canApply gate)", () => {
    const player = makePlayer({ skills: ['crushing-blow'] });
    const state: GameState = {
      ...setup(),
      usedStarPlayerRules: { [`${player.id}:crushing-blow`]: true },
    };
    const opponent = makePlayer({ id: 'v', team: 'B' });

    const slugs = getOncePerMatchSlugsToConsume(player, 'on-armor', { state, opponent });
    expect(slugs).not.toContain('crushing-blow');
  });

  it('Pirouette est aussi tracké (on-dodge)', () => {
    const player = makePlayer({ skills: ['pirouette'] });
    const state = { ...setup(), usedStarPlayerRules: {} };

    const slugs = getOncePerMatchSlugsToConsume(player, 'on-dodge', { state });
    expect(slugs).toContain('pirouette');
  });

  it("Casse-Os est aussi tracké (on-block-attacker)", () => {
    const player = makePlayer({ skills: ['casse-os'] });
    const state = { ...setup(), usedStarPlayerRules: {} };

    const slugs = getOncePerMatchSlugsToConsume(player, 'on-block-attacker', { state });
    expect(slugs).toContain('casse-os');
  });

  it("un joueur sans skill once-per-match ne consomme rien", () => {
    const player = makePlayer({ skills: ['block', 'dodge'] });
    const state = { ...setup(), usedStarPlayerRules: {} };

    const slugs = getOncePerMatchSlugsToConsume(player, 'on-armor', { state });
    expect(slugs).toHaveLength(0);
  });
});
