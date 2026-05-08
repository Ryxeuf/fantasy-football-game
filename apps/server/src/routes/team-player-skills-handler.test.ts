/**
 * S27.8.30 — Smoke tests pour `handleUpdatePlayerSkills` extrait
 * depuis `team-player-handlers.ts` vers
 * `team-player-skills-handler.ts` (polish slice : ramener
 * team-player-handlers.ts sous DoD 400).
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
import { handleUpdatePlayerSkills } from './team-player-skills-handler';
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
    params: { id: 'team-1', playerId: 'p-1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.30 — team-player-skills-handler exports', () => {
  it('exposes handleUpdatePlayerSkills', () => {
    expect(typeof handleUpdatePlayerSkills).toBe('function');
  });

  it('re-exports handleUpdatePlayerSkills via team-player-handlers', async () => {
    const mod = await import('./team-player-handlers');
    expect(typeof mod.handleUpdatePlayerSkills).toBe('function');
  });

  it('re-exports handleUpdatePlayerSkills from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleUpdatePlayerSkills).toBe('function');
  });
});

describe('handleUpdatePlayerSkills — defensive gates', () => {
  it('returns 400 when skillSlug missing on chosen advancement', async () => {
    const req = createReq({ body: { advancementType: 'primary' } });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when skillCategory missing on random advancement', async () => {
    const req = createReq({ body: { advancementType: 'random-primary' } });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({
      body: { advancementType: 'primary', skillSlug: 'block' },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(404);
  });
});
