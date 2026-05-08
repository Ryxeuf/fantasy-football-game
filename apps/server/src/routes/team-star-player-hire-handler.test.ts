/**
 * S27.8.31 — Smoke tests pour `handleHireStarPlayer` extrait depuis
 * `team-star-player-handlers.ts` vers `team-star-player-hire-handler.ts`.
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
import { handleHireStarPlayer } from './team-star-player-hire-handler';
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
    body: { starPlayerSlug: 'griff_oberwald' },
    params: { id: 'team-1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.31 — team-star-player-hire-handler exports', () => {
  it('exposes handleHireStarPlayer', () => {
    expect(typeof handleHireStarPlayer).toBe('function');
  });

  it('re-exports handleHireStarPlayer via team-star-player-handlers', async () => {
    const mod = await import('./team-star-player-handlers');
    expect(typeof mod.handleHireStarPlayer).toBe('function');
  });

  it('re-exports handleHireStarPlayer from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleHireStarPlayer).toBe('function');
  });
});

describe('handleHireStarPlayer — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleHireStarPlayer(req, res);
    expect(res.statusCode).toBe(404);
  });
});
