import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { makeRNG } from '../utils/rng';
import { resolveKickoffBallLanding } from './ball';
import type { GameState, Player } from '../core/types';

function placePlayer(state: GameState, id: string, pos: Player['pos']): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, pos } : p)),
  };
}

describe('resolveKickoffBallLanding', () => {
  it('renvoie l’état tel quel si aucun ballon n’est posé', () => {
    const state = { ...setup(), ball: undefined } as GameState;
    const next = resolveKickoffBallLanding(state, 'A', makeRNG('seed'));
    expect(next).toBe(state);
  });

  it('attribue le ballon par touchback si la balle atterrit hors de la moitié receveuse', () => {
    let state = setup();
    state = placePlayer(state, 'A1', { x: 6, y: 7 });
    state = placePlayer(state, 'A2', { x: 12, y: 7 });
    state = { ...state, ball: { x: 18, y: 7 } };

    const next = resolveKickoffBallLanding(state, 'A', makeRNG('touchback'));

    expect(next.ball).toBeUndefined();
    const carrier = next.players.find(p => p.hasBall);
    expect(carrier).toBeDefined();
    expect(carrier!.team).toBe('A');
    expect(['A1', 'A2']).toContain(carrier!.id);
  });

  it('déclenche un touchback si la balle s’arrête sur la ligne d’en-but (x=0)', () => {
    const state = { ...setup(), ball: { x: 0, y: 7 } };
    const next = resolveKickoffBallLanding(state, 'B', makeRNG('endzone'));

    expect(next.ball).toBeUndefined();
    const carrier = next.players.find(p => p.hasBall);
    expect(carrier).toBeDefined();
    expect(carrier!.team).toBe('B');
  });

  it('laisse la balle au sol si elle tombe sur une case vide de la moitié receveuse', () => {
    let state = setup();
    state = { ...state, ball: { x: 6, y: 7 } };
    // Aucun joueur de team A n’est en (6, 7) dans le setup par défaut.
    const next = resolveKickoffBallLanding(state, 'A', makeRNG('empty'));

    expect(next.ball).toEqual({ x: 6, y: 7 });
    expect(next.players.every(p => !p.hasBall)).toBe(true);
  });

  it('tente une réception et donne le ballon à un joueur receveur debout sur la case', () => {
    let state = setup();
    state = placePlayer(state, 'A1', { x: 6, y: 7 });
    state = { ...state, ball: { x: 6, y: 7 } };

    let attempts = 0;
    let success = false;
    for (let i = 0; i < 20 && !success; i += 1) {
      const next = resolveKickoffBallLanding(state, 'A', makeRNG(`catch-${i}`));
      attempts += 1;
      if (next.players.find(p => p.id === 'A1')!.hasBall) {
        success = true;
        expect(next.ball).toBeUndefined();
      }
    }
    expect(success).toBe(true);
    expect(attempts).toBeGreaterThan(0);
  });

  it('si touchback et aucun receveur valide, le ballon reste au sol avec un log', () => {
    let state = setup();
    // Tous les joueurs A sont KO (stunned) → aucun receveur valide
    state = {
      ...state,
      players: state.players.map(p =>
        p.team === 'A' ? { ...p, stunned: true, pos: { x: 6, y: 7 } } : p,
      ),
      ball: { x: 18, y: 7 },
    };

    const next = resolveKickoffBallLanding(state, 'A', makeRNG('no-receiver'));

    expect(next.ball).toEqual({ x: 18, y: 7 });
    expect(next.players.every(p => !p.hasBall)).toBe(true);
    expect(next.gameLog.some(l => l.message.includes('Touchback'))).toBe(true);
  });
});
