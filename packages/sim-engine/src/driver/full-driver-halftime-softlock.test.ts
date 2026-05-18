/**
 * BUG fix C1+C2 : avant, `runFullDriver` pouvait spinner indefiniment
 * en `gamePhase === 'halftime'` ou `'post-td'`.
 *
 *  - La boucle ne s'arrete qu'a `gamePhase === 'ended'`.
 *  - `advanceHalfIfNeeded` bascule en `'halftime'` mais ne sait pas
 *    sortir sans un setup interactif (place les joueurs).
 *  - `staleEndTurns` etait reset a 0 car `currentPlayer` flippe a
 *    chaque END_TURN normal (detection neutralisee).
 *  - Resultat : ~1300 events fantomes par match (1500 - cap apres
 *    le legit half 1).
 *
 * Fix : nouveau compteur `nonPlayingEndTurns` qui break apres 3
 * END_TURN consecutifs en `gamePhase !== 'playing'`. Plus la
 * detection « advanced » strictifiee a `phase || turn || half`
 * (au lieu de `... || currentPlayer`).
 */
import { describe, it, expect } from 'vitest';
import { runFullDriver } from './full-driver';
import type { SimInput } from '../types';

const DEFAULT_INPUT: SimInput = {
  seed: 42,
  home: { id: 'home', name: 'Home', side: 'home' },
  away: { id: 'away', name: 'Away', side: 'away' },
};

describe('runFullDriver — halftime softlock prevention', () => {
  it("le match termine en moins de 600 actions (pas de spin halftime)", () => {
    const result = runFullDriver(DEFAULT_INPUT);

    // Avant le fix : ~1500 events accumules (cap MAX_ACTIONS_PER_MATCH).
    // Apres le fix : le break sur nonPlayingEndTurns kick a la fin du
    // half 1, donc environ 150-300 events typiques.
    const fullReplay = result.fullReplay;
    expect(fullReplay).toBeDefined();
    expect(fullReplay!.moves.length).toBeLessThan(600);
  });

  it("le replay contient au moins 1 event END (terminaison propre)", () => {
    const result = runFullDriver(DEFAULT_INPUT);
    const endEvents = result.events.filter((e) => e.type === 'END');
    expect(endEvents.length).toBeGreaterThan(0);
  });
});
