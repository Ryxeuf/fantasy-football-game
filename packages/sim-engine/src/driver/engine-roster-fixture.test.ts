import { describe, expect, it } from 'vitest';

import { PRO_LEAGUE_TEAM_BY_ID } from '../tactics/race-profiles';

import { buildSimInputForDriver } from './engine-roster-fixture';

const SMASHERS = PRO_LEAGUE_TEAM_BY_ID['pit-smashers'];
const HAWKS = PRO_LEAGUE_TEAM_BY_ID['kc-soaring-hawks'];

describe('buildSimInputForDriver', () => {
  it('full : les deux équipes reçoivent un roster de 13 joueurs (pas le 2 contre 2 de setup())', () => {
    const input = buildSimInputForDriver(SMASHERS, HAWKS, 7, 'full');
    expect(input.seed).toBe(7);
    expect(input.home.roster).toHaveLength(13);
    expect(input.away.roster).toHaveLength(13);
    expect(input.home.tactics).toBe(SMASHERS.tactics);
  });

  it('hybrid : aucun roster, comme le bench historique', () => {
    const input = buildSimInputForDriver(SMASHERS, HAWKS, 7, 'hybrid');
    expect(input.home.roster).toBeUndefined();
    expect(input.away.roster).toBeUndefined();
    expect(input.away).toMatchObject({ id: HAWKS.id, side: 'away', tv: HAWKS.tv });
  });
});
