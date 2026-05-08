/**
 * S27.8.26 — Smoke tests pour les 2 handlers de selection / detail
 * extraits depuis `routes/team.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn() },
    match: { findUnique: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../prisma';
import {
  handleChooseTeam,
  handleGetTeamDetail,
} from './team-selection-handlers';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn> };
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
    params: { id: 'team-1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.26 — team-selection-handlers exports', () => {
  it('exposes the 2 named handlers', () => {
    expect(typeof handleChooseTeam).toBe('function');
    expect(typeof handleGetTeamDetail).toBe('function');
  });

  it('re-exports the 2 handlers from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleChooseTeam).toBe('function');
    expect(typeof mod.handleGetTeamDetail).toBe('function');
  });
});

describe('handleChooseTeam — defensive gates', () => {
  it('returns 404 when match not found', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce(null);
    const req = createReq({ body: { matchId: 'm1', teamId: 't1' } });
    const res = createRes();
    await handleChooseTeam(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when match is not pending', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: 'm1',
      status: 'active',
    });
    const req = createReq({ body: { matchId: 'm1', teamId: 't1' } });
    const res = createRes();
    await handleChooseTeam(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('handleGetTeamDetail — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleGetTeamDetail(req, res);
    expect(res.statusCode).toBe(404);
  });
});
