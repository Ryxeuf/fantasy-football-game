import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseBenchBaseline } from './baseline';

/**
 * Le gate nocturne rejouait la baseline des PR (20 matchs par duel) avec
 * `--runs=100` : un échantillon de 100 matchs comparé à des taux mesurés sur
 * 20, donc rouge à chaque nuit depuis sa création sans que le moteur bouge.
 * Une baseline ne vaut que pour SA taille d'échantillon.
 */

const PACKAGE_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '../..');
const NIGHTLY_RUNS = 100;

function readBaseline(file: string) {
  return parseBenchBaseline(JSON.parse(readFileSync(resolve(PACKAGE_ROOT, 'bench', file), 'utf8')));
}

const duelKey = (e: { homeId: string; awayId: string; seedOffset: number; driverKind?: string }) =>
  `${e.homeId}|${e.awayId}|${e.seedOffset}|${e.driverKind ?? 'simple'}`;

describe('baseline du gate nocturne', () => {
  const pr = readBaseline('bench-baseline.json');
  const nightly = readBaseline('bench-baseline-nightly.json');

  it('rejoue les mêmes duels que la baseline des PR', () => {
    expect(nightly.pairings.map(duelKey)).toEqual(pr.pairings.map(duelKey));
  });

  it('est mesurée sur 100 matchs par duel', () => {
    for (const entry of nightly.pairings) {
      expect(entry.runs, duelKey(entry)).toBe(NIGHTLY_RUNS);
    }
  });

  it('est celle que lit le workflow, sans réécrire la taille d’échantillon', () => {
    const workflow = readFileSync(
      resolve(REPO_ROOT, '.github/workflows/sim-bench-nightly.yml'),
      'utf8',
    );
    const gate = workflow.split('\n').find((line) => line.includes('sim:bench:ci'));
    expect(gate).toBeDefined();
    expect(gate).toContain('--baseline=bench/bench-baseline-nightly.json');
    expect(gate).not.toMatch(/--runs/);
  });
});
