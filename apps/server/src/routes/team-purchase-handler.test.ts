/**
 * S27.8.28 — Smoke tests pour `handlePurchase` extrait depuis
 * `routes/team.ts` vers `routes/team-purchase-handler.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn() },
    teamSelection: { findFirst: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../prisma';
import { handlePurchase } from './team-purchase-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn> };
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
