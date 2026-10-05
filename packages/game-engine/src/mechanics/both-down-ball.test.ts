/**
 * Lot 3 « cerveau du coach » — un porteur mis au sol LÂCHE le ballon, qu'il
 * reste sur le terrain (Les Deux Plaqués) ou qu'il en sorte (KO, blessé).
 * Bug trouvé par le bench : le ballon suivait le porteur KO en réserve.
 */

import { describe, expect, it } from 'vitest';

import { movePlayerToDugoutZone } from './dugout';
import { makePlayer, baseState } from '../__tests__/helpers';

describe('porteur mis au sol — ballon lâché', () => {
  it('un porteur envoyé en KO laisse le ballon sur sa case', () => {
    const carrier = makePlayer({ id: 'B1', team: 'B', pos: { x: 12, y: 7 }, name: 'B1', hasBall: true });
    const state = baseState([carrier], { ball: undefined });
    const next = movePlayerToDugoutZone(state, 'B1', 'knockedOut', 'B');
    const moved = next.players.find((p) => p.id === 'B1');
    expect(moved?.pos).toEqual({ x: -1, y: -1 });
    expect(moved?.hasBall).toBe(false);
    expect(next.ball).toEqual({ x: 12, y: 7 });
  });

  it('un joueur mis en réserve ne change pas le ballon', () => {
    const carrier = makePlayer({ id: 'B1', team: 'B', pos: { x: 12, y: 7 }, name: 'B1', hasBall: true });
    const state = baseState([carrier], { ball: undefined });
    const next = movePlayerToDugoutZone(state, 'B1', 'reserves', 'B');
    expect(next.players.find((p) => p.id === 'B1')?.hasBall).toBe(true);
    expect(next.ball).toBeUndefined();
  });
});
