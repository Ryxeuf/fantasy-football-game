import { describe, expect, it } from 'vitest';

import type { PlayerMomentum } from './momentum';

import {
  FORM_DECAY_MATCHES,
  applyMatchToForms,
  decayForm,
  getPlayerForm,
  type FormState,
  type PlayerForm,
} from './player-form';

const momentum = (
  playerId: string,
  state: 'hot' | 'normal' | 'cold' = 'normal'
): PlayerMomentum => ({
  playerId,
  state,
  touchdowns: state === 'hot' ? 2 : 0,
  successfulBlocks: 0,
  failureStreak: state === 'cold' ? 3 : 0,
});

describe('PlayerForm — sprint Pro League 0.C.4', () => {
  it('exposes the documented decay window of 3 matches', () => {
    expect(FORM_DECAY_MATCHES).toBe(3);
  });

  it('returns "normal" for an unknown player', () => {
    expect(getPlayerForm([], 'ghost')).toBe<FormState>('normal');
  });

  it('promotes a player to "hot" when the match-end momentum is hot', () => {
    const next = applyMatchToForms({ momentumSnapshot: [momentum('p1', 'hot')], prior: [] });
    const p1 = next.find((f) => f.playerId === 'p1');
    expect(p1?.state).toBe<FormState>('hot');
    expect(p1?.matchesSinceReinforcement).toBe(0);
  });

  it('promotes a player to "cold" when the match-end momentum is cold', () => {
    const next = applyMatchToForms({ momentumSnapshot: [momentum('p1', 'cold')], prior: [] });
    expect(next.find((f) => f.playerId === 'p1')?.state).toBe<FormState>('cold');
  });

  it('a normal-momentum match increments matchesSinceReinforcement on existing forms', () => {
    const prior: PlayerForm[] = [
      { playerId: 'p1', state: 'hot', matchesSinceReinforcement: 0 },
    ];
    const next = applyMatchToForms({
      momentumSnapshot: [momentum('p1', 'normal')],
      prior,
    });
    const p1 = next.find((f) => f.playerId === 'p1');
    expect(p1?.state).toBe<FormState>('hot');
    expect(p1?.matchesSinceReinforcement).toBe(1);
  });

  it('decays hot to normal after 3 matches without reinforcement', () => {
    let forms: readonly PlayerForm[] = [
      { playerId: 'p1', state: 'hot', matchesSinceReinforcement: 0 },
    ];
    for (let i = 0; i < FORM_DECAY_MATCHES; i += 1) {
      forms = applyMatchToForms({ momentumSnapshot: [momentum('p1', 'normal')], prior: forms });
    }
    expect(forms.find((f) => f.playerId === 'p1')?.state).toBe<FormState>('normal');
  });

  it('decays cold to normal after 3 matches without reinforcement', () => {
    let forms: readonly PlayerForm[] = [
      { playerId: 'p1', state: 'cold', matchesSinceReinforcement: 0 },
    ];
    for (let i = 0; i < FORM_DECAY_MATCHES; i += 1) {
      forms = applyMatchToForms({ momentumSnapshot: [momentum('p1', 'normal')], prior: forms });
    }
    expect(forms.find((f) => f.playerId === 'p1')?.state).toBe<FormState>('normal');
  });

  it('reinforcing a hot player resets the decay counter', () => {
    let forms: readonly PlayerForm[] = [
      { playerId: 'p1', state: 'hot', matchesSinceReinforcement: 2 },
    ];
    forms = applyMatchToForms({
      momentumSnapshot: [momentum('p1', 'hot')],
      prior: forms,
    });
    const p1 = forms.find((f) => f.playerId === 'p1');
    expect(p1?.state).toBe<FormState>('hot');
    expect(p1?.matchesSinceReinforcement).toBe(0);
  });

  it('players who did not play this match still age (decay continues)', () => {
    const prior: PlayerForm[] = [
      { playerId: 'absent', state: 'hot', matchesSinceReinforcement: 1 },
    ];
    const next = applyMatchToForms({ momentumSnapshot: [], prior });
    expect(next.find((f) => f.playerId === 'absent')?.matchesSinceReinforcement).toBe(2);
  });

  it('hot momentum overrides a previously cold form (most recent match wins)', () => {
    const prior: PlayerForm[] = [
      { playerId: 'p1', state: 'cold', matchesSinceReinforcement: 0 },
    ];
    const next = applyMatchToForms({
      momentumSnapshot: [momentum('p1', 'hot')],
      prior,
    });
    expect(next.find((f) => f.playerId === 'p1')?.state).toBe<FormState>('hot');
  });

  it('decayForm helper : hot stays hot until the threshold then flips', () => {
    let f: PlayerForm = { playerId: 'p1', state: 'hot', matchesSinceReinforcement: 0 };
    f = decayForm(f);
    expect(f.state).toBe<FormState>('hot');
    expect(f.matchesSinceReinforcement).toBe(1);
    f = decayForm(f);
    expect(f.state).toBe<FormState>('hot');
    f = decayForm(f);
    // After 3 cumulative aging steps, the state has decayed.
    expect(f.state).toBe<FormState>('normal');
  });

  it('immutability : applyMatchToForms returns a fresh array (no mutation of prior)', () => {
    const prior: PlayerForm[] = [
      { playerId: 'p1', state: 'hot', matchesSinceReinforcement: 0 },
    ];
    const before = JSON.stringify(prior);
    applyMatchToForms({ momentumSnapshot: [momentum('p1', 'cold')], prior });
    expect(JSON.stringify(prior)).toBe(before);
  });

  it('getPlayerForm returns the persisted state for known players', () => {
    const forms: PlayerForm[] = [
      { playerId: 'p1', state: 'hot', matchesSinceReinforcement: 1 },
    ];
    expect(getPlayerForm(forms, 'p1')).toBe<FormState>('hot');
    expect(getPlayerForm(forms, 'p2')).toBe<FormState>('normal');
  });

  it('a momentum entry with state="normal" but high counters does not flip the form', () => {
    const partial: PlayerMomentum = {
      playerId: 'p1',
      state: 'normal',
      touchdowns: 1,
      successfulBlocks: 2,
      failureStreak: 1,
    };
    const next = applyMatchToForms({ momentumSnapshot: [partial], prior: [] });
    expect(next.find((f) => f.playerId === 'p1')?.state).toBe<FormState>('normal');
  });
});
