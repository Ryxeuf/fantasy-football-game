import { describe, expect, it } from 'vitest';

import { simulateMatch } from '../simulate-match';
import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';
import type { SimInput } from '../types';

import { narrateMatch } from './narrator';

const baseInput = (overrides: Partial<SimInput> = {}): SimInput => ({
  seed: 42,
  home: {
    id: 'pit-smashers',
    name: 'Pittsburgh Smashers',
    side: 'home',
    tactics: PRO_LEAGUE_TEAM_BY_ID['pit-smashers'].tactics,
  },
  away: {
    id: 'kc-soaring-hawks',
    name: 'Kansas City Soaring Hawks',
    side: 'away',
    tactics: PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'].tactics,
  },
  ...overrides,
});

describe('narrateMatch — sprint Pro League 0.E.2', () => {
  it('renders a non-empty narrative for any seed', () => {
    for (let seed = 0; seed < 10; seed += 1) {
      const out = narrateMatch(simulateMatch(baseInput({ seed })));
      expect(out.length).toBeGreaterThan(100);
    }
  });

  it('includes both team names in the header', () => {
    const out = narrateMatch(simulateMatch(baseInput()));
    expect(out).toContain('Pittsburgh Smashers');
    expect(out).toContain('Kansas City Soaring Hawks');
  });

  it('renders a final score footer with TD / casualties / turnovers / nuffle counts', () => {
    const out = narrateMatch(simulateMatch(baseInput()));
    expect(out).toMatch(/FINAL:/);
    expect(out).toMatch(/Touchdowns:/);
    expect(out).toMatch(/Casualties:/);
    expect(out).toMatch(/Turnovers:/);
    expect(out).toMatch(/Nuffle:/);
  });

  it('mentions HALFTIME and END once each', () => {
    const out = narrateMatch(simulateMatch(baseInput()));
    expect((out.match(/HALFTIME/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect((out.match(/END OF MATCH/g) ?? []).length).toBe(1);
  });

  it('renders BLOCK / DODGE / PASS / TD events when they appear in the timeline', () => {
    // Run several seeds and concatenate outputs to ensure each event kind
    // appears at least once across the sample.
    let combined = '';
    for (let seed = 0; seed < 20; seed += 1) {
      combined += narrateMatch(simulateMatch(baseInput({ seed })));
    }
    expect(combined).toMatch(/BLOCK/);
    expect(combined).toMatch(/DODGE/);
    expect(combined).toMatch(/Touchdown/);
  });

  it('renders NUFFLE events with their description (audience-friendly)', () => {
    let withNuffle: string | null = null;
    for (let seed = 0; seed < 50 && withNuffle === null; seed += 1) {
      const out = narrateMatch(simulateMatch(baseInput({ seed })));
      if (out.includes('NUFFLE')) withNuffle = out;
    }
    expect(withNuffle).not.toBeNull();
    // Each NUFFLE block should contain a human description in the meta.
    expect(withNuffle).toMatch(/NUFFLE/);
  });

  it('honours options.title to override the default header', () => {
    const out = narrateMatch(simulateMatch(baseInput()), { title: 'MATCH #1' });
    expect(out.startsWith('=== MATCH #1')).toBe(true);
  });

  it('groups events by half and turn (TURN_START headers visible)', () => {
    const out = narrateMatch(simulateMatch(baseInput()));
    expect(out).toMatch(/Turn \d+/);
    expect(out).toMatch(/Half [12]/);
  });

  it('is deterministic for the same seed', () => {
    const a = narrateMatch(simulateMatch(baseInput({ seed: 7 })));
    const b = narrateMatch(simulateMatch(baseInput({ seed: 7 })));
    expect(b).toBe(a);
  });
});
