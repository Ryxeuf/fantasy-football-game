import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    cupParticipant: { findFirst: vi.fn(), findMany: vi.fn() },
    leagueParticipant: { findFirst: vi.fn(), findMany: vi.fn() },
  },
}));

import { prisma } from '../prisma';
import { getTeamEngagement, getTeamsEngagement } from './team-competition-status';

const cupFind = prisma.cupParticipant.findFirst as unknown as ReturnType<typeof vi.fn>;
const leagueFind = prisma.leagueParticipant.findFirst as unknown as ReturnType<
  typeof vi.fn
>;
const cupFindMany = prisma.cupParticipant.findMany as unknown as ReturnType<
  typeof vi.fn
>;
const leagueFindMany = prisma.leagueParticipant.findMany as unknown as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe('getTeamEngagement', () => {
  it('non engagée si aucune coupe/ligue active', async () => {
    cupFind.mockResolvedValue(null);
    leagueFind.mockResolvedValue(null);
    expect(await getTeamEngagement('T1')).toEqual({ engaged: false });
  });

  it('engagée en coupe', async () => {
    cupFind.mockResolvedValue({ cup: { name: 'Coupe X' } });
    const r = await getTeamEngagement('T1');
    expect(r).toEqual({ engaged: true, kind: 'cup', name: 'Coupe X' });
    expect(leagueFind).not.toHaveBeenCalled(); // court-circuit
  });

  it('engagée en ligue (coupe libre)', async () => {
    cupFind.mockResolvedValue(null);
    leagueFind.mockResolvedValue({
      season: { name: 'Saison 1', league: { name: 'Ma Ligue' } },
    });
    expect(await getTeamEngagement('T1')).toEqual({
      engaged: true,
      kind: 'league',
      name: 'Ma Ligue — Saison 1',
    });
  });

  it('exclut la coupe courante via excludeCupId', async () => {
    cupFind.mockResolvedValue(null);
    leagueFind.mockResolvedValue(null);
    await getTeamEngagement('T1', { excludeCupId: 'C1' });
    expect(cupFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cupId: { not: 'C1' } }),
      }),
    );
  });
});

describe('getTeamsEngagement (batch)', () => {
  it('renvoie une map vide sans teamIds (aucune requête)', async () => {
    const map = await getTeamsEngagement([]);
    expect(map.size).toBe(0);
    expect(cupFindMany).not.toHaveBeenCalled();
  });

  it('map coupe + ligue, coupe prioritaire', async () => {
    cupFindMany.mockResolvedValue([
      { teamId: 'A', cup: { name: 'Coupe X' } },
    ]);
    leagueFindMany.mockResolvedValue([
      { teamId: 'A', season: { name: 'S1', league: { name: 'L' } } }, // ignoré (coupe déjà)
      { teamId: 'B', season: { name: 'S1', league: { name: 'L' } } },
    ]);
    const map = await getTeamsEngagement(['A', 'B', 'C']);
    expect(map.get('A')).toEqual({ kind: 'cup', name: 'Coupe X' });
    expect(map.get('B')).toEqual({ kind: 'league', name: 'L — S1' });
    expect(map.has('C')).toBe(false);
  });
});
