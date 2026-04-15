import { describe, it, expect } from 'vitest';
import {
  getDodgeSkillModifiers,
  getPickupSkillModifiers,
  canSkillReroll,
  checkGuard,
  checkBlockNegatesBothDown,
  checkDodgeNegatesStumble,
  checkWrestleOnBothDown,
  getMightyBlowBonusFromRegistry,
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

function makeOpponent(overrides: Partial<Player> = {}): Player {
  return makePlayer({
    id: 'opp1',
    team: 'B',
    pos: { x: 5, y: 4 },
    name: 'Opponent',
    number: 2,
    ...overrides,
  });
}

function makeState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  return state;
}

describe('Règle: Skill Bridge - Dodge Modifiers', () => {
  it('returns 0 for player with no skills', () => {
    const player = makePlayer();
    const state = makeState([player]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(0);
  });

  it('gives +1 for Two Heads', () => {
    const player = makePlayer({ skills: ['two-heads'] });
    const state = makeState([player]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(1);
  });

  it('gives +1 for Very Long Legs', () => {
    const player = makePlayer({ skills: ['very-long-legs'] });
    const state = makeState([player]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(1);
  });

  it('gives +1 for Stunty', () => {
    const player = makePlayer({ skills: ['stunty'] });
    const state = makeState([player]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(1);
  });

  it('stacks multiple dodge skills (+2 for Two Heads + Very Long Legs)', () => {
    const player = makePlayer({ skills: ['two-heads', 'very-long-legs'] });
    const state = makeState([player]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(2);
  });

  // BB3: Break Tackle is a post-roll effect (+1 / +2 once per activation) and
  // must NOT add a pre-roll modifier here. It is resolved in
  // mechanics/break-tackle.ts after the Dodge roll is made.
  it('does not contribute to pre-roll Dodge modifiers (BB3 post-roll effect)', () => {
    const player = makePlayer({ skills: ['break-tackle'], st: 5, ag: 3 });
    const state = makeState([player]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(0);
  });

  it('applies -1 for adjacent opponent with Prehensile Tail at departure', () => {
    const player = makePlayer({ pos: { x: 5, y: 5 } });
    const opp = makeOpponent({ skills: ['prehensile-tail'], pos: { x: 5, y: 4 } });
    const state = makeState([player, opp]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(-1);
  });

  it('applies -2 for adjacent opponent with Diving Tackle at departure', () => {
    const player = makePlayer({ pos: { x: 5, y: 5 } });
    const opp = makeOpponent({ skills: ['diving-tackle'], pos: { x: 5, y: 4 } });
    const state = makeState([player, opp]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(-2);
  });

  it('stacks opponent penalties from multiple opponents', () => {
    const player = makePlayer({ pos: { x: 5, y: 5 } });
    const opp1 = makeOpponent({ id: 'opp1', skills: ['prehensile-tail'], pos: { x: 5, y: 4 } });
    const opp2 = makeOpponent({ id: 'opp2', skills: ['prehensile-tail'], pos: { x: 4, y: 5 } });
    const state = makeState([player, opp1, opp2]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(-2);
  });

  it('ignores stunned opponents for skill penalties', () => {
    const player = makePlayer({ pos: { x: 5, y: 5 } });
    const opp = makeOpponent({ skills: ['prehensile-tail'], pos: { x: 5, y: 4 }, stunned: true });
    const state = makeState([player, opp]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(0);
  });

  it('combines player bonuses and opponent penalties', () => {
    const player = makePlayer({ pos: { x: 5, y: 5 }, skills: ['two-heads'] });
    const opp = makeOpponent({ skills: ['prehensile-tail'], pos: { x: 5, y: 4 } });
    const state = makeState([player, opp]);
    const mod = getDodgeSkillModifiers(state, player, player.pos);
    expect(mod).toBe(0); // +1 from Two Heads, -1 from Prehensile Tail
  });
});

describe('Règle: Skill Bridge - Pickup Modifiers', () => {
  it('returns 0 for player with no skills', () => {
    const player = makePlayer();
    const state = makeState([player]);
    const mod = getPickupSkillModifiers(state, player);
    expect(mod).toBe(0);
  });

  it('gives +1 for Extra Arms', () => {
    const player = makePlayer({ skills: ['extra-arms'] });
    const state = makeState([player]);
    const mod = getPickupSkillModifiers(state, player);
    expect(mod).toBe(1);
  });

  it('gives high bonus for Big Hand (negates tackle zone penalties)', () => {
    const player = makePlayer({ skills: ['big-hand'] });
    const state = makeState([player]);
    const mod = getPickupSkillModifiers(state, player);
    expect(mod).toBeGreaterThanOrEqual(1);
  });

  it('stacks Extra Arms + Big Hand', () => {
    const player = makePlayer({ skills: ['extra-arms', 'big-hand'] });
    const state = makeState([player]);
    const mod = getPickupSkillModifiers(state, player);
    expect(mod).toBeGreaterThan(1);
  });
});

describe('Règle: Skill Bridge - Reroll Checks', () => {
  it('allows dodge reroll with Dodge skill', () => {
    const player = makePlayer({ skills: ['dodge'] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-dodge', state)).toBe(true);
  });

  it('allows pickup reroll with Sure Hands', () => {
    const player = makePlayer({ skills: ['sure-hands'] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-pickup', state)).toBe(true);
  });

  it('allows GFI reroll with Sure Feet', () => {
    const player = makePlayer({ skills: ['sure-feet'] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-gfi', state)).toBe(true);
  });

  it('allows pass reroll with Pass skill', () => {
    const player = makePlayer({ skills: ['pass'] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-pass', state)).toBe(true);
  });

  it('allows catch reroll with Catch skill', () => {
    const player = makePlayer({ skills: ['catch'] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-catch', state)).toBe(true);
  });

  it('allows reroll with Pro skill for any trigger', () => {
    const player = makePlayer({ skills: ['pro'] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-dodge', state)).toBe(true);
    expect(canSkillReroll(player, 'on-pickup', state)).toBe(true);
    expect(canSkillReroll(player, 'on-gfi', state)).toBe(true);
  });

  it('denies reroll without appropriate skill', () => {
    const player = makePlayer({ skills: [] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-dodge', state)).toBe(false);
  });

  it('denies reroll for wrong trigger', () => {
    const player = makePlayer({ skills: ['sure-hands'] });
    const state = makeState([player]);
    expect(canSkillReroll(player, 'on-dodge', state)).toBe(false);
  });
});

describe('Règle: Skill Bridge - Block Result Skills', () => {
  it('checkGuard returns true for player with Guard', () => {
    const player = makePlayer({ skills: ['guard'] });
    const state = makeState([player]);
    expect(checkGuard(player, state)).toBe(true);
  });

  it('checkGuard returns false for player without Guard', () => {
    const player = makePlayer({ skills: [] });
    const state = makeState([player]);
    expect(checkGuard(player, state)).toBe(false);
  });

  it('checkBlockNegatesBothDown returns true for player with Block', () => {
    const player = makePlayer({ skills: ['block'] });
    const state = makeState([player]);
    expect(checkBlockNegatesBothDown(player, state)).toBe(true);
  });

  it('checkBlockNegatesBothDown returns false without Block', () => {
    const player = makePlayer({ skills: [] });
    const state = makeState([player]);
    expect(checkBlockNegatesBothDown(player, state)).toBe(false);
  });

  it('checkDodgeNegatesStumble returns true with Dodge and no Tackle', () => {
    const defender = makePlayer({ skills: ['dodge'] });
    const attacker = makeOpponent({ skills: [] });
    const state = makeState([defender, attacker]);
    expect(checkDodgeNegatesStumble(defender, attacker, state)).toBe(true);
  });

  it('checkDodgeNegatesStumble returns false when attacker has Tackle', () => {
    const defender = makePlayer({ skills: ['dodge'] });
    const attacker = makeOpponent({ skills: ['tackle'] });
    const state = makeState([defender, attacker]);
    expect(checkDodgeNegatesStumble(defender, attacker, state)).toBe(false);
  });

  it('checkDodgeNegatesStumble returns false without Dodge', () => {
    const defender = makePlayer({ skills: [] });
    const attacker = makeOpponent({ skills: [] });
    const state = makeState([defender, attacker]);
    expect(checkDodgeNegatesStumble(defender, attacker, state)).toBe(false);
  });

  it('checkWrestleOnBothDown returns true with Wrestle', () => {
    const player = makePlayer({ skills: ['wrestle'] });
    const state = makeState([player]);
    expect(checkWrestleOnBothDown(player, state)).toBe(true);
  });

  it('checkWrestleOnBothDown returns false without Wrestle', () => {
    const player = makePlayer({ skills: [] });
    const state = makeState([player]);
    expect(checkWrestleOnBothDown(player, state)).toBe(false);
  });

  it('getMightyBlowBonusFromRegistry returns 1 with Mighty Blow', () => {
    const player = makePlayer({ skills: ['mighty-blow'] });
    const state = makeState([player]);
    expect(getMightyBlowBonusFromRegistry(player, state)).toBe(1);
  });

  it('getMightyBlowBonusFromRegistry returns 0 without Mighty Blow', () => {
    const player = makePlayer({ skills: [] });
    const state = makeState([player]);
    expect(getMightyBlowBonusFromRegistry(player, state)).toBe(0);
  });

  it('getMightyBlowBonusFromRegistry works with underscore slug', () => {
    const player = makePlayer({ skills: ['mighty_blow'] });
    const state = makeState([player]);
    expect(getMightyBlowBonusFromRegistry(player, state)).toBe(1);
  });
});
