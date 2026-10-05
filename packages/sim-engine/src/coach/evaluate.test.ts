import { describe, expect, it } from 'vitest';

import { makeRNG } from '@bb/game-engine';

import { DEFAULT_TACTICAL_PROFILE } from '../tactics/tactical-profile';

import { choosePlan } from './drive-plan';
import { TackleZoneGrid, buildEvalContext, knockdownGain, playerContribution } from './evaluate';
import { baseState, makePlayer } from './test-helpers';

function offence() {
  const carrier = makePlayer({ id: 'A1', team: 'A', pos: { x: 8, y: 7 }, hasBall: true });
  const a2 = makePlayer({ id: 'A2', team: 'A', pos: { x: 6, y: 9 } });
  const a3 = makePlayer({ id: 'A3', team: 'A', pos: { x: 6, y: 5 } });
  const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 14, y: 7 } });
  const b2 = makePlayer({ id: 'B2', team: 'B', pos: { x: 20, y: 3 } });
  const state = baseState([carrier, a2, a3, b1, b2]);
  const plan = choosePlan(state, 'A', { ...DEFAULT_TACTICAL_PROFILE, cageAffinity: 100 }, makeRNG('eval'));
  return { state, plan, carrier, a2, b1, ctx: buildEvalContext(state, 'A', plan) };
}

describe('fonction de valeur (lot 3)', () => {
  it('la grille des zones de tacle compte les adversaires debout adjacents', () => {
    const b1 = makePlayer({ id: 'B1', team: 'B', pos: { x: 10, y: 7 } });
    const down = makePlayer({ id: 'B2', team: 'B', pos: { x: 12, y: 7 }, stunned: true });
    const grid = new TackleZoneGrid(26, 15, [b1]);
    expect(grid.at({ x: 11, y: 8 })).toBe(1);
    expect(grid.at({ x: 10, y: 7 })).toBe(0);
    expect(grid.at({ x: -1, y: 0 })).toBe(0);
    // Le contexte ne passe à la grille que les adversaires DEBOUT.
    const ctx = buildEvalContext(baseState([makePlayer({ id: 'A1', team: 'A' }), down]), 'A', choosePlan(baseState([down]), 'A', DEFAULT_TACTICAL_PROFILE, makeRNG('g')));
    expect(ctx.oppTackleZones.at({ x: 13, y: 7 })).toBe(0);
  });

  it('le porteur vaut plus en avançant et moins dans une zone de tacle', () => {
    const { ctx, carrier } = offence();
    const here = playerContribution(ctx, carrier, carrier.pos, true);
    const forward = playerContribution(ctx, carrier, { x: 11, y: 7 }, true);
    const marked = playerContribution(ctx, carrier, { x: 13, y: 7 }, true);
    expect(forward).toBeGreaterThan(here);
    expect(marked).toBeLessThan(forward);
    const sideline = playerContribution(ctx, carrier, { x: 11, y: 0 }, true);
    expect(sideline).toBeLessThan(forward);
  });

  it('un coéquipier vaut plus en coin de cage que devant le porteur', () => {
    const { ctx, a2 } = offence();
    const corner = playerContribution(ctx, a2, { x: 7, y: 8 }, false);
    const ahead = playerContribution(ctx, a2, { x: 9, y: 7 }, false);
    const far = playerContribution(ctx, a2, { x: 2, y: 13 }, false);
    expect(corner).toBeGreaterThan(ahead);
    expect(corner).toBeGreaterThan(far);
  });

  it('la cage se forme sur la case VISÉE par le porteur', () => {
    const { state, plan, a2 } = offence();
    const target = { x: 12, y: 7 };
    const ctx = buildEvalContext(state, 'A', plan, target);
    const atTargetCorner = playerContribution(ctx, a2, { x: 11, y: 8 }, false);
    const atCurrentCorner = playerContribution(ctx, a2, { x: 7, y: 8 }, false);
    expect(atTargetCorner).toBeGreaterThan(atCurrentCorner);
  });

  it('un porteur enfermé par ses propres joueurs est pénalisé', () => {
    const carrier = makePlayer({ id: 'A1', team: 'A', pos: { x: 8, y: 7 }, hasBall: true });
    const wall = [
      makePlayer({ id: 'A2', team: 'A', pos: { x: 9, y: 6 } }),
      makePlayer({ id: 'A3', team: 'A', pos: { x: 9, y: 7 } }),
      makePlayer({ id: 'A4', team: 'A', pos: { x: 9, y: 8 } }),
    ];
    const open = baseState([carrier, makePlayer({ id: 'A2', team: 'A', pos: { x: 7, y: 6 } })]);
    const boxed = baseState([carrier, ...wall]);
    const plan = choosePlan(open, 'A', DEFAULT_TACTICAL_PROFILE, makeRNG('box'));
    const vOpen = playerContribution(buildEvalContext(open, 'A', plan), carrier, carrier.pos, true);
    const vBoxed = playerContribution(buildEvalContext(boxed, 'A', plan), carrier, carrier.pos, true);
    expect(vBoxed).toBeLessThan(vOpen);
  });

  it('mettre au sol le porteur adverse ou un marqueur de notre porteur vaut plus', () => {
    const { state, plan, b1 } = offence();
    const marker = { ...b1, pos: { x: 9, y: 7 } };
    const withMarker = baseState([...state.players.filter((p) => p.id !== 'B1'), marker]);
    const ctxM = buildEvalContext(withMarker, 'A', plan);
    const plain = knockdownGain(buildEvalContext(state, 'A', plan), b1);
    expect(knockdownGain(ctxM, marker)).toBeGreaterThan(plain);
    const oppCarrier = { ...b1, hasBall: true };
    expect(knockdownGain(buildEvalContext(baseState([...state.players.filter((p) => p.id !== 'B1' && p.id !== 'A1'), { ...state.players[0], hasBall: false }, oppCarrier]), 'A', plan), oppCarrier)).toBeGreaterThan(plain);
  });
});
