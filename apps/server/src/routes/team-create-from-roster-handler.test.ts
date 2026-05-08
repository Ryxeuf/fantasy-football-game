/**
 * S27.8.33 — Smoke tests pour `handleCreateFromRoster` extrait
 * depuis l'inline anonyme `POST /create-from-roster` dans
 * `routes/team.ts` (final extraction pour ramener team.ts sous DoD
 * secondaire 400).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { create: vi.fn(), findUnique: vi.fn() },
    teamPlayer: { createMany: vi.fn() },
    teamStarPlayer: { createMany: vi.fn() },
  },
}));

import { handleCreateFromRoster } from './team-create-from-roster-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

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
    body: { name: 'Test', roster: 'skaven' },
    params: {},
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.33 — team-create-from-roster-handler exports', () => {
  it('exposes handleCreateFromRoster', () => {
    expect(typeof handleCreateFromRoster).toBe('function');
  });

  it('re-exports handleCreateFromRoster from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleCreateFromRoster).toBe('function');
  });
});

describe('handleCreateFromRoster — defensive gates', () => {
  it('returns 400 when roster is not allowed', async () => {
    const req = createReq({
      body: { name: 'Test', roster: 'unknown_roster' },
    });
    const res = createRes();
    await handleCreateFromRoster(req, res);
    expect(res.statusCode).toBe(400);
  });
});
