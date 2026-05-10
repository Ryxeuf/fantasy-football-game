/**
 * Tests pour le replay diff tool (Lot 4.B.2).
 *
 * Couvre :
 *   - `diffReplayEvents` : alignment par index, detection mismatch
 *     (type, displayAtMs, meta) et longueur asymetrique.
 *   - `formatReplayDiffReport` : rendu text aligne avec les premieres
 *     divergences highlightees.
 */

import { describe, expect, it } from 'vitest';

import type { MatchEvent } from '../types';
import {
  diffReplayEvents,
  formatReplayDiffReport,
} from './replay-diff';

function ev(
  type: MatchEvent['type'],
  displayAtMs: number,
  meta: Record<string, unknown> = {},
): MatchEvent {
  return {
    type,
    displayAtMs,
    engineVer: '0.16.0',
    meta,
  } as MatchEvent;
}

describe('diffReplayEvents — Lot 4.B.2', () => {
  it('aucune divergence si les deux replays sont identiques', () => {
    const events = [
      ev('KICKOFF', 0, { home: 'A', away: 'B' }),
      ev('TURN_START', 0, { half: 1, turn: 1 }),
      ev('END', 1000, { outcome: 'draw' }),
    ];
    const out = diffReplayEvents(events, events);
    expect(out.divergences).toEqual([]);
    expect(out.summary).toMatchObject({
      totalA: 3,
      totalB: 3,
      matchedCount: 3,
      divergenceCount: 0,
      firstDivergenceIndex: null,
    });
  });

  it('detecte un mismatch sur le type', () => {
    const a = [ev('KICKOFF', 0), ev('TURN_START', 0), ev('TD', 1000)];
    const b = [ev('KICKOFF', 0), ev('TURN_START', 0), ev('TURNOVER', 1000)];
    const out = diffReplayEvents(a, b);
    expect(out.divergences).toHaveLength(1);
    expect(out.divergences[0]).toMatchObject({
      index: 2,
      kind: 'mismatch',
    });
    expect(out.summary.firstDivergenceIndex).toBe(2);
  });

  it('detecte un mismatch sur displayAtMs (timing diverge)', () => {
    const a = [ev('TD', 1000)];
    const b = [ev('TD', 2000)];
    const out = diffReplayEvents(a, b);
    expect(out.divergences[0].kind).toBe('mismatch');
  });

  it('detecte un mismatch sur meta (sous-champ different)', () => {
    const a = [ev('TD', 1000, { team: 'home', scorerId: 'X' })];
    const b = [ev('TD', 1000, { team: 'home', scorerId: 'Y' })];
    const out = diffReplayEvents(a, b);
    expect(out.divergences).toHaveLength(1);
    expect(out.divergences[0].kind).toBe('mismatch');
  });

  it('considere meta semantiquement equivalente (ordre de champs)', () => {
    const a = [ev('TD', 1000, { team: 'home', scorerId: 'X' })];
    const b = [ev('TD', 1000, { scorerId: 'X', team: 'home' })];
    const out = diffReplayEvents(a, b);
    expect(out.divergences).toEqual([]);
  });

  it('detecte longueur asymetrique : events extra dans B (missing_a)', () => {
    const a = [ev('KICKOFF', 0)];
    const b = [ev('KICKOFF', 0), ev('TURN_START', 0), ev('END', 1000)];
    const out = diffReplayEvents(a, b);
    expect(out.divergences).toHaveLength(2);
    expect(out.divergences[0].kind).toBe('missing_a');
    expect(out.divergences[1].kind).toBe('missing_a');
  });

  it('detecte longueur asymetrique : events extra dans A (missing_b)', () => {
    const a = [ev('KICKOFF', 0), ev('TURN_START', 0), ev('END', 1000)];
    const b = [ev('KICKOFF', 0)];
    const out = diffReplayEvents(a, b);
    expect(out.divergences).toHaveLength(2);
    expect(out.divergences[0].kind).toBe('missing_b');
    expect(out.divergences[1].kind).toBe('missing_b');
  });

  it('multi-divergences : compte tous les mismatches dans summary', () => {
    const a = [ev('TD', 1000), ev('TURNOVER', 2000), ev('END', 3000)];
    const b = [ev('TURNOVER', 1000), ev('TD', 2000), ev('END', 3000)];
    const out = diffReplayEvents(a, b);
    expect(out.divergences).toHaveLength(2);
    expect(out.summary.divergenceCount).toBe(2);
    expect(out.summary.firstDivergenceIndex).toBe(0);
    expect(out.summary.matchedCount).toBe(1);
  });

  it('limite par maxDivergences si fournie (anti-runaway)', () => {
    const a = Array.from({ length: 10 }, (_, i) => ev('TD', i * 100));
    const b = Array.from({ length: 10 }, (_, i) => ev('TURNOVER', i * 100));
    const out = diffReplayEvents(a, b, { maxDivergences: 3 });
    expect(out.divergences).toHaveLength(3);
    expect(out.summary.divergenceCount).toBe(10); // count complet
  });

  it('runs vides : 0 divergence', () => {
    const out = diffReplayEvents([], []);
    expect(out.divergences).toEqual([]);
    expect(out.summary.totalA).toBe(0);
    expect(out.summary.totalB).toBe(0);
  });
});

describe('formatReplayDiffReport — Lot 4.B.2', () => {
  it('imprime un summary lisible avec count + first divergence index', () => {
    const a = [ev('KICKOFF', 0), ev('TD', 1000)];
    const b = [ev('KICKOFF', 0), ev('TURNOVER', 1000)];
    const out = diffReplayEvents(a, b);
    const text = formatReplayDiffReport(out);
    expect(text).toContain('totalA=2');
    expect(text).toContain('totalB=2');
    expect(text).toContain('divergences=1');
    expect(text).toContain('firstDivergenceIndex=1');
  });

  it('liste les premieres divergences avec type a / b', () => {
    const a = [ev('TD', 1000)];
    const b = [ev('TURNOVER', 1000)];
    const out = diffReplayEvents(a, b);
    const text = formatReplayDiffReport(out);
    expect(text).toMatch(/index=0/);
    expect(text).toMatch(/TD/);
    expect(text).toMatch(/TURNOVER/);
  });

  it('cap visualisation à maxLinesShown', () => {
    const a = Array.from({ length: 50 }, (_, i) => ev('TD', i * 100));
    const b = Array.from({ length: 50 }, (_, i) => ev('TURNOVER', i * 100));
    const out = diffReplayEvents(a, b);
    const text = formatReplayDiffReport(out, { maxLinesShown: 5 });
    // Compte les lignes "index=" pour s'assurer du capping.
    const lines = text.split('\n').filter((l) => l.startsWith('  index='));
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(text).toMatch(/\.{3}\s*\(\d+\s+more\)/);
  });
});
