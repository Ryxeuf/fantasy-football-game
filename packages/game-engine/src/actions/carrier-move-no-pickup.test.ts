/**
 * Lot 3 « cerveau du coach » — un PORTEUR qui se déplace ne rejoue pas de
 * ramassage. `state.ball` suit le porteur (invariant des handlers de
 * mouvement) et le test « atterrit sur le ballon » se déclenchait à chaque
 * case : 40 jets de ramassage par match, un sixième des turnovers.
 */

import { describe, expect, it } from 'vitest';

import { applyMove } from './actions';
import { makePlayer, baseState } from '../__tests__/helpers';
import { makeRNG } from '../utils/rng';

describe('porteur en mouvement — pas de ramassage', () => {
  it('garde le ballon et ne journalise aucun jet de ramassage sur six cases', () => {
    const carrier = makePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 7 }, name: 'A1', hasBall: true, ma: 6, pm: 6 });
    let state = baseState([carrier], { currentPlayer: 'A', kickingTeam: 'B', ball: { x: 5, y: 7 } });
    const rng = makeRNG('carrier-walk');
    for (let x = 6; x <= 11; x++) {
      state = applyMove(state, { type: 'MOVE', playerId: 'A1', to: { x, y: 7 } }, rng);
      expect(state.isTurnover).toBe(false);
    }
    const a1 = state.players.find((p) => p.id === 'A1');
    expect(a1?.hasBall).toBe(true);
    expect(a1?.pos).toEqual({ x: 11, y: 7 });
    expect(state.ball).toEqual({ x: 11, y: 7 });
    expect(state.gameLog.some((e) => e.message.startsWith('Jet de pickup'))).toBe(false);
  });
});
