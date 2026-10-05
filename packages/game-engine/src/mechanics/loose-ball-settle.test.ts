/**
 * Lot 3 « cerveau du coach » — un ballon libre ne repose jamais sous un
 * joueur, ne rebondit pas « contre la touche » et un joueur debout sur sa
 * case d'arrivée doit le réceptionner. Trois bugs trouvés par le bench :
 * le ballon restait coincé sous un porteur renversé (parfois plusieurs
 * tours), ou sous un joueur ayant fini son déplacement (critère « PM > 0 »
 * pour tenter la réception), ou était borné au bord du terrain.
 */

import { describe, expect, it } from 'vitest';

import { bounceBall, settleLooseBall } from './ball';
import { makePlayer, baseState } from '../__tests__/helpers';
import { makeRNG } from '../utils/rng';

describe('ballon libre (lot 3)', () => {
  it('un ballon posé sous un joueur au sol rebondit', () => {
    const prone = makePlayer({ id: 'B1', team: 'B', pos: { x: 10, y: 7 }, stunned: true });
    const state = baseState([prone], { ball: { x: 10, y: 7 } });
    const next = settleLooseBall(state, makeRNG('settle'));
    expect(next.ball).toBeDefined();
    expect(next.ball).not.toEqual({ x: 10, y: 7 });
    expect(next.gameLog.some((e) => e.message.startsWith('Ballon rebondit vers'))).toBe(true);
  });

  it('un rebond qui atterrit sur un joueur au sol repart', () => {
    // Le ballon est entouré de huit joueurs au sol : le premier rebond
    // tombe forcément sur l'un d'eux et doit repartir au-delà.
    const ring = [];
    let n = 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        ring.push(makePlayer({ id: `B${++n}`, team: 'B', pos: { x: 10 + dx, y: 7 + dy }, stunned: true }));
      }
    }
    const state = baseState(ring, { ball: { x: 10, y: 7 } });
    const next = bounceBall(state, makeRNG('ring'));
    expect(next.gameLog.some((e) => e.message.includes('rebondit sur'))).toBe(true);
    expect(next.ball).toBeDefined();
    expect(ring.some((p) => p.pos.x === next.ball!.x && p.pos.y === next.ball!.y)).toBe(false);
  });

  it('un ballon posé sous un joueur debout sans PM est tenté en réception', () => {
    const standing = makePlayer({ id: 'A1', team: 'A', pos: { x: 10, y: 7 }, pm: 0, ag: 1 });
    const state = baseState([standing], { ball: { x: 10, y: 7 } });
    const next = settleLooseBall(state, makeRNG('catch'));
    const a1 = next.players.find((p) => p.id === 'A1');
    // Avec AG 1+ la réception réussit toujours : le joueur a le ballon.
    expect(a1?.hasBall || (next.ball !== undefined && !(next.ball.x === 10 && next.ball.y === 7))).toBe(true);
  });

  it('un ballon libre sur une case vide ne bouge pas', () => {
    const state = baseState([makePlayer({ id: 'A1', team: 'A', pos: { x: 3, y: 3 } })], { ball: { x: 10, y: 7 } });
    expect(settleLooseBall(state, makeRNG('idle'))).toBe(state);
  });

  it('un rebond hors du terrain est remis en jeu par le public, à l’intérieur', () => {
    let thrownIn = 0;
    for (let i = 0; i < 40; i++) {
      const state = baseState([], { ball: { x: 0, y: 0 } });
      const next = bounceBall(state, makeRNG(`corner-${i}`));
      expect(next.ball).toBeDefined();
      expect(next.ball!.x).toBeGreaterThanOrEqual(0);
      expect(next.ball!.y).toBeGreaterThanOrEqual(0);
      expect(next.ball!.x).toBeLessThan(state.width);
      expect(next.ball!.y).toBeLessThan(state.height);
      if (next.gameLog.some((e) => e.message.includes('remet en jeu'))) thrownIn++;
    }
    // Depuis le coin, 5 directions sur 8 sortent du terrain.
    expect(thrownIn).toBeGreaterThan(10);
  });
});
