import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    teamSelection: { findFirst: vi.fn() },
    localMatch: { findFirst: vi.fn() },
    leagueParticipant: { findFirst: vi.fn() },
    cupParticipant: { findFirst: vi.fn() },
    leaguePairing: { findFirst: vi.fn() },
  },
}));

import { prisma } from '../prisma';
import { isTeamBuildLocked, isTeamRosterFrozen } from './team-lock-status';

const mocks = prisma as unknown as {
  teamSelection: { findFirst: ReturnType<typeof vi.fn> };
  localMatch: { findFirst: ReturnType<typeof vi.fn> };
  leagueParticipant: { findFirst: ReturnType<typeof vi.fn> };
  cupParticipant: { findFirst: ReturnType<typeof vi.fn> };
  leaguePairing: { findFirst: ReturnType<typeof vi.fn> };
};

function resetAllNull() {
  mocks.teamSelection.findFirst.mockResolvedValue(null);
  mocks.localMatch.findFirst.mockResolvedValue(null);
  mocks.leagueParticipant.findFirst.mockResolvedValue(null);
  mocks.cupParticipant.findFirst.mockResolvedValue(null);
  mocks.leaguePairing.findFirst.mockResolvedValue(null);
}

describe('isTeamRosterFrozen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllNull();
  });

  it('returns false for a brand-new draft team (no engagement)', async () => {
    expect(await isTeamRosterFrozen('team-1')).toBe(false);
  });

  it('returns true when the team has a match selection', async () => {
    resetAllNull();
    mocks.teamSelection.findFirst.mockResolvedValue({ id: 'sel-1' });
    expect(await isTeamRosterFrozen('team-1')).toBe(true);
  });

  it('returns true when the team is in a non-cancelled local match', async () => {
    resetAllNull();
    mocks.localMatch.findFirst.mockResolvedValue({ id: 'lm-1' });
    expect(await isTeamRosterFrozen('team-1')).toBe(true);
    // Le filtre exclut bien les matchs annules.
    expect(mocks.localMatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { status: 'cancelled' } }),
      }),
    );
  });

  it('returns true when the team is a league participant', async () => {
    resetAllNull();
    mocks.leagueParticipant.findFirst.mockResolvedValue({ id: 'lp-1' });
    expect(await isTeamRosterFrozen('team-1')).toBe(true);
  });

  it('returns true when the team is a cup participant', async () => {
    resetAllNull();
    mocks.cupParticipant.findFirst.mockResolvedValue({ id: 'cp-1' });
    expect(await isTeamRosterFrozen('team-1')).toBe(true);
  });
});

describe('isTeamBuildLocked', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllNull();
  });

  it("ne fige rien pour une equipe fraiche", async () => {
    expect(await isTeamBuildLocked('team-1')).toBe(false);
  });

  it("ne fige PAS une equipe simplement inscrite en ligue", async () => {
    resetAllNull();
    // La seule inscription (`LeagueParticipant`) fige la COMPOSITION...
    mocks.leagueParticipant.findFirst.mockResolvedValue({ id: 'lp-1' });
    expect(await isTeamRosterFrozen('team-1')).toBe(true);
    // ...mais pas les achats de construction : aucun appariement engage.
    expect(await isTeamBuildLocked('team-1')).toBe(false);
    // On n'interroge meme pas `LeagueParticipant` pour ce gel-ci.
    expect(mocks.leaguePairing.findFirst).toHaveBeenCalledTimes(1);
  });

  it("fige des qu'un appariement de ligue est engage", async () => {
    resetAllNull();
    mocks.leaguePairing.findFirst.mockResolvedValue({ id: 'pair-1' });
    expect(await isTeamBuildLocked('team-1')).toBe(true);
  });

  it("ne retient que les appariements avec feuille ou sortis de 'prevu'", async () => {
    resetAllNull();
    await isTeamBuildLocked('team-1');
    const where = mocks.leaguePairing.findFirst.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { homeParticipant: { teamId: 'team-1' } },
      { awayParticipant: { teamId: 'team-1' } },
    ]);
    expect(where.AND).toEqual([
      {
        OR: [
          { matchSheet: { isNot: null } },
          { status: { notIn: ['scheduled', 'cancelled'] } },
        ],
      },
    ]);
  });

  it('fige sur selection, match local non annule et inscription en coupe', async () => {
    for (const key of ['teamSelection', 'localMatch', 'cupParticipant'] as const) {
      resetAllNull();
      mocks[key].findFirst.mockResolvedValue({ id: 'x' });
      expect(await isTeamBuildLocked('team-1')).toBe(true);
    }
  });
});
