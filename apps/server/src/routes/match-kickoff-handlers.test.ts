/**
 * S27.8.21 — Smoke tests pour les 3 handlers de la sequence de kickoff
 * extraits depuis `routes/match.ts` vers `routes/match-kickoff-handlers.ts`.
 *
 * Garantit :
 *  - les 3 handlers sont exportes depuis le nouveau module
 *  - les 3 handlers sont re-exportes depuis `match.ts` (compat tests
 *    d'integration)
 *  - les gates de defense (`match introuvable`, `phase incorrecte`)
 *    repondent avec les bons codes HTTP (404 / 400)
 *
 * Pas de test de comportement metier ici : on s'appuie sur les tests
 * end-to-end existants pour cela. C'est une extraction structurelle
 * pure.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    match: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    turn: {
      create: vi.fn(),
    },
    teamSelection: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../services/ai-loop', () => ({
  scheduleAILoop: vi.fn(),
}));

vi.mock('../services/game-broadcast', () => ({
  broadcastGameState: vi.fn(),
}));

import { prisma } from '../prisma';
import {
  handlePlaceKickoffBall,
  handleCalculateKickDeviation,
  handleResolveKickoffEvent,
} from './match-kickoff-handlers';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  match: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  turn: { create: ReturnType<typeof vi.fn> };
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

describe('S27.8.21 — match-kickoff-handlers exports', () => {
  it('exposes the 3 named handlers', () => {
    expect(typeof handlePlaceKickoffBall).toBe('function');
    expect(typeof handleCalculateKickDeviation).toBe('function');
    expect(typeof handleResolveKickoffEvent).toBe('function');
  });

  it('re-exports the 3 handlers from match.ts (test-import compat)', async () => {
    const mod = await import('./match');
    expect(typeof mod.handlePlaceKickoffBall).toBe('function');
    expect(typeof mod.handleCalculateKickDeviation).toBe('function');
    expect(typeof mod.handleResolveKickoffEvent).toBe('function');
  });
});

describe('handlePlaceKickoffBall — defensive gates', () => {
  it('returns 404 when the match does not exist', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce(null);
    const req = createReq({
      params: { id: 'unknown' },
      body: { position: { x: 13, y: 7 } },
    });
    const res = createRes();
    await handlePlaceKickoffBall(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when the match is not in kickoff-sequence phase', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: 'm1',
      status: 'active',
      turns: [
        {
          id: 't1',
          number: 1,
          payload: {
            type: 'validate-setup',
            gameState: {
              preMatch: { phase: 'setup' },
            },
          },
        },
      ],
    });
    const req = createReq({ body: { position: { x: 13, y: 7 } } });
    const res = createRes();
    await handlePlaceKickoffBall(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('handleCalculateKickDeviation — defensive gates', () => {
  it('returns 404 when the match does not exist', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce(null);
    const req = createReq({ params: { id: 'unknown' } });
    const res = createRes();
    await handleCalculateKickDeviation(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when not in kick-deviation step', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: 'm1',
      seed: 'seed-1',
      status: 'active',
      turns: [
        {
          id: 't1',
          number: 1,
          payload: {
            gameState: {
              preMatch: {
                phase: 'kickoff-sequence',
                kickoffStep: 'place-ball',
              },
            },
          },
        },
      ],
    });
    const req = createReq();
    const res = createRes();
    await handleCalculateKickDeviation(req, res);
    expect(res.statusCode).toBe(400);
  });
});

describe('handleResolveKickoffEvent — defensive gates', () => {
  it('returns 404 when the match does not exist', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce(null);
    const req = createReq({ params: { id: 'unknown' } });
    const res = createRes();
    await handleResolveKickoffEvent(req, res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when not in kickoff-event step', async () => {
    mockPrisma.match.findUnique.mockResolvedValueOnce({
      id: 'm1',
      seed: 'seed-1',
      status: 'active',
      turns: [
        {
          id: 't1',
          number: 1,
          payload: {
            gameState: {
              preMatch: {
                phase: 'kickoff-sequence',
                kickoffStep: 'kick-deviation',
              },
            },
          },
        },
      ],
    });
    const req = createReq();
    const res = createRes();
    await handleResolveKickoffEvent(req, res);
    expect(res.statusCode).toBe(400);
  });
});
