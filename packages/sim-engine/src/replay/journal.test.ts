/**
 * Lot 2 « journal rejouable » — garde-fous :
 *  - `replayJournal` re-dérive bit à bit les états du full driver ;
 *  - un payload v2 est petit (< 20 Ko compressé) et se décode ;
 *  - les dés consommés par un coup sont journalisés.
 */

import { describe, expect, it } from 'vitest';

import { buildEngineSimInput } from '../driver/engine-roster-fixture';
import { simulateMatch } from '../simulate-match';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';

import { compressReplay, decompressReplay } from './compress';
import { replayJournal } from './journal';

const SEEDS = [1, 2, 3, 4, 5];

function input(seed: number) {
  const home = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'];
  const away = PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'];
  if (!home || !away) throw new Error('profils introuvables');
  return buildEngineSimInput(home, away, seed);
}

describe('replay journal (lot 2)', () => {
  it('re-dérive les états du full driver bit à bit', () => {
    for (const seed of SEEDS) {
      const result = simulateMatch(input(seed), { driverKind: 'full' });
      const journal = result.journal;
      const fullReplay = result.fullReplay;
      expect(journal, `graine ${seed}`).toBeDefined();
      expect(fullReplay, `graine ${seed}`).toBeDefined();
      if (!journal || !fullReplay) return;

      expect(journal.steps.length).toBe(fullReplay.moves.length);
      const replayed = replayJournal(journal);
      expect(replayed.states.length).toBe(fullReplay.states.length);
      for (let i = 0; i < replayed.states.length; i++) {
        expect(replayed.states[i], `graine ${seed} pas ${i}`).toEqual(fullReplay.states[i]);
      }
    }
  });

  it('journalise les dés de chaque coup', () => {
    const result = simulateMatch(input(1), { driverKind: 'full' });
    const journal = result.journal;
    if (!journal) throw new Error('journal absent');
    const withDice = journal.steps.filter((s) => s.dice.length > 0);
    expect(withDice.length).toBeGreaterThan(20);
    const block = journal.steps.find((s) => s.move.type === 'BLOCK' && s.dice.length > 0);
    expect(block).toBeDefined();
    expect(block?.dice[0]?.message).toMatch(/Blocage/);
  });

  it('un payload v2 pèse moins de 20 Ko compressé et se décode', async () => {
    const result = simulateMatch(input(2), { driverKind: 'full' });
    const payload = await compressReplay({
      events: result.events,
      fullReplay: result.fullReplay,
      journal: result.journal,
    });
    expect(payload.byteLength).toBeLessThan(20 * 1024);
    const decoded = await decompressReplay(payload);
    expect(decoded.events.length).toBe(result.events.length);
    expect(decoded.fullReplay).toBeUndefined();
    expect(decoded.journal?.steps.length).toBe(result.journal?.steps.length);
    const replayed = replayJournal(decoded.journal!);
    expect(replayed.states[replayed.states.length - 1]?.score).toEqual(
      result.fullReplay?.states[result.fullReplay.states.length - 1]?.score,
    );
  });
});
