/**
 * Choix de la Ligue régionale à la création via `handleBuildTeam`.
 *
 * Une équipe appartient à UNE Ligue, choisie en construisant sa Liste
 * d'Équipe : c'est elle qui débloque Star Players et Coups de Pouce. Les
 * rosters à plusieurs Ligues (Nordiques, Nains, Gobelins, Ogres…) doivent
 * trancher ; les rosters mono-ligue se la voient attribuer d'office.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const LINEMAN = {
  slug: 'lineman',
  displayName: 'Trois-quart',
  cost: 50,
  min: 0,
  max: 16,
  ma: 6,
  st: 3,
  ag: 3,
  pa: 4,
  av: 9,
  skills: '',
};

const teamCreate = vi.fn(async () => ({ id: 'team-1' }));

vi.mock('../utils/roster-helpers', () => ({
  getRosterFromDb: vi.fn(async () => ({ positions: [LINEMAN], tier: 'I', budget: 1000 })),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(async () => {}),
}));

vi.mock('../services/team-budget-summary', () => ({
  creditInitialTreasury: vi.fn(async () => 0),
}));

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
        format: 'bb11',
        players: [],
        starPlayers: [],
      })),
    },
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: Partial<Response> & { statusCode?: number; payload?: any } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((payload: unknown) => {
    res.payload = payload;
    return res as Response;
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res as Response & { statusCode?: number; payload?: any };
}

function buildReq(body: Record<string, unknown>): AuthenticatedRequest {
  return {
    body: {
      name: 'Test',
      teamValue: 1000,
      choices: [{ key: 'lineman', count: 11 }],
      ...body,
    },
    params: {},
    query: {},
    user: { id: 'user-1', roles: ['user'] },
  } as AuthenticatedRequest;
}

/** Données passées à `team.create` lors du dernier build réussi. */
function createdTeamData(): Record<string, unknown> {
  return (teamCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> })
    .data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleBuildTeam — Ligue régionale', () => {
  it('refuse (422) un roster multi-ligues sans choix', async () => {
    const res = createRes();
    await handleBuildTeam(buildReq({ roster: 'norse' }), res);

    expect(res.statusCode).toBe(422);
    expect(String(res.payload?.error)).toMatch(/Ligue régionale/i);
    expect(String(res.payload?.error)).toContain('Clash du Chaos');
    expect(teamCreate).not.toHaveBeenCalled();
  });

  it('enregistre la Ligue choisie', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq({ roster: 'norse', regionalLeague: 'chaos_clash' }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(createdTeamData().regionalLeague).toBe('chaos_clash');
  });

  it('refuse (422) une Ligue étrangère au roster', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq({ roster: 'norse', regionalLeague: 'lustrian_superleague' }),
      res,
    );

    expect(res.statusCode).toBe(422);
    expect(teamCreate).not.toHaveBeenCalled();
  });

  it('attribue d’office la Ligue unique d’un roster mono-ligue', async () => {
    const res = createRes();
    await handleBuildTeam(buildReq({ roster: 'orc' }), res);

    expect(res.statusCode).toBe(201);
    expect(createdTeamData().regionalLeague).toBe('badlands_brawl');
  });
});
