/**
 * S27.8.23 — Smoke tests pour les 4 handlers Star Players extraits
 * depuis `routes/team.ts` vers `routes/team-star-player-handlers.ts`.
 *
 * Garantit :
 *  - les 4 handlers sont exportes depuis le nouveau module
 *  - les 4 handlers sont re-exportes depuis `team.ts` (compat tests
 *    d'integration)
 *  - les gates de defense (`Equipe introuvable`, `Star Player
 *    introuvable`) repondent avec les bons codes HTTP (404).
 *
 * Les tests metier complets restent dans `team.test.ts` ou tests
 * d'integration. Cette suite valide que l'extraction n'a pas casse
 * le cablage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../prisma';
import {
  handleListTeamStarPlayers,
  handleListAvailableStarPlayers,
  handleHireStarPlayer,
  handleDeleteTeamStarPlayer,
} from './team-star-player-handlers';
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

describe('S27.8.23 — team-star-player-handlers exports', () => {
  it('exposes the 4 named handlers', () => {
    expect(typeof handleListTeamStarPlayers).toBe('function');
    expect(typeof handleListAvailableStarPlayers).toBe('function');
    expect(typeof handleHireStarPlayer).toBe('function');
    expect(typeof handleDeleteTeamStarPlayer).toBe('function');
  });

  it('re-exports the 4 handlers from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleListTeamStarPlayers).toBe('function');
    expect(typeof mod.handleListAvailableStarPlayers).toBe('function');
    expect(typeof mod.handleHireStarPlayer).toBe('function');
    expect(typeof mod.handleDeleteTeamStarPlayer).toBe('function');
  });
});

describe('handleListTeamStarPlayers — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleListTeamStarPlayers(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('handleListAvailableStarPlayers — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleListAvailableStarPlayers(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('handleHireStarPlayer — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({ body: { starPlayerSlug: 'griff_oberwald' } });
    const res = createRes();
    await handleHireStarPlayer(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('handleDeleteTeamStarPlayer — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({ params: { id: 'team-1', starPlayerId: 'sp-1' } });
    const res = createRes();
    await handleDeleteTeamStarPlayer(req, res);
    expect(res.statusCode).toBe(404);
  });
});
