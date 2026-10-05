import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildEngineSimInput } from '../driver/engine-roster-fixture';
import { simulateMatch } from '../simulate-match';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';

import { createSimPool, resolveWorkerUrl, type SimPool } from './sim-pool';

const ORC = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'];
const ELF = PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'];

describe('resolveWorkerUrl', () => {
  it('pointe sur l amorce JavaScript à côté du module', () => {
    expect(resolveWorkerUrl().pathname).toMatch(/\/pool\/sim-worker-boot\.mjs$/);
  });
});

describe('createSimPool (worker_threads)', () => {
  let pool: SimPool;

  beforeAll(() => {
    pool = createSimPool({ size: 2, defaults: { stripFullReplay: true } });
  });

  afterAll(async () => {
    await pool.close();
  });

  it('simule hors de l event loop le même match que simulateMatch, sans fullReplay', async () => {
    const input = buildEngineSimInput(ORC, ELF, 21);
    const [fromPool, inline] = await Promise.all([
      pool.simulate(input, { driverKind: 'full' }),
      Promise.resolve(simulateMatch(input, { driverKind: 'full' })),
    ]);
    expect(fromPool.fullReplay).toBeUndefined();
    expect(fromPool.summary.score).toEqual(inline.summary.score);
    expect(fromPool.journal?.steps.length).toBe(inline.journal?.steps.length);
    expect(fromPool.engineVer).toBe(inline.engineVer);
  }, 60_000);

  it('file les demandes au-delà des workers et rend les résultats dans l ordre', async () => {
    const inputs = [1, 2, 3, 4, 5].map((seed) => buildEngineSimInput(ORC, ELF, seed));
    const results = await pool.simulateMany(inputs, { driverKind: 'hybrid' });
    expect(results).toHaveLength(5);
    const stats = pool.stats();
    expect(stats.size).toBe(2);
    expect(stats.completed).toBeGreaterThanOrEqual(5);
    expect(stats.queued).toBe(0);
    expect(stats.busy).toBe(0);
    for (const [i, r] of results.entries()) {
      expect(r.summary.score).toEqual(simulateMatch(inputs[i], { driverKind: 'hybrid' }).summary.score);
    }
  }, 60_000);

  it('rejette une entrée invalide sans tuer le pool', async () => {
    const bad = { seed: 1, home: { id: 'x', name: 'x', side: 'home' }, away: null } as never;
    await expect(pool.simulate(bad, { driverKind: 'hybrid' })).rejects.toThrow();
    const ok = await pool.simulate(buildEngineSimInput(ORC, ELF, 7), { driverKind: 'hybrid' });
    expect(ok.summary).toBeDefined();
    expect(pool.stats().failed).toBeGreaterThanOrEqual(1);
  }, 60_000);

  it('refuse toute demande une fois fermé', async () => {
    const local = createSimPool({ size: 1 });
    await local.close();
    await expect(local.simulate(buildEngineSimInput(ORC, ELF, 1))).rejects.toThrow(/fermé/);
  });
});
