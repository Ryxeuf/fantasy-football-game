import { describe, it, expect } from 'vitest';
import { setup, type Player, type RNG } from '../index';
import { performCatchRollWithSkill, performPassRollWithSkill } from './passing';

/**
 * O.1 batch 3e — skills de relance personnelle :
 * - Catch : relance automatique (une fois) d'un jet de reception rate.
 * - Pass  : relance automatique (une fois) d'un jet de passe rate.
 */

function scriptedRng(values: number[]): RNG {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx += 1;
    return v;
  };
}

function makeCatcher(skills: string[]): Player {
  const s = setup();
  return { ...s.players.find(p => p.id === 'A2')!, skills, ag: 3 };
}

function makePasser(skills: string[]): Player {
  const s = setup();
  return { ...s.players.find(p => p.id === 'A2')!, skills, pa: 3 };
}

describe('Skill: Catch (personal reroll)', () => {
  it('relance une reception ratee si le receveur a catch', () => {
    const catcher = makeCatcher(['catch']);
    // Target ag=3 -> target=3 sans modifier. 1er jet = 1 (echec), 2eme = 5 (succes)
    const rng = scriptedRng([0.01, 0.8]);
    const { result, rerolled } = performCatchRollWithSkill(catcher, rng, 0);
    expect(rerolled).toBe(true);
    expect(result.success).toBe(true);
  });

  it('ne relance pas si le receveur n\'a pas catch', () => {
    const catcher = makeCatcher([]);
    const rng = scriptedRng([0.01, 0.8]);
    const { result, rerolled } = performCatchRollWithSkill(catcher, rng, 0);
    expect(rerolled).toBe(false);
    expect(result.success).toBe(false);
  });

  it('ne relance pas si le premier jet est deja reussi', () => {
    const catcher = makeCatcher(['catch']);
    const rng = scriptedRng([0.8, 0.01]);
    const { result, rerolled } = performCatchRollWithSkill(catcher, rng, 0);
    expect(rerolled).toBe(false);
    expect(result.success).toBe(true);
  });
});

describe('Skill: Pass (personal reroll)', () => {
  it('relance une passe ratee si le passeur a pass', () => {
    const passer = makePasser(['pass']);
    const rng = scriptedRng([0.01, 0.8]);
    const { result, rerolled } = performPassRollWithSkill(passer, rng, 0);
    expect(rerolled).toBe(true);
    expect(result.success).toBe(true);
  });

  it('ne relance pas si le passeur n\'a pas pass', () => {
    const passer = makePasser([]);
    const rng = scriptedRng([0.01, 0.8]);
    const { result, rerolled } = performPassRollWithSkill(passer, rng, 0);
    expect(rerolled).toBe(false);
    expect(result.success).toBe(false);
  });

  it('relance une seule fois (succes apres reroll)', () => {
    const passer = makePasser(['pass']);
    // echec -> reroll -> succes
    const rng = scriptedRng([0.01, 0.9]);
    const { result, rerolled } = performPassRollWithSkill(passer, rng, 0);
    expect(rerolled).toBe(true);
    expect(result.success).toBe(true);
  });

  it('echec apres reroll reste un echec', () => {
    const passer = makePasser(['pass']);
    // echec -> reroll -> echec
    const rng = scriptedRng([0.01, 0.01]);
    const { result, rerolled } = performPassRollWithSkill(passer, rng, 0);
    expect(rerolled).toBe(true);
    expect(result.success).toBe(false);
  });
});
