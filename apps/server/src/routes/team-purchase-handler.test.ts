/**
 * S27.8.28 — Smoke tests pour `handlePurchase` extrait depuis
 * `routes/team.ts` vers `routes/team-purchase-handler.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    teamSelection: { findFirst: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from '../prisma';
import { handlePurchase } from './team-purchase-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  team: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  teamSelection: { findFirst: ReturnType<typeof vi.fn> };
};

function createRes() {
  const res: Partial<Response> & {
    statusCode?: number;
    payload?: unknown;
  } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((payload: unknown) => {
    res.payload = payload;
    return res as Response;
  });
  return res as Response & { statusCode?: number; payload?: unknown };
}

function createReq(
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest {
  return {
    body: {},
    params: { id: 'team-1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.28 — team-purchase-handler exports', () => {
  it('exposes handlePurchase', () => {
    expect(typeof handlePurchase).toBe('function');
  });

  it('re-exports handlePurchase from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handlePurchase).toBe('function');
  });
});

describe('handlePurchase — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({ body: { type: 'reroll' } });
    const res = createRes();
    await handlePurchase(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when team is engaged in an active match', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce({
      id: 'team-1',
      players: [],
      treasury: 0,
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 0,
      roster: 'skaven',
    });
    mockPrisma.teamSelection.findFirst.mockResolvedValueOnce({
      id: 'sel-1',
    });
    const req = createReq({ body: { type: 'reroll' } });
    const res = createRes();
    await handlePurchase(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('handlePurchase — apothecary roster gating (retour A30)', () => {
  function mockTeam(roster: string) {
    mockPrisma.team.findFirst.mockResolvedValueOnce({
      id: 'team-1',
      players: [],
      treasury: 200000,
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 0,
      roster,
    });
    mockPrisma.teamSelection.findFirst.mockResolvedValueOnce(null);
  }

  it.each(['undead', 'necromantic_horror', 'tomb_kings', 'nurgle'])(
    'refuse l\'apothicaire (422) pour le roster mort-vivant %s',
    async (roster) => {
      mockTeam(roster);
      const req = createReq({ body: { type: 'apothecary' } });
      const res = createRes();
      await handlePurchase(req, res);
      expect(res.statusCode).toBe(422);
      expect((res as { payload?: { error?: string } }).payload?.error).toMatch(
        /mort-vivantes/i,
      );
      // Aucun débit ne doit avoir été tenté.
      expect(mockPrisma.team.updateMany).not.toHaveBeenCalled();
    },
  );

  it('refuse aussi via l\'alias legacy necromantic', async () => {
    mockTeam('necromantic');
    const req = createReq({ body: { type: 'apothecary' } });
    const res = createRes();
    await handlePurchase(req, res);
    expect(res.statusCode).toBe(422);
    expect(mockPrisma.team.updateMany).not.toHaveBeenCalled();
  });

  it('autorise l\'apothicaire pour un roster normal (human)', async () => {
    mockTeam('human');
    mockPrisma.team.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.team.findUnique.mockResolvedValueOnce({
      id: 'team-1',
      players: [],
    });
    const req = createReq({ body: { type: 'apothecary' } });
    const res = createRes();
    await handlePurchase(req, res);
    expect(res.statusCode).toBe(200);
    // Le débit atomique conditionnel a bien été déclenché.
    expect(mockPrisma.team.updateMany).toHaveBeenCalledTimes(1);
  });
});
