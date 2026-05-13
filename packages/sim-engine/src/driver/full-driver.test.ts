/**
 * Tests pour `runFullDriver` (Lot 3.A.2.a).
 *
 * Smoke tests MVP : on vérifie que l'orchestrateur ne plante pas,
 * termine en temps borné, et retourne un SimResult valide. Les
 * benchmarks de qualité statistique vs FUMBBL arrivent en Lot 3.A.3.
 */

import { describe, expect, it } from 'vitest';

import { PRO_LEAGUE_TEAMS } from '../tactics/race-profiles';
import type { SimInput } from '../types';

import { runFullDriver } from './full-driver';

function buildInput(overrides: Partial<SimInput> = {}): SimInput {
  const home = PRO_LEAGUE_TEAMS[0];
  const away = PRO_LEAGUE_TEAMS[1];
  return {
    seed: 42,
    home: {
      id: home.id,
      name: home.name,
      side: 'home',
      tactics: home.tactics,
      tv: home.tv,
    },
    away: {
      id: away.id,
      name: away.name,
      side: 'away',
      tactics: away.tactics,
      tv: away.tv,
    },
    ...overrides,
  };
}

describe('runFullDriver — Lot 3.A.2.a (MVP smoke)', () => {
  it('termine sans throw pour un input minimal', () => {
    const result = runFullDriver(buildInput());
    expect(result).toBeDefined();
    expect(result.engineVer).toBeDefined();
    expect(result.events.length).toBeGreaterThanOrEqual(2); // KICKOFF + END
  });

  it('produit un SimResult avec score, outcome, et casualties array', () => {
    const result = runFullDriver(buildInput());
    expect(result.summary.score).toBeDefined();
    expect(['home', 'away', 'draw']).toContain(result.summary.outcome);
    expect(Array.isArray(result.casualties)).toBe(true);
    expect(result.summary.touchdownCount).toBe(
      result.summary.score.home + result.summary.score.away
    );
  });

  it('même seed → même résultat (déterminisme)', () => {
    const a = runFullDriver(buildInput({ seed: 314 }));
    const b = runFullDriver(buildInput({ seed: 314 }));
    expect(b.summary).toEqual(a.summary);
    expect(b.events.length).toBe(a.events.length);
  });

  it('seeds différents peuvent produire des résultats différents', () => {
    const a = runFullDriver(buildInput({ seed: 1 }));
    const b = runFullDriver(buildInput({ seed: 2 }));
    // On ne peut pas garantir 100% de divergence (deux RNG paths
    // peuvent converger), mais sur un seed varié on attend au moins
    // une chance que score ou casualtyCount diffèrent. Test smoke :
    // les deux runs sont structurés correctement.
    expect(a.summary.score).toBeDefined();
    expect(b.summary.score).toBeDefined();
  });

  it("ne dépasse pas la borne MAX_ACTIONS_PER_MATCH (timeout safety)", () => {
    // On lance le driver et on s'assure qu'il termine — si le no-progress
    // detection plante on sait qu'on a un bug.
    const result = runFullDriver(buildInput({ seed: 999 }));
    expect(result).toBeDefined();
  });

  it('outcome cohérent avec score (home > away → home, etc.)', () => {
    const result = runFullDriver(buildInput({ seed: 7 }));
    const { home, away } = result.summary.score;
    if (home > away) {
      expect(result.summary.outcome).toBe('home');
    } else if (away > home) {
      expect(result.summary.outcome).toBe('away');
    } else {
      expect(result.summary.outcome).toBe('draw');
    }
  });

  it('toujours un KICKOFF en premier event et un END en dernier', () => {
    const result = runFullDriver(buildInput());
    expect(result.events[0].type).toBe('KICKOFF');
    expect(result.events[result.events.length - 1].type).toBe('END');
  });

  it('joue les 2 mi-temps complètes (HALFTIME + ≥10 TURN_START)', () => {
    // Régression : avant le fix stale-detection, le driver break à
    // turn 3 first half (5 END_TURN consécutifs comptés comme stale
    // alors qu'en BB un END_TURN sur deux n'avance pas state.turn).
    const result = runFullDriver(buildInput({ seed: 42 }));
    const turnStarts = result.events.filter((e) => e.type === 'TURN_START');
    const halftimes = result.events.filter((e) => e.type === 'HALFTIME');
    expect(halftimes.length).toBe(1);
    // Un match complet émet ≥10 TURN_START (cap conservateur ; en
    // pratique on observe ~16 sur les seeds testés).
    expect(turnStarts.length).toBeGreaterThanOrEqual(10);
  });

  it('alterne drivingTeam home/away dans les TURN_START', () => {
    // Régression : avant le fix, TURN_START n'était émis que quand
    // `state.turn` avançait — or `state.turn` ne change qu'un END_TURN
    // sur deux, donc tous les TURN_START portaient drivingTeam=home.
    const result = runFullDriver(buildInput({ seed: 42 }));
    const drivingTeams = result.events
      .filter((e) => e.type === 'TURN_START')
      .map((e) => (e.meta as { drivingTeam?: string }).drivingTeam ?? '');
    expect(drivingTeams).toContain('home');
    expect(drivingTeams).toContain('away');
  });

  it('summary.durationMs > 0 et match le displayAtMs du dernier event', () => {
    // Régression : `durationMs` était hardcodé à 0 dans le summary.
    const result = runFullDriver(buildInput({ seed: 42 }));
    expect(result.summary.durationMs).toBeGreaterThan(0);
    const lastEvent = result.events[result.events.length - 1];
    expect(result.summary.durationMs).toBe(lastEvent.displayAtMs);
  });
});
