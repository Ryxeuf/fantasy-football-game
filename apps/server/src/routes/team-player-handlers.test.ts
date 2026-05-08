/**
 * S27.8.24 — Smoke tests pour les 4 handlers Player CRUD extraits
 * depuis `routes/team.ts` vers `routes/team-player-handlers.ts`.
 *
 * Garantit :
 *  - les 4 handlers sont exportes depuis le nouveau module
 *  - les 4 handlers sont re-exportes depuis `team.ts` (compat tests
 *    d'integration existants dans `team.test.ts`)
 *  - les gates de defense (`Equipe introuvable`, `Joueur introuvable`,
 *    body manquant) repondent avec les bons codes HTTP.
 *
 * Les tests metier complets restent dans `team.test.ts` ou tests
 * d'integration. Ici on ne fait que verifier que l'extraction n'a
 * pas casse le cablage.
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
  handleAddTeamPlayer,
  handleDeleteTeamPlayer,
  handleUpdatePlayerSkills,
  handleListAvailablePositions,
} from './team-player-handlers';
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

describe('S27.8.24 — team-player-handlers exports', () => {
  it('exposes the 4 named handlers', () => {
    expect(typeof handleAddTeamPlayer).toBe('function');
    expect(typeof handleDeleteTeamPlayer).toBe('function');
    expect(typeof handleUpdatePlayerSkills).toBe('function');
    expect(typeof handleListAvailablePositions).toBe('function');
  });

  it('re-exports the 4 handlers from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleAddTeamPlayer).toBe('function');
    expect(typeof mod.handleDeleteTeamPlayer).toBe('function');
    expect(typeof mod.handleUpdatePlayerSkills).toBe('function');
    expect(typeof mod.handleListAvailablePositions).toBe('function');
  });
});

describe('handleAddTeamPlayer — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({
      body: { position: 'skaven_blitzer', name: 'Test', number: 1 },
    });
    const res = createRes();
    await handleAddTeamPlayer(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('handleDeleteTeamPlayer — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({
      params: { id: 'team-1', playerId: 'p-1' },
    });
    const res = createRes();
    await handleDeleteTeamPlayer(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('handleUpdatePlayerSkills — defensive gates', () => {
  it('returns 400 when skillSlug missing on chosen advancement', async () => {
    const req = createReq({
      params: { id: 'team-1', playerId: 'p-1' },
      body: { advancementType: 'primary' },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when skillCategory missing on random advancement', async () => {
    const req = createReq({
      params: { id: 'team-1', playerId: 'p-1' },
      body: { advancementType: 'random-primary' },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('handleListAvailablePositions — defensive gates', () => {
  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq();
    const res = createRes();
    await handleListAvailablePositions(req, res);
    expect(res.statusCode).toBe(404);
  });
});
