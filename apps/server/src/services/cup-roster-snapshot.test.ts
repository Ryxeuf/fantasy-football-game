import { describe, it, expect } from 'vitest';
import { buildRosterSnapshot, type TeamForSnapshot } from './cup-roster-snapshot';

const team: TeamForSnapshot = {
  roster: 'skaven',
  ruleset: 'season_3',
  format: 'bb11',
  teamValue: 1000,
  currentValue: 1000,
  initialBudget: 1000,
  startingPspPool: 6,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: true,
  dedicatedFans: 1,
  players: [
    {
      name: 'Lineman 1',
      position: 'skaven_lineman',
      number: 1,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: '',
      spp: 0,
      advancements: '[{"skillSlug":"block","type":"primary","isRandom":false,"at":1}]',
    },
  ],
  starPlayers: [{ starPlayerSlug: 'hakflem', cost: 250 }],
};

describe('buildRosterSnapshot', () => {
  it('capture les métadonnées, joueurs et star players', () => {
    const snap = buildRosterSnapshot(team, 42);
    expect(snap.capturedAt).toBe(42);
    expect(snap.roster).toBe('skaven');
    expect(snap.startingPspPool).toBe(6);
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0].advancements).toContain('block');
    expect(snap.starPlayers[0]).toEqual({ starPlayerSlug: 'hakflem', cost: 250 });
  });

  it('produit un objet JSON-sérialisable stable', () => {
    const snap = buildRosterSnapshot(team, 42);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});
