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

  it('prefixes event lines with [T+MM:SS] timestamps by default', () => {
    const out = narrateMatch(simulateMatch(baseInput()));
    // KICKOFF is the first event at displayAtMs=0.
    expect(out).toMatch(/\[T\+00:00\] KICKOFF/);
    // At least one TURN_START after kickoff carries a non-zero timestamp.
    expect(out).toMatch(/\[T\+\d{2}:\d{2}\] Half \d+ • Turn \d+/);
  });

  it('honours hideTimestamps=true to drop the [T+MM:SS] prefix', () => {
    const out = narrateMatch(simulateMatch(baseInput()), {
      hideTimestamps: true,
    });
    expect(out).not.toMatch(/\[T\+\d{2}:\d{2}\]/);
    // The events themselves are still rendered.
    expect(out).toMatch(/KICKOFF/);
  });

  it('renders ball-yardline delta on consecutive TURN_STARTs same drive', () => {
    // Run several seeds until at least one match shows a "(drive ±N yds)"
    // annotation — guaranteed when 2+ TURN_STARTs share the same driving
    // team and the ball moved.
    let withDelta: string | null = null;
    for (let seed = 0; seed < 30 && withDelta === null; seed += 1) {
      const out = narrateMatch(simulateMatch(baseInput({ seed })));
      if (/\(drive [+-]\d+ yds\)/.test(out)) withDelta = out;
    }
    expect(withDelta).not.toBeNull();
  });

  it('exposes armor + injury detail on KO and CASUALTY when available', () => {
    let withDetail: string | null = null;
    for (let seed = 0; seed < 50 && withDetail === null; seed += 1) {
      const out = narrateMatch(simulateMatch(baseInput({ seed })));
      if (/(KO|CASUALTY) — .* \(armor=\d+, injury=\d+\)/.test(out)) {
        withDetail = out;
      }
    }
    expect(withDetail).not.toBeNull();
  });

  it('ne produit pas de parenthèse fermante orpheline si armor absent', () => {
    // BUG fix : avant, `renderKO`/`renderCasualty` produisaient
    // `..., injury=N).` quand `meta.armor` était undefined mais
    // `meta.injury` un number — `)` orphelin sans `(`. Test sur un
    // event KO synthétique sans armor pour cibler ce cas exact.
    const result = {
      result: 'home' as const,
      summary: {
        score: { home: 1, away: 0 },
        outcome: 'home' as const,
        durationMs: 1000,
        touchdownCount: 1,
        turnoverCount: 0,
        nuffleCount: 0,
      },
      casualties: [],
      engineVer: '0.22.0',
      events: [
        {
          type: 'KICKOFF' as const,
          displayAtMs: 0,
          engineVer: '0.22.0',
          seed: 42,
          meta: { homeName: 'A', awayName: 'B', weather: 'nice', receivingTeam: 'home' },
        },
        {
          type: 'KO' as const,
          displayAtMs: 1000,
          engineVer: '0.22.0',
          meta: { playerId: 'A1', injury: 8 }, // armor manquant ! seul injury défini.
        },
        {
          type: 'END' as const,
          displayAtMs: 2000,
          engineVer: '0.22.0',
          meta: { score: { home: 1, away: 0 } },
        },
      ],
    };
    const out = narrateMatch(result);
    // Pas de `)` orphelin (sans `(` ouvrante avant lui dans la ligne).
    const koLine = out.split('\n').find((l) => l.includes('KO —'));
    expect(koLine).toBeDefined();
    // Vérifie parens balanced sur la ligne KO.
    const opens = (koLine?.match(/\(/g) ?? []).length;
    const closes = (koLine?.match(/\)/g) ?? []).length;
    expect(opens).toBe(closes);
    // Doit contenir l'info injury (sans armor).
    expect(koLine).toContain('injury=8');
  });

  describe('Lot 3.A.4 — roster-aware rendering', () => {
    const homeRoster = [
      {
        id: 'roster-home-1',
        name: 'Bob Smasher',
        number: 3,
        position: 'Blitzer',
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
      },
      {
        id: 'roster-home-2',
        name: 'Joe Lineman',
        number: 4,
        position: 'Lineman',
        ma: 5,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
      },
    ];
    const awayRoster = [
      {
        id: 'roster-away-1',
        name: 'Carla Catcher',
        number: 7,
        position: 'Catcher',
        ma: 8,
        st: 2,
        ag: 4,
        pa: 5,
        av: 8,
      },
    ];

    it('remplace playerId par "Nom (#numero Position)" sur un event BLOCK', () => {
      const result = {
        result: 'draw' as const,
        engineVer: '0.19.0',
        events: [
          { type: 'KICKOFF' as const, displayAtMs: 0, engineVer: '0.19.0', meta: { home: 'h', away: 'a' } },
          {
            type: 'BLOCK' as const,
            displayAtMs: 1000,
            engineVer: '0.19.0',
            meta: {
              attackerId: 'roster-home-1',
              defenderId: 'roster-away-1',
              kind: 'block',
            },
          },
        ],
        casualties: [],
        summary: {
          outcome: 'draw' as const,
          score: { home: 0, away: 0 },
          durationMs: 1000,
          touchdownCount: 0,
          casualtyCount: 0,
          turnoverCount: 0,
          nuffleCount: 0,
          underdogBoostCount: 0,
          momentum: [],
        },
      };
      const out = narrateMatch(result, {
        rosters: { home: homeRoster, away: awayRoster },
        hideTimestamps: true,
      });
      expect(out).toContain('Bob Smasher (#3 Blitzer) blocks Carla Catcher (#7 Catcher)');
    });

    it('fallback sur l\'id brut quand le roster ne mappe pas le playerId', () => {
      const result = {
        result: 'draw' as const,
        engineVer: '0.19.0',
        events: [
          { type: 'KICKOFF' as const, displayAtMs: 0, engineVer: '0.19.0', meta: {} },
          {
            type: 'BLOCK' as const,
            displayAtMs: 1000,
            engineVer: '0.19.0',
            meta: { attackerId: 'unknown-id', defenderId: 'B1', kind: 'block' },
          },
        ],
        casualties: [],
        summary: {
          outcome: 'draw' as const,
          score: { home: 0, away: 0 },
          durationMs: 1000,
          touchdownCount: 0,
          casualtyCount: 0,
          turnoverCount: 0,
          nuffleCount: 0,
          underdogBoostCount: 0,
          momentum: [],
        },
      };
      const out = narrateMatch(result, { rosters: { home: [], away: [] } });
      expect(out).toContain('unknown-id blocks B1');
    });

    it('render PLAYER_ACTIVATION / BLITZ_DECLARED / KNOCKDOWN avec noms du roster', () => {
      const result = {
        result: 'draw' as const,
        engineVer: '0.19.0',
        events: [
          { type: 'KICKOFF' as const, displayAtMs: 0, engineVer: '0.19.0', meta: {} },
          {
            type: 'PLAYER_ACTIVATION' as const,
            displayAtMs: 1000,
            engineVer: '0.19.0',
            meta: { playerId: 'roster-home-1', team: 'home' },
          },
          {
            type: 'BLITZ_DECLARED' as const,
            displayAtMs: 1000,
            engineVer: '0.19.0',
            meta: {
              attackerId: 'roster-home-1',
              defenderId: 'roster-away-1',
            },
          },
          {
            type: 'KNOCKDOWN' as const,
            displayAtMs: 1000,
            engineVer: '0.19.0',
            meta: {
              playerId: 'roster-away-1',
              team: 'away',
              causedBy: 'roster-home-1',
            },
          },
        ],
        casualties: [],
        summary: {
          outcome: 'draw' as const,
          score: { home: 0, away: 0 },
          durationMs: 1000,
          touchdownCount: 0,
          casualtyCount: 0,
          turnoverCount: 0,
          nuffleCount: 0,
          underdogBoostCount: 0,
          momentum: [],
        },
      };
      const out = narrateMatch(result, {
        rosters: { home: homeRoster, away: awayRoster },
        hideTimestamps: true,
      });
      expect(out).toContain('Bob Smasher (#3 Blitzer) (home) takes action');
      expect(out).toContain('BLITZ! — Bob Smasher (#3 Blitzer) charges Carla Catcher (#7 Catcher)');
      expect(out).toContain('KNOCKDOWN — Carla Catcher (#7 Catcher) is knocked down by Bob Smasher (#3 Blitzer)');
    });

    it('mode legacy (sans rosters) reste fonctionnel avec playerId brut', () => {
      const result = {
        result: 'draw' as const,
        engineVer: '0.19.0',
        events: [
          { type: 'KICKOFF' as const, displayAtMs: 0, engineVer: '0.19.0', meta: {} },
          {
            type: 'BLOCK' as const,
            displayAtMs: 1000,
            engineVer: '0.19.0',
            meta: { attackerId: 'A1', defenderId: 'B1', kind: 'block' },
          },
        ],
        casualties: [],
        summary: {
          outcome: 'draw' as const,
          score: { home: 0, away: 0 },
          durationMs: 1000,
          touchdownCount: 0,
          casualtyCount: 0,
          turnoverCount: 0,
          nuffleCount: 0,
          underdogBoostCount: 0,
          momentum: [],
        },
      };
      const out = narrateMatch(result);
      expect(out).toContain('A1 blocks B1');
    });
  });
});
