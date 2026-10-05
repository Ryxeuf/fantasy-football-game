import { describe, expect, it } from 'vitest';

import { baseState, makePlayer } from './test-helpers';

import {
  armourBreak,
  blockDice,
  blockOutcome,
  dodgeSuccess,
  gfiSuccess,
  p2D6,
  pD6,
  passSuccess,
  pickupSuccess,
  withReroll,
} from './probability';

describe('probabilité des jets (lot 3)', () => {
  it('pD6 et p2D6 suivent les dés', () => {
    expect(pD6(2)).toBeCloseTo(5 / 6);
    expect(pD6(6)).toBeCloseTo(1 / 6);
    expect(pD6(1)).toBeCloseTo(5 / 6); // un 1 échoue toujours
    expect(p2D6(7)).toBeCloseTo(21 / 36);
    expect(p2D6(12)).toBeCloseTo(1 / 36);
  });

  it('une relance double la chance de rattraper un échec', () => {
    expect(withReroll(0.5, true)).toBeCloseTo(0.75);
    expect(withReroll(0.5, false)).toBeCloseTo(0.5);
  });

  it("l'esquive lit les zones de tacle à l'arrivée et la compétence Esquive", () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, ag: 3 });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 } });
    const state = baseState([a1, b1]);
    // Quitter la zone de B1 vers une case libre : 3+ ⇒ 4/6.
    expect(dodgeSuccess(state, a1, a1.pos, { x: 4, y: 5 })).toBeCloseTo(4 / 6);
    // Vers une case encore marquée par B1 : 4+ ⇒ 3/6.
    expect(dodgeSuccess(state, a1, a1.pos, { x: 5, y: 4 })).toBeCloseTo(3 / 6);
    const dodger = { ...a1, skills: ['dodge'] };
    expect(dodgeSuccess(state, dodger, a1.pos, { x: 4, y: 5 })).toBeCloseTo(withReroll(4 / 6, true));
    const tackler = baseState([a1, { ...b1, skills: ['tackle'] }]);
    expect(dodgeSuccess(tackler, dodger, a1.pos, { x: 4, y: 5 })).toBeCloseTo(4 / 6);
  });

  it('GFI, ramassage et passe', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, ag: 3, pa: 3 });
    const a2 = makePlayer({ id: 'A2', team: 'A', pos: { x: 8, y: 5 }, ag: 3 });
    const state = baseState([a1, a2]);
    expect(gfiSuccess(state, a1)).toBeCloseTo(5 / 6);
    expect(gfiSuccess(state, { ...a1, skills: ['sure-feet'] })).toBeCloseTo(withReroll(5 / 6, true));
    expect(pickupSuccess(state, a1, { x: 4, y: 4 })).toBeCloseTo(4 / 6);
    expect(pickupSuccess(state, { ...a1, skills: ['no-hands'] }, { x: 4, y: 4 })).toBe(0);
    // Passe rapide (+1) à 3+ ⇒ 2+ = 5/6 ; réception précise (+1) à 3+ ⇒ 2+.
    expect(passSuccess(state, a1, a2)).toBeCloseTo((5 / 6) * (5 / 6));
  });

  it('les dés de blocage suivent les forces et les soutiens du moteur', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, st: 3 });
    const a2 = makePlayer({ id: 'A2', team: 'A', pos: { x: 7, y: 5 }, st: 3 });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, st: 3 });
    const state = baseState([a1, a2, b1]);
    const dice = blockDice(state, a1, b1, false);
    expect(dice).toMatchObject({ dice: 2, chooser: 'attacker', attackerStrength: 4, defenderStrength: 3 });
    const alone = blockDice(baseState([a1, b1]), a1, b1, false);
    expect(alone).toMatchObject({ dice: 1, chooser: 'attacker' });
    const strong = blockDice(baseState([a1, { ...b1, st: 6 }]), a1, { ...b1, st: 6 }, false);
    expect(strong).toMatchObject({ dice: 3, chooser: 'defender' });
  });

  it("l'issue d'un blocage à deux dés : Blocage protège l'attaquant, Esquive la cible", () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, st: 4 });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, st: 3 });
    const base = blockOutcome(baseState([a1, b1]), a1, b1, false);
    expect(base.dice.dice).toBe(2);
    expect(base.knockdown).toBeCloseTo(1 - Math.pow(1 - 3 / 6, 2));
    expect(base.selfDown).toBeCloseTo(Math.pow(2 / 6, 2));
    const withBlock = blockOutcome(baseState([{ ...a1, skills: ['block'] }, b1]), { ...a1, skills: ['block'] }, b1, false);
    expect(withBlock.selfDown).toBeCloseTo(Math.pow(1 / 6, 2));
    const dodger = { ...b1, skills: ['dodge'] };
    const vsDodge = blockOutcome(baseState([a1, dodger]), a1, dodger, false);
    expect(vsDodge.knockdown).toBeLessThan(base.knockdown);
  });

  it("l'armure cède sur 2D6 ≥ AV + 1, Minus compris", () => {
    const b1 = makePlayer({ id: 'B1', team: 'B', av: 8 });
    expect(armourBreak(b1)).toBeCloseTo(p2D6(9));
    expect(armourBreak({ ...b1, skills: ['stunty'] })).toBeCloseTo(p2D6(8));
  });
});
