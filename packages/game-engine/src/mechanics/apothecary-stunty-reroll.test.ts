/**
 * BB2020 : Stunty players suffer +1 modifier to any Casualty roll made
 * against them. Le modificateur s'applique aussi au re-roll apothecary.
 * Avant le fix, le re-roll D16 ne tenait pas compte du Stunty.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { applyApothecaryChoice } from './apothecary';
import type { GameState, Player, RNG } from '../core/types';

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'B', pos: { x: -1, y: -1 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 0, state: 'casualty', stunned: true,
    ...over,
  };
}

function makeStateWithApothecary(player: Player): GameState {
  const s = setup();
  return {
    ...s,
    players: [...s.players, player],
    pendingApothecary: {
      playerId: player.id,
      team: player.team,
      injuryType: 'casualty',
      originalCasualtyOutcome: 'badly_hurt',
      originalLastingInjury: undefined,
      fallbackToRegeneration: false,
    },
    apothecaryAvailable: { teamA: true, teamB: true },
  };
}

describe('Apothecary re-roll D16 — Stunty +1 (BB2020)', () => {
  it("le log mentionne `+1 Stunty` quand le joueur a Stunty", () => {
    const stunty = basePlayer({ id: 'V', skills: ['stunty'] });
    const state = makeStateWithApothecary(stunty);
    // 0.5 → floor(0.5*16)+1 = 9 → seriously_hurt sans Stunty,
    // mais +1 → 10 → serious_injury.
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);

    const result = applyApothecaryChoice(state, true, rng);

    const rerollLog = result.gameLog.find(l =>
      l.message.includes('re-lancer casualty')
    );
    expect(rerollLog).toBeDefined();
    const details = rerollLog?.details as Record<string, unknown> | undefined;
    expect(details?.stuntyMod).toBe(1);
  });

  it("aucun modificateur Stunty pour un joueur non-stunty", () => {
    const regular = basePlayer({ id: 'V', skills: [] });
    const state = makeStateWithApothecary(regular);
    const rng = makeRNG([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);

    const result = applyApothecaryChoice(state, true, rng);

    const rerollLog = result.gameLog.find(l =>
      l.message.includes('re-lancer casualty')
    );
    const details = rerollLog?.details as Record<string, unknown> | undefined;
    expect(details?.stuntyMod).toBe(0);
  });
});
