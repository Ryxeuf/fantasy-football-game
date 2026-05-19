/**
 * Tests pour pending-state runtime guard.
 * Audit 2026-05-19 quick win ST4.
 */

import { describe, it, expect } from 'vitest';

import { setup } from './game-state';
import {
  PENDING_FIELDS,
  getActivePending,
  listActivePendings,
  assertSinglePending,
} from './pending-state';
import type { GameState } from './types';

function stateWithPendings(active: Partial<GameState>): GameState {
  return { ...setup(), ...active };
}

describe('pending-state runtime guard', () => {
  it('PENDING_FIELDS contient les 10 champs connus', () => {
    expect(PENDING_FIELDS).toHaveLength(10);
    expect(PENDING_FIELDS).toContain('pendingApothecary');
    expect(PENDING_FIELDS).toContain('pendingKickoffEvent');
    expect(PENDING_FIELDS).toContain('pendingBlock');
    expect(PENDING_FIELDS).toContain('pendingOnTheBall');
  });

  it('getActivePending retourne null si aucun pending', () => {
    const state = setup();
    expect(getActivePending(state)).toBeNull();
  });

  it('getActivePending retourne le pending actif', () => {
    const state = stateWithPendings({
      pendingReroll: { context: 'dodge', playerId: 'A1' } as GameState['pendingReroll'],
    });
    expect(getActivePending(state)).toBe('pendingReroll');
  });

  it('listActivePendings retourne tous les pendings actifs', () => {
    const state = stateWithPendings({
      pendingReroll: { context: 'dodge', playerId: 'A1' } as GameState['pendingReroll'],
      pendingPushChoice: {
        attackerId: 'A1',
        targetId: 'B1',
        options: [],
      } as GameState['pendingPushChoice'],
    });
    const active = listActivePendings(state);
    expect(active).toHaveLength(2);
    expect(active).toContain('pendingReroll');
    expect(active).toContain('pendingPushChoice');
  });

  it('assertSinglePending passe si 0 ou 1 pending', () => {
    const empty = setup();
    expect(() => assertSinglePending(empty, 'test-0')).not.toThrow();

    const single = stateWithPendings({
      pendingReroll: { context: 'dodge', playerId: 'A1' } as GameState['pendingReroll'],
    });
    expect(() => assertSinglePending(single, 'test-1')).not.toThrow();
  });

  it('assertSinglePending throw en dev si 2+ pendings', () => {
    const violation = stateWithPendings({
      pendingReroll: { context: 'dodge', playerId: 'A1' } as GameState['pendingReroll'],
      pendingPushChoice: {
        attackerId: 'A1',
        targetId: 'B1',
        options: [],
      } as GameState['pendingPushChoice'],
    });
    expect(() => assertSinglePending(violation, 'violation-test')).toThrow(
      /pending-state invariant.*violation-test.*2 pendings/i
    );
  });
});
