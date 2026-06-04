/**
 * Tests de validation du FORMAT (BB11 / Blood Bowl à Sept) au niveau du
 * handler `handleBuildTeam`. Les chemins de rejet (400) sont purs : ils ne
 * touchent pas la DB. Un cas valide vérifie que la sélection Sevens franchit
 * la barrière de format et persiste `format: "sevens"`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const fakeRoster = {
  positions: [
    { slug: 'human_lineman', displayName: 'Lineman', cost: 50, min: 0, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
    { slug: 'human_blitzer', displayName: 'Blitzer', cost: 90, min: 0, max: 4, ma: 7, st: 3, ag: 3, pa: 4, av: 9, skills: 'block' },
    { slug: 'human_ogre', displayName: 'Ogre', cost: 140, min: 0, max: 1, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: 'loner-4,bone-head,mighty-blow-1' },
  ],
};

const createdTeam = { id: 'team-1' };

vi.mock('../utils/roster-helpers', () => ({
  getRosterFromDb: vi.fn(async () => fakeRoster),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(async () => {}),
}));

const teamCreate = vi.fn(async () => createdTeam);

vi.mock('../prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        team: { create: teamCreate },
        teamPlayer: { createMany: vi.fn(async () => {}) },
        teamStarPlayer: { createMany: vi.fn(async () => {}) },
      }),
    ),
    team: {
      findUnique: vi.fn(async () => ({
        id: 'team-1',
        ruleset: 'season_3',
        format: 'sevens',
        players: [],
        starPlayers: [],
      })),
    },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { handleBuildTeam } from './team-build-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: any } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((payload: unknown) => {
    res.payload = payload;
    return res as Response;
  });
  return res as Response & { statusCode?: number; payload?: any };
}

function buildReq(body: Record<string, unknown>): AuthenticatedRequest {
  return {
    body: { name: 'Test', roster: 'human', ...body },
    params: {},
    query: {},
    user: { id: 'user-1', roles: ['user'] },
  } as AuthenticatedRequest;
}

const choices = (map: Record<string, number>) =>
  Object.entries(map).map(([key, count]) => ({ key, count }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleBuildTeam — contraintes format Sevens', () => {
  it('refuse moins de 7 joueurs', async () => {
    const res = createRes();
    await handleBuildTeam(buildReq({ format: 'sevens', choices: choices({ human_lineman: 6 }) }), res);
    expect(res.statusCode).toBe(400);
    expect(String(res.payload?.error)).toContain('7');
  });

  it('refuse plus de 11 joueurs', async () => {
    const res = createRes();
    await handleBuildTeam(buildReq({ format: 'sevens', choices: choices({ human_lineman: 12 }) }), res);
    expect(res.statusCode).toBe(400);
    expect(String(res.payload?.error)).toContain('11');
  });

  it('refuse plus de 4 joueurs non-Linemen', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq({ format: 'sevens', choices: choices({ human_lineman: 4, human_blitzer: 4, human_ogre: 1 }) }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(String(res.payload?.error).toLowerCase()).toContain('non-linemen');
  });

  it('refuse les Star Players en Sevens', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq({ format: 'sevens', choices: choices({ human_lineman: 7 }), starPlayers: ['griff_oberwald'] }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(String(res.payload?.error)).toContain('Star Players');
  });

  it('accepte une équipe Sevens valide (7 joueurs, budget 600k) et persiste format', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq({ format: 'sevens', choices: choices({ human_lineman: 5, human_blitzer: 2 }) }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(teamCreate).toHaveBeenCalledTimes(1);
    const data = teamCreate.mock.calls[0][0] as { data: { format: string; teamValue: number } };
    expect(data.data.format).toBe('sevens');
    // Budget par défaut Sevens = 600k
    expect(data.data.teamValue).toBe(600);
  });
});

describe('handleBuildTeam — BB11 non-régression', () => {
  it('refuse moins de 11 joueurs en BB11', async () => {
    const res = createRes();
    await handleBuildTeam(buildReq({ format: 'bb11', choices: choices({ human_lineman: 10 }) }), res);
    expect(res.statusCode).toBe(400);
    expect(String(res.payload?.error)).toContain('11');
  });

  it('accepte 11 joueurs avec budget par défaut 1000k', async () => {
    const res = createRes();
    await handleBuildTeam(buildReq({ choices: choices({ human_lineman: 11 }) }), res);
    expect(res.statusCode).toBe(201);
    const data = teamCreate.mock.calls[0][0] as { data: { format: string; teamValue: number } };
    expect(data.data.format).toBe('bb11');
    expect(data.data.teamValue).toBe(1000);
  });
});
