/**
 * Lot 3 « cerveau du coach » — un soutien de blocage n'exige pas de PM
 * restants (BB2020 : adjacent à la cible, non marqué par un autre
 * adversaire). Le critère « PM > 0 » privait de soutien tout joueur ayant
 * fini son déplacement, donc tout blocage joué après les déplacements.
 */

import { describe, expect, it } from 'vitest';

import { calculateDefensiveAssists, calculateOffensiveAssists } from './blocking';
import { makePlayer, baseState } from '../__tests__/helpers';

describe('soutiens de blocage (lot 3)', () => {
  it('un coéquipier sans PM assiste encore', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 } });
    const a2 = makePlayer({ id: 'A2', team: 'A', pos: { x: 7, y: 7 }, pm: 0 });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 7 } });
    const b2 = makePlayer({ id: 'B2', team: 'B', pos: { x: 4, y: 8 }, pm: 0 });
    const state = baseState([a1, a2, b1, b2]);
    expect(calculateOffensiveAssists(state, a1, b1)).toBe(1);
    expect(calculateDefensiveAssists(state, a1, b1)).toBe(1);
  });

  it('un coéquipier au sol ou marqué par un autre adversaire n’assiste pas', () => {
    const a1 = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 } });
    const down = makePlayer({ id: 'A2', team: 'A', pos: { x: 7, y: 7 }, stunned: true });
    const marked = makePlayer({ id: 'A3', team: 'A', pos: { x: 7, y: 6 } });
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 7 } });
    const b2 = makePlayer({ id: 'B2', team: 'B', pos: { x: 8, y: 5 } });
    const state = baseState([a1, down, marked, b1, b2]);
    expect(calculateOffensiveAssists(state, a1, b1)).toBe(0);
  });
});
