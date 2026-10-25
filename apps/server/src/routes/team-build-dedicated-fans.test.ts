/**
 * Fans Dévoués à la construction : le premier fan gratuit est une règle de
 * LIGUE (accordé à l'inscription, cf. services/league-free-fan). Le builder
 * part donc de 0 fan, facture CHAQUE fan et pose `leagueFreeFan: false`.
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
    // resolveStaffConfigBySlug : fallback defaultStaffConfig(slug, format).
    roster: { findUnique: vi.fn() },
    rosterStaffConfig: { findUnique: vi.fn() },
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

describe('handleBuildTeam — Fans Dévoués sans fan offert', () => {
  it('part de 0 fan et pose leagueFreeFan: false', async () => {
    const res = createRes();
    await handleBuildTeam(buildReq({ choices: choices({ human_lineman: 11 }) }), res);
    expect(res.statusCode).toBe(201);
    const data = teamCreate.mock.calls[0][0] as {
      data: { dedicatedFans: number; leagueFreeFan: boolean | null };
    };
    expect(data.data.dedicatedFans).toBe(0);
    expect(data.data.leagueFreeFan).toBe(false);
  });

  it('accepte 0 fan demandé explicitement', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq({ choices: choices({ human_lineman: 11 }), dedicatedFans: 0 }),
      res,
    );
    expect(res.statusCode).toBe(201);
  });

  it('facture chaque fan, y compris le premier (5 000 po en BB11)', async () => {
    // 11 Trois-quarts à 50k = 550k : un budget de 555k paie UN fan…
    const ok = createRes();
    await handleBuildTeam(
      buildReq({ choices: choices({ human_lineman: 11 }), teamValue: 555, dedicatedFans: 1 }),
      ok,
    );
    expect(ok.statusCode).toBe(201);

    // … mais pas deux (l'ancienne règle n'en facturait qu'un).
    const over = createRes();
    await handleBuildTeam(
      buildReq({ choices: choices({ human_lineman: 11 }), teamValue: 555, dedicatedFans: 2 }),
      over,
    );
    expect(over.statusCode).toBe(400);
    expect(String(over.payload?.error)).toContain('Budget depasse');
    expect(String(over.payload?.error)).toContain('10k staff');
  });
});
