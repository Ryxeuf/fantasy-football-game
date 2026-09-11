/**
 * `resyncValidatedSheets` — parcours des feuilles validées et rapport.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: { leagueMatchSheet: { findMany: vi.fn() }, $disconnect: vi.fn() },
}));
vi.mock('../services/league-sheet-casualty-resync', () => ({
  resyncValidatedSheetCasualties: vi.fn(),
}));

import { prisma } from '../prisma';
import { resyncValidatedSheetCasualties } from '../services/league-sheet-casualty-resync';
import { resyncValidatedSheets } from './resync-sheet-casualties';

type MockFn = ReturnType<typeof vi.fn>;
const findMany = prisma.leagueMatchSheet.findMany as unknown as MockFn;
const resync = resyncValidatedSheetCasualties as unknown as MockFn;

const plan = (changed: boolean) => ({
  pairingId: 'p',
  matchId: 'm',
  casualties: { before: { home: 5, away: 0 }, after: { home: 4, away: 0 } },
  players: [],
  bonus: null,
  changed,
  snapshot: { input: {} },
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('resyncValidatedSheets', () => {
  it('ne parcourt que les feuilles VALIDÉES de ligue, dans l\'ordre de validation', async () => {
    findMany.mockResolvedValue([{ pairingId: 'p1' }, { pairingId: null }, { pairingId: 'p2' }]);
    resync
      .mockResolvedValueOnce({ skipped: false, applied: false, plan: plan(true) })
      .mockResolvedValueOnce({ skipped: false, applied: false, plan: plan(false) });
    const report = await resyncValidatedSheets({ apply: false });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'validated', pairingId: { not: null } },
      orderBy: { validatedAt: 'asc' },
    });
    expect(resync).toHaveBeenCalledTimes(2);
    expect(resync).toHaveBeenCalledWith('p1', { apply: false });
    expect(report).toMatchObject({ scanned: 2, changed: 1, applied: 0, skipped: [] });
    expect(report.changes.map((c) => c.pairingId)).toEqual(['p1']);
  });

  it('compte les feuilles réécrites en mode --apply et remonte les ignorées', async () => {
    findMany.mockResolvedValue([{ pairingId: 'p1' }, { pairingId: 'p2' }]);
    resync
      .mockResolvedValueOnce({ skipped: false, applied: true, plan: plan(true) })
      .mockResolvedValueOnce({ skipped: true, reason: 'season-completed' });
    const report = await resyncValidatedSheets({ apply: true });
    expect(resync).toHaveBeenCalledWith('p1', { apply: true });
    expect(report).toMatchObject({
      scanned: 2,
      changed: 1,
      applied: 1,
      skipped: [{ pairingId: 'p2', reason: 'season-completed' }],
    });
  });

  it('--pairing restreint le parcours à UNE rencontre', async () => {
    findMany.mockResolvedValue([]);
    await resyncValidatedSheets({ apply: false, pairingId: 'p9' });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { status: 'validated', pairingId: 'p9' },
    });
  });
});
