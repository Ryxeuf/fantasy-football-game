/**
 * S27.8.29 — Smoke tests pour `handleValidateSetup` extrait depuis
 * la route inline `POST /:id/validate-setup` dans `routes/match.ts`
 * vers `routes/match-validate-setup-handler.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    match: { findUnique: vi.fn() },
    teamSelection: { findMany: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../services/prematch-setup', () => ({
  ensureSetupPhasePersisted: vi.fn(),
}));

vi.mock('../services/ai-setup', () => ({
  runAISetupIfNeeded: vi.fn(),
}));

vi.mock('../services/ai-kickoff', () => ({
  runAIKickoffIfNeeded: vi.fn(),
}));

vi.mock('../services/ai-loop', () => ({
  scheduleAILoop: vi.fn(),
}));

vi.mock('../services/turn-ownership', () => ({
  getUserTeamSide: vi.fn(),
}));

import { prisma } from '../prisma';
import { handleValidateSetup } from './match-validate-setup-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  match: { findUnique: ReturnType<typeof vi.fn> };
  teamSelection: { findMany: ReturnType<typeof vi.fn> };
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
    body: { placedPlayers: [], playerPositions: [] },
    params: { id: 'm1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('S27.8.29 — match-validate-setup-handler exports', () => {
  it('exposes handleValidateSetup', () => {
    expect(typeof handleValidateSetup).toBe('function');
  });

  it('re-exports handleValidateSetup from match.ts (test-import compat)', async () => {
    const mod = await import('./match');
    expect(typeof mod.handleValidateSetup).toBe('function');
  });
});

describe('handleValidateSetup — defensive gates', () => {
  it('returns 404 when match not found', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleValidateSetup(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when match not in setup/active phase', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: 'm1',
      status: 'pending',
      turns: [],
    });
    const req = createReq();
    const res = createRes();
    await handleValidateSetup(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when user is not a player of the match', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: 'm1',
      status: 'prematch-setup',
      turns: [],
    });
    mockPrisma.teamSelection.findMany.mockResolvedValueOnce([
      { userId: 'other-user' },
    ]);
    const req = createReq();
    const res = createRes();
    await handleValidateSetup(req, res);
    expect(res.statusCode).toBe(403);
  });
});
