import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    teamPlayer: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('./post-match-league-sequence', () => ({
  applyAdvancementChoice: vi.fn(),
}));

import { prisma } from '../prisma';
import { applyAdvancementChoice } from './post-match-league-sequence';
import {
  applyCupBuildAdvancements,
  CupBuildAdvancementError,
} from './cup-build-advancements';

const mockFindUnique = prisma.teamPlayer.findUnique as unknown as ReturnType<
  typeof vi.fn
>;
const mockUpdate = prisma.teamPlayer.update as unknown as ReturnType<typeof vi.fn>;
const mockApply = applyAdvancementChoice as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  mockUpdate.mockResolvedValue({});
});

function playerWith(taken: number, teamId = 'T1') {
  return {
    id: 'P1',
    teamId,
    advancements: JSON.stringify(Array.from({ length: taken }, () => ({}))),
  };
}

describe('applyCupBuildAdvancements', () => {
  it('applique deux améliorations et décompte le pool (primary=6, random-primary=3)', async () => {
    mockFindUnique
      .mockResolvedValueOnce({ id: 'P1', teamId: 'T1', advancements: '[]' })
      .mockResolvedValueOnce({ id: 'P2', teamId: 'T1', advancements: '[]' });
    mockApply.mockResolvedValue({ applied: true });

    const res = await applyCupBuildAdvancements('T1', 16, [
      { playerId: 'P1', type: 'primary', skillSlug: 'block' },
      { playerId: 'P2', type: 'random-primary', skillSlug: 'dodge', category: 'A' },
    ]);

    expect(res).toEqual({ poolSpent: 9, poolRemaining: 7, count: 2 });
    // Crédit exact avant chaque dépense.
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'P1' },
      data: { spp: { increment: 6 } },
    });
    expect(mockApply).toHaveBeenCalledTimes(2);
  });

  it('lève pool-exceeded si le coût dépasse le solde', async () => {
    mockFindUnique.mockResolvedValue(playerWith(0));
    await expect(
      applyCupBuildAdvancements('T1', 3, [
        { playerId: 'P1', type: 'primary', skillSlug: 'block' }, // coût 6 > 3
      ]),
    ).rejects.toMatchObject({ code: 'pool-exceeded' });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it("lève player-not-on-team si le joueur n'appartient pas à l'équipe", async () => {
    mockFindUnique.mockResolvedValue(playerWith(0, 'OTHER'));
    await expect(
      applyCupBuildAdvancements('T1', 20, [
        { playerId: 'P1', type: 'primary', skillSlug: 'block' },
      ]),
    ).rejects.toBeInstanceOf(CupBuildAdvancementError);
  });

  it('rollback le crédit et lève si applyAdvancementChoice refuse', async () => {
    mockFindUnique.mockResolvedValue({ id: 'P1', teamId: 'T1', advancements: '[]' });
    mockApply.mockResolvedValue({ skipped: true, reason: 'skill-not-in-pool' });

    await expect(
      applyCupBuildAdvancements('T1', 20, [
        { playerId: 'P1', type: 'primary', skillSlug: 'guard' },
      ]),
    ).rejects.toMatchObject({ code: 'skill-not-in-pool' });

    // crédit (+6) puis rollback (−6)
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'P1' },
      data: { spp: { increment: 6 } },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'P1' },
      data: { spp: { decrement: 6 } },
    });
  });
});
