/**
 * S27.8.32 — Smoke tests pour `handleGetMatchSummary` extrait depuis
 * `match-details-handlers.ts` vers `match-summary-handler.ts`
 * (polish slice : ramener match-details-handlers.ts sous DoD 400).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    match: { findUnique: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../prisma';
import { handleGetMatchSummary } from './match-summary-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  match: { findUnique: ReturnType<typeof vi.fn> };
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
    params: { id: 'm1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.32 — match-summary-handler exports', () => {
  it('exposes handleGetMatchSummary', () => {
    expect(typeof handleGetMatchSummary).toBe('function');
  });

  it('re-exports handleGetMatchSummary via match-details-handlers', async () => {
    const mod = await import('./match-details-handlers');
    expect(typeof mod.handleGetMatchSummary).toBe('function');
  });

  it('re-exports handleGetMatchSummary from match.ts (test-import compat)', async () => {
    const mod = await import('./match');
    expect(typeof mod.handleGetMatchSummary).toBe('function');
  });
});

describe('handleGetMatchSummary — defensive gates', () => {
  it('returns 404 when match not found', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleGetMatchSummary(req, res);
    expect(res.statusCode).toBe(404);
  });
});
