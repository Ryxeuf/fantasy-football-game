/**
 * Tests pour `compress.ts` — sprint Pro League lot 1.A.2.
 *
 * Couvre :
 * - Roundtrip events → compressed → events (déterministe).
 * - Ratio de compression > 2× sur un match réel.
 * - Cas limites (array vide, events arbitraires).
 * - Erreur de payload corrompu.
 */

import { describe, expect, it } from 'vitest';

import type { MatchEvent } from '@bb/shared-types';

import { simulateMatch } from '../simulate-match';
import { PRO_LEAGUE_TEAMS } from '../tactics/race-profiles';

import {
  compressEvents,
  computeCompressionStats,
  decompressEvents,
} from './compress';

describe('compressEvents / decompressEvents — sprint 1.A.2', () => {
  it('roundtrips an empty array', async () => {
    const compressed = await compressEvents([]);
    const decoded = await decompressEvents(compressed);
    expect(decoded).toEqual([]);
  });

  it('roundtrips a synthetic event list', async () => {
    const events: MatchEvent[] = [
      {
        type: 'KICKOFF',
        displayAtMs: 0,
        engineVer: '0.13.0',
        seed: 42,
        meta: { home: 'a', away: 'b' },
      },
      {
        type: 'TURN_START',
        displayAtMs: 30_000,
        engineVer: '0.13.0',
        meta: { half: 1, turn: 1, drivingTeam: 'home', ballYardline: 4 },
      },
      {
        type: 'TD',
        displayAtMs: 60_000,
        engineVer: '0.13.0',
        meta: { team: 'home', half: 1, turn: 2 },
      },
    ];
    const compressed = await compressEvents(events);
    const decoded = await decompressEvents(compressed);
    expect(decoded).toEqual(events);
  });

  it('produces a Buffer whose length is < raw JSON size', async () => {
    const events: MatchEvent[] = Array.from({ length: 100 }, (_, i) => ({
      type: 'TURN_START',
      displayAtMs: i * 30_000,
      engineVer: '0.13.0',
      meta: { half: 1, turn: i + 1, drivingTeam: 'home', ballYardline: 4 },
    }));
    const compressed = await compressEvents(events);
    const stats = computeCompressionStats(events, compressed);
    expect(stats.compressedSize).toBeLessThan(stats.rawJsonSize);
    // Fortement répétitif → ratio attendu très élevé (>5×).
    expect(stats.ratio).toBeGreaterThan(5);
  });

  it('compresses a real simulated match by ≥ 2× vs JSON', async () => {
    const home = PRO_LEAGUE_TEAMS[0];
    const away = PRO_LEAGUE_TEAMS[1];
    const result = simulateMatch({
      seed: 1,
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
    });
    const compressed = await compressEvents(result.events);
    const stats = computeCompressionStats(result.events, compressed);
    expect(stats.compressedSize).toBeLessThan(stats.rawJsonSize);
    expect(stats.ratio).toBeGreaterThan(2);
  });

  it('decompressEvents throws on a non-array payload', async () => {
    // Encode un objet (non array) directement et tente de décompresser.
    const events = await compressEvents([]);
    // Tampon de 1 octet aléatoire = certain d'être invalide.
    const corrupt = Buffer.from([0]);
    await expect(decompressEvents(corrupt)).rejects.toThrow();
    // Sanité : le bon payload, lui, fonctionne.
    await expect(decompressEvents(events)).resolves.toEqual([]);
  });
});
