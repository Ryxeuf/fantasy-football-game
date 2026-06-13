/**
 * S27.8.33 — Smoke tests pour `handleCreateFromRoster` extrait
 * depuis l'inline anonyme `POST /create-from-roster` dans
 * `routes/team.ts` (final extraction pour ramener team.ts sous DoD
 * secondaire 400).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const createManySpy = vi.fn();
const txCreateSpy = vi.fn(async () => ({ id: 'team-1' }));

vi.mock('../prisma', () => ({
  prisma: {
    team: { create: vi.fn(), findUnique: vi.fn() },
    teamPlayer: { createMany: vi.fn() },
    teamStarPlayer: { createMany: vi.fn() },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: vi.fn(async (cb: any) =>
      cb({
        team: { create: txCreateSpy },
        teamPlayer: { createMany: createManySpy },
        teamStarPlayer: { createMany: vi.fn() },
      }),
    ),
  },
}));

// Derive le lineup d'un roster non templated depuis la "DB".
vi.mock('../utils/roster-helpers', () => ({
  getRosterFromDb: vi.fn(async () => ({
    name: 'Orcs',
    budget: 1000,
    tier: '1',
    naf: true,
    positions: [
      { slug: 'orc_lineman', displayName: 'Orc Lineman', cost: 50, min: 0, max: 16, ma: 5, st: 3, ag: 3, pa: 4, av: 10, skills: '' },
      { slug: 'orc_blitzer', displayName: 'Orc Blitzer', cost: 80, min: 0, max: 4, ma: 6, st: 3, ag: 3, pa: 4, av: 10, skills: 'block' },
    ],
  })),
}));

// Neutralise le recalcul de VE (I/O Prisma supplementaire).
vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(async () => ({ teamValue: 0, currentValue: 0 })),
}));

import { handleCreateFromRoster } from './team-create-from-roster-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';
import { prisma } from '../prisma';

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

describe('handleCreateFromRoster — DB-derived lineup', () => {
  it('builds players from the real roster positions (no lizardmen fallback)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.team.findUnique as any).mockResolvedValue({
      id: 'team-1',
      ruleset: 'season_3',
      players: [],
      starPlayers: [],
    });

    const req = createReq({ body: { name: 'Da Boyz', roster: 'orc' } });
    const res = createRes();
    await handleCreateFromRoster(req, res);

    expect(res.statusCode).toBe(201);
    expect(createManySpy).toHaveBeenCalledTimes(1);
    const rows = createManySpy.mock.calls[0][0].data as Array<{
      position: string;
    }>;
    // 11 joueurs, tous avec des slugs de position du roster orc.
    expect(rows).toHaveLength(11);
    expect(rows.every((r) => r.position.startsWith('orc_'))).toBe(true);
    // Aucune position lizardmen ne doit fuiter (bug historique).
    expect(rows.some((r) => r.position.startsWith('lizardmen_'))).toBe(false);
  });
});
