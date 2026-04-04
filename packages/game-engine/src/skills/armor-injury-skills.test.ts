import { describe, it, expect } from 'vitest';
import {
  getArmorSkillContext,
  getInjurySkillModifiers,
  getFoulArmorSkillModifiers,
} from './skill-bridge';
import type { Player, GameState } from '../core/types';
import { setup } from '../core/game-state';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 9,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function makeState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  return state;
}

describe('Règle: Claws + Iron Hard Skin (armor skills)', () => {
  it('returns clawsActive=false when attacker has no Claws', () => {
    const attacker = makePlayer({ id: 'att', skills: [] });
    const defender = makePlayer({ id: 'def', team: 'B', av: 10 });
    const state = makeState([attacker, defender]);
    const ctx = getArmorSkillContext(state, attacker, defender);
    expect(ctx.clawsActive).toBe(false);
  });

  it('returns clawsActive=true when attacker has Claws', () => {
    const attacker = makePlayer({ id: 'att', skills: ['claws'] });
    const defender = makePlayer({ id: 'def', team: 'B', av: 10 });
    const state = makeState([attacker, defender]);
    const ctx = getArmorSkillContext(state, attacker, defender);
    expect(ctx.clawsActive).toBe(true);
  });

  it('returns clawsActive=true with "claw" slug variant', () => {
    const attacker = makePlayer({ id: 'att', skills: ['claw'] });
    const defender = makePlayer({ id: 'def', team: 'B', av: 10 });
    const state = makeState([attacker, defender]);
    const ctx = getArmorSkillContext(state, attacker, defender);
    expect(ctx.clawsActive).toBe(true);
  });

  it('Iron Hard Skin negates Claws', () => {
    const attacker = makePlayer({ id: 'att', skills: ['claws'] });
    const defender = makePlayer({ id: 'def', team: 'B', av: 10, skills: ['iron-hard-skin'] });
    const state = makeState([attacker, defender]);
    const ctx = getArmorSkillContext(state, attacker, defender);
    expect(ctx.clawsActive).toBe(false);
  });

  it('Iron Hard Skin with underscore variant negates Claws', () => {
    const attacker = makePlayer({ id: 'att', skills: ['claws'] });
    const defender = makePlayer({ id: 'def', team: 'B', av: 10, skills: ['iron_hard_skin'] });
    const state = makeState([attacker, defender]);
    const ctx = getArmorSkillContext(state, attacker, defender);
    expect(ctx.clawsActive).toBe(false);
  });

  it('Iron Hard Skin alone does nothing special', () => {
    const attacker = makePlayer({ id: 'att', skills: [] });
    const defender = makePlayer({ id: 'def', team: 'B', av: 10, skills: ['iron-hard-skin'] });
    const state = makeState([attacker, defender]);
    const ctx = getArmorSkillContext(state, attacker, defender);
    expect(ctx.clawsActive).toBe(false);
  });
});

describe('Règle: Thick Skull (injury modifier)', () => {
  it('returns 0 for player with no skills', () => {
    const player = makePlayer();
    const state = makeState([player]);
    const mod = getInjurySkillModifiers(state, player);
    expect(mod).toBe(0);
  });

  it('returns -1 for player with Thick Skull', () => {
    const player = makePlayer({ skills: ['thick-skull'] });
    const state = makeState([player]);
    const mod = getInjurySkillModifiers(state, player);
    expect(mod).toBe(-1);
  });

  it('returns -1 with hyphenated slug', () => {
    const player = makePlayer({ skills: ['thick-skull'] });
    const state = makeState([player]);
    const mod = getInjurySkillModifiers(state, player);
    expect(mod).toBe(-1);
  });
});

describe('Règle: Dirty Player (foul armor modifier)', () => {
  it('returns 0 for player with no skills', () => {
    const player = makePlayer();
    const state = makeState([player]);
    const mods = getFoulArmorSkillModifiers(state, player);
    expect(mods).toBe(0);
  });

  it('returns +1 for player with Dirty Player', () => {
    const player = makePlayer({ skills: ['dirty-player-1'] });
    const state = makeState([player]);
    const mods = getFoulArmorSkillModifiers(state, player);
    expect(mods).toBe(1);
  });

  it('returns +1 with dirty-player-1 slug', () => {
    const player = makePlayer({ skills: ['dirty-player-1'] });
    const state = makeState([player]);
    const mods = getFoulArmorSkillModifiers(state, player);
    expect(mods).toBe(1);
  });
});
