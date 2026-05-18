/**
 * Get the Ref! (kickoff event 2) — BB2020 rule :
 * « Each team receives one additional Bribe to use during the game. »
 *
 * Avant le fix, l'event donnait +1 relance par equipe au lieu d'un
 * Pot-de-vin (Bribe). Conflit avec Brilliant Coaching et Cheering Fans
 * qui donnent deja des relances, et mecanique Bribe ignoree (annulation
 * d'expulsion sur fouls, eject sur secret weapons).
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyKickoffEvent, KICKOFF_EVENTS } from './kickoff-events';
import type { GameState, RNG } from '../core/types';

function makeRNG(): RNG {
  return () => 0.5;
}

describe('Kickoff event 2 — Get the Ref! (BB2020)', () => {
  it('donne +1 Bribe a chaque equipe (pas +1 relance)', () => {
    const base = setup();
    const state: GameState = {
      ...base,
      bribesRemaining: { teamA: 0, teamB: 0 },
      teamRerolls: { teamA: 2, teamB: 2 },
    };

    const event = KICKOFF_EVENTS[2];
    const result = applyKickoffEvent(state, event, makeRNG(), 'A');

    // Bribes : +1 chaque equipe
    expect(result.bribesRemaining.teamA).toBe(1);
    expect(result.bribesRemaining.teamB).toBe(1);
    // Rerolls : inchangees
    expect(result.teamRerolls?.teamA).toBe(2);
    expect(result.teamRerolls?.teamB).toBe(2);
  });

  it('cumule avec les bribes existantes', () => {
    const base = setup();
    const state: GameState = {
      ...base,
      bribesRemaining: { teamA: 1, teamB: 2 },
    };

    const event = KICKOFF_EVENTS[2];
    const result = applyKickoffEvent(state, event, makeRNG(), 'A');

    expect(result.bribesRemaining.teamA).toBe(2);
    expect(result.bribesRemaining.teamB).toBe(3);
  });
});
