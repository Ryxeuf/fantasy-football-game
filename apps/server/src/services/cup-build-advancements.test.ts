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

/**
 * Barème d'un règlement de tournoi : le crédit et le débit doivent partir
 * du MÊME chiffre.
 *
 * Régression prod (Ogres, NAF World Cup 2027) : on créditait le coût du pack
 * (Garde primaire Élite = 8) et `applyAdvancementChoice` ne débitait que le
 * barème standard (6). L'écart restait en SPP fantômes sur le joueur —
 * 12 PSP jamais gagnés sur l'équipe entière — dépensables ensuite HORS des
 * règles du tournoi, puisque le financement « SPP du joueur » n'est pas
 * soumis au règlement. Et faute de `pspCost` persisté, la fiche annonçait
 * 54 PSP dépensés sur un pool de 66.
 */
describe('applyCupBuildAdvancements — barème de tournoi', () => {
  /** NAF WC 2027 : 6/8 primaire, 10/12 secondaire, +2 si Élite. */
  const ELITE = new Set(['guard', 'block']);
  const nafCost = (taken: number, type: string, skillSlug?: string): number => {
    const base =
      taken <= 0 ? (type === 'primary' ? 6 : 10) : type === 'primary' ? 8 : 12;
    return base + (skillSlug && ELITE.has(skillSlug) ? 2 : 0);
  };

  it('impose son coût au débit (pspCostOverride) et trace la source (pool)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'P1',
      teamId: 'T1',
      advancements: '[]',
    });
    mockApply.mockResolvedValue({ applied: true });

    const res = await applyCupBuildAdvancements(
      'T1',
      66,
      [{ playerId: 'P1', type: 'primary', skillSlug: 'guard' }],
      nafCost,
    );

    // Garde primaire Élite = 6 + 2.
    expect(res.poolSpent).toBe(8);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'P1' },
      data: { spp: { increment: 8 } },
    });
    // Le débit part du même chiffre : plus de SPP fantômes.
    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({ pspCostOverride: 8, fundedBy: 'pool' }),
    );
  });

  it("consomme exactement le pool de 66 PSP de l'équipe Ogre remontée", async () => {
    // 1 Ogre à 2 compétences Élite, 4 Ogres Garde Élite, 1 Bagarreur et
    // 1 Joueur Déloyal non Élite.
    const picks = [
      { playerId: 'P1', type: 'primary' as const, skillSlug: 'guard' },
      { playerId: 'P1', type: 'secondary' as const, skillSlug: 'block' },
      ...['P2', 'P3', 'P4', 'P5'].map((playerId) => ({
        playerId,
        type: 'primary' as const,
        skillSlug: 'guard',
      })),
      { playerId: 'P6', type: 'primary' as const, skillSlug: 'brawler' },
      { playerId: 'P7', type: 'primary' as const, skillSlug: 'dirty-player' },
    ];
    // P1 a déjà une compétence quand la seconde est appliquée.
    const taken: Record<string, number> = {};
    mockFindUnique.mockImplementation(async ({ where }: any) => ({
      id: where.id,
      teamId: 'T1',
      advancements: JSON.stringify(
        Array.from({ length: taken[where.id] ?? 0 }, () => ({})),
      ),
    }));
    mockApply.mockImplementation(async (input: any) => {
      taken[input.playerId] = (taken[input.playerId] ?? 0) + 1;
      return { applied: true };
    });

    const res = await applyCupBuildAdvancements('T1', 66, picks, nafCost);

    // 8 + 14 + 4 × 8 + 6 + 6 = 66 : le pool est intégralement consommé,
    // par 8 améliorations réparties sur 7 joueurs.
    expect(res.poolSpent).toBe(66);
    expect(res.poolRemaining).toBe(0);
    expect(res.count).toBe(8);
    // Chaque débit égale son crédit ⇒ aucun SPP résiduel sur les joueurs.
    const credits = mockUpdate.mock.calls
      .filter((c) => c[0].data?.spp?.increment)
      .map((c) => c[0].data.spp.increment);
    const debits = mockApply.mock.calls.map((c) => c[0].pspCostOverride);
    expect(debits).toEqual(credits);
    expect(credits.reduce((a: number, b: number) => a + b, 0)).toBe(66);
  });

  it('refuse le 8e achat qui dépasserait le pool', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'P8',
      teamId: 'T1',
      advancements: '[]',
    });

    await expect(
      applyCupBuildAdvancements(
        'T1',
        5,
        [{ playerId: 'P8', type: 'primary', skillSlug: 'guard' }],
        nafCost,
      ),
    ).rejects.toMatchObject({ code: 'pool-exceeded' });
  });

  it('garde le barème standard quand aucun règlement n\'est fourni', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'P1',
      teamId: 'T1',
      advancements: '[]',
    });
    mockApply.mockResolvedValue({ applied: true });

    await applyCupBuildAdvancements('T1', 20, [
      { playerId: 'P1', type: 'primary', skillSlug: 'guard' },
    ]);

    expect(mockApply).toHaveBeenCalledWith(
      expect.objectContaining({ pspCostOverride: 6, fundedBy: 'pool' }),
    );
  });
});
