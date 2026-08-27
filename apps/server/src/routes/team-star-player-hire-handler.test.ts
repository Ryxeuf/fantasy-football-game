/**
 * S27.8.31 — Smoke tests pour `handleHireStarPlayer` extrait depuis
 * `team-star-player-handlers.ts` vers `team-star-player-hire-handler.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn(), findUnique: vi.fn() },
    teamSelection: { findFirst: vi.fn() },
    teamStarPlayer: { create: vi.fn() },
    starPlayer: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(),
  // Budget disponible coté au tarif BASE (`Position.cost`) : le mock doit
  // déclarer TOUTES les méthodes utilisées (cf. CLAUDE.md).
  sumPlayerCostsForTeam: vi.fn().mockResolvedValue(0),
}));

import { prisma } from '../prisma';
import { handleHireStarPlayer } from './team-star-player-hire-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  team: {
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  teamSelection: { findFirst: ReturnType<typeof vi.fn> };
  starPlayer: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// Griff Oberwald tel que remonté par Prisma avec les includes skills/hirableBy
// (mêmes valeurs que packages/game-engine/src/rosters/star-players.ts).
function makeGriffOberwaldRow(ruleset = 'season_3') {
  return {
    id: 'sp-griff', slug: 'griff_oberwald', ruleset, displayName: 'Griff Oberwald',
    cost: 280000, ma: 7, st: 4, ag: 2, pa: 3, av: 9,
    specialRule: 'Consummate Professional', imageUrl: null, isMegaStar: true, keywords: null,
    skills: [{ skill: { slug: 'block' } }, { skill: { slug: 'dodge' } }],
    hirableBy: [{ rule: 'old_world_classic', roster: null }],
  };
}

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

describe('handleHireStarPlayer — happy path (DB-backed star player)', () => {
  it('recrute un Star Player et renvoie ses données catalogue (regression spread-de-Promise)', async () => {
    const team = {
      id: 'team-1',
      ownerId: 'user-1',
      roster: 'human',
      ruleset: 'season_3',
      initialBudget: 1000,
      players: [],
      starPlayers: [],
    };
    mockPrisma.team.findFirst.mockResolvedValueOnce(team);
    mockPrisma.teamSelection.findFirst.mockResolvedValueOnce(null);
    mockPrisma.starPlayer.findUnique.mockResolvedValue(makeGriffOberwaldRow());
    mockPrisma.starPlayer.findMany.mockResolvedValueOnce([makeGriffOberwaldRow()]);
    mockPrisma.$transaction.mockResolvedValueOnce([
      { id: 'tsp-1', teamId: 'team-1', starPlayerSlug: 'griff_oberwald', cost: 280000, hiredAt: new Date('2026-01-01') },
    ]);
    mockPrisma.team.findUnique.mockResolvedValueOnce({ ...team, starPlayers: [{ id: 'tsp-1', starPlayerSlug: 'griff_oberwald', cost: 280000 }] });

    const req = createReq();
    const res = createRes();
    await handleHireStarPlayer(req, res);

    expect(res.statusCode).toBe(201);
    const payload = res.payload as { data: { newStarPlayers: Array<{ displayName?: string; cost?: number }> } };
    // Aurait attrapé le bug de spread silencieux (Promise non-awaitée) :
    // sans `await`, seuls id/slug/cost/hiredAt seraient présents.
    expect(payload.data.newStarPlayers[0]?.displayName).toBe('Griff Oberwald');
    expect(payload.data.newStarPlayers[0]?.cost).toBe(280000);
  });
});
