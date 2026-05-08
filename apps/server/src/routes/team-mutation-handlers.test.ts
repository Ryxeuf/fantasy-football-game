/**
 * S27.8.25 — Smoke tests pour les 3 handlers de mutation team
 * extraits depuis `routes/team.ts` vers
 * `routes/team-mutation-handlers.ts`.
 *
 * Garantit :
 *  - les 3 handlers sont exportes depuis le nouveau module
 *  - les 3 handlers sont re-exportes depuis `team.ts`
 *  - les gates de defense (`Equipe introuvable`) repondent.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../prisma';
import {
  handlePutTeamInfo,
  handleRecalculateTeam,
  handleUpdateTeam,
} from './team-mutation-handlers';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn> };
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

describe('S27.8.25 — team-mutation-handlers exports', () => {
  it('exposes the 3 named handlers', () => {
    expect(typeof handlePutTeamInfo).toBe('function');
    expect(typeof handleRecalculateTeam).toBe('function');
    expect(typeof handleUpdateTeam).toBe('function');
  });

  it('re-exports the 3 handlers from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handlePutTeamInfo).toBe('function');
    expect(typeof mod.handleRecalculateTeam).toBe('function');
    expect(typeof mod.handleUpdateTeam).toBe('function');
  });
});

describe('handlePutTeamInfo — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({ body: { rerolls: 4 } });
    const res = createRes();
    await handlePutTeamInfo(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('handleRecalculateTeam — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleRecalculateTeam(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('handleUpdateTeam — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({ body: { players: [] } });
    const res = createRes();
    await handleUpdateTeam(req, res);
    expect(res.statusCode).toBe(404);
  });
});
