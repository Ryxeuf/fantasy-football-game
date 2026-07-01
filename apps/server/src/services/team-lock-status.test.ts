import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    teamSelection: { findFirst: vi.fn() },
    localMatch: { findFirst: vi.fn() },
    leagueParticipant: { findFirst: vi.fn() },
    cupParticipant: { findFirst: vi.fn() },
  },
}));

import { prisma } from '../prisma';
import { isTeamRosterFrozen } from './team-lock-status';

const mocks = prisma as unknown as {
  teamSelection: { findFirst: ReturnType<typeof vi.fn> };
  localMatch: { findFirst: ReturnType<typeof vi.fn> };
  leagueParticipant: { findFirst: ReturnType<typeof vi.fn> };
  cupParticipant: { findFirst: ReturnType<typeof vi.fn> };
};

function resetAllNull() {
  mocks.teamSelection.findFirst.mockResolvedValue(null);
  mocks.localMatch.findFirst.mockResolvedValue(null);
  mocks.leagueParticipant.findFirst.mockResolvedValue(null);
  mocks.cupParticipant.findFirst.mockResolvedValue(null);
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
