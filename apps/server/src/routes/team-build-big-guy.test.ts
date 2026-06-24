/**
 * A36 — Tests du plafond COMBINÉ de Gros Bras au niveau du handler
 * `handleBuildTeam`. Le plafond est une règle distincte des `max` par poste :
 * il limite le nombre TOTAL de Gros Bras (tous types) qu'une équipe peut
 * aligner.
 *
 * Plafonds testés :
 *  - chaos_renegade : 3 (4 postes Gros Bras `max:1` disponibles → on peut
 *    en aligner au plus 3)
 *  - old_world_alliance : 1
 *  - ogre : pas de plafond combiné (non-régression)
 *
 * Les chemins de rejet (422) sont purs : ils n'atteignent pas la DB.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

// Rosters factices, un par scénario. Chaque poste Gros Bras porte `loner-*`
// pour être détecté par `isBigGuy`.
const ROSTERS: Record<string, { positions: Array<Record<string, unknown>> }> = {
  // Renégats du Chaos : plafond combiné 3, 4 postes Gros Bras max:1.
  chaos_renegade: {
    positions: [
      { slug: 'cr_lineman', displayName: 'Renégat', cost: 50, min: 0, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 9, skills: 'animosity' },
      { slug: 'cr_troll', displayName: 'Troll', cost: 115, min: 0, max: 1, ma: 4, st: 5, ag: 5, pa: 5, av: 10, skills: 'mighty-blow-1,really-stupid,loner-4' },
      { slug: 'cr_ogre', displayName: 'Ogre', cost: 140, min: 0, max: 1, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: 'bone-head,mighty-blow-1,loner-3' },
      { slug: 'cr_mino', displayName: 'Minotaure', cost: 150, min: 0, max: 1, ma: 5, st: 5, ag: 4, pa: 6, av: 9, skills: 'mighty-blow-1,horns,wild-animal,loner-4' },
      { slug: 'cr_ratogre', displayName: 'Rat Ogre', cost: 150, min: 0, max: 1, ma: 6, st: 5, ag: 4, pa: 6, av: 9, skills: 'mighty-blow-1,frenzy,animal-savagery,loner-4' },
    ],
  },
  // Alliance du Vieux Monde : plafond combiné 1, 2 postes Gros Bras max:1.
  old_world_alliance: {
    positions: [
      { slug: 'owa_lineman', displayName: 'Trois-quart', cost: 50, min: 0, max: 16, ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: '' },
      { slug: 'owa_treeman', displayName: 'Homme-arbre', cost: 120, min: 0, max: 1, ma: 2, st: 6, ag: 5, pa: 5, av: 11, skills: 'mighty-blow-1,stand-firm,loner-4,throw-team-mate' },
      { slug: 'owa_ogre', displayName: 'Ogre', cost: 140, min: 0, max: 1, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: 'bone-head,mighty-blow-1,loner-4,throw-team-mate' },
    ],
  },
  // Ogres : PAS de plafond combiné (s'appuie sur les max par poste).
  ogre: {
    positions: [
      { slug: 'ogre_snotling', displayName: 'Snotling', cost: 15, min: 0, max: 16, ma: 5, st: 1, ag: 3, pa: 5, av: 5, skills: 'dodge,right-stuff,side-step,stunty,titchy' },
      { slug: 'ogre_runt', displayName: 'Ogre', cost: 140, min: 0, max: 6, ma: 5, st: 5, ag: 4, pa: 5, av: 10, skills: 'bone-head,mighty-blow-1,thick-skull,throw-team-mate,loner-4' },
    ],
  },
};

const teamCreate = vi.fn(async () => ({ id: 'team-1' }));

vi.mock('../utils/roster-helpers', () => ({
  getRosterFromDb: vi.fn(async (roster: string) => ROSTERS[roster] ?? null),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(async () => {}),
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

function buildReq(roster: string, body: Record<string, unknown>): AuthenticatedRequest {
  return {
    body: { name: 'Test', roster, teamValue: 2000, ...body },
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

describe('A36 — plafond combiné de Gros Bras', () => {
  it('chaos_renegade : refuse 4 Gros Bras (plafond 3) avec 422', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq('chaos_renegade', {
        choices: choices({
          cr_lineman: 8,
          cr_troll: 1,
          cr_ogre: 1,
          cr_mino: 1,
          cr_ratogre: 1,
        }),
      }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(String(res.payload?.error)).toContain('3 Gros Bras');
    expect(teamCreate).not.toHaveBeenCalled();
  });

  it('chaos_renegade : accepte exactement 3 Gros Bras (au plafond)', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq('chaos_renegade', {
        choices: choices({
          cr_lineman: 8,
          cr_troll: 1,
          cr_ogre: 1,
          cr_mino: 1,
        }),
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(teamCreate).toHaveBeenCalledTimes(1);
  });

  it('old_world_alliance : refuse 2 Gros Bras (plafond 1) avec 422', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq('old_world_alliance', {
        choices: choices({ owa_lineman: 9, owa_treeman: 1, owa_ogre: 1 }),
      }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(String(res.payload?.error)).toContain('1 Gros Bras');
    expect(teamCreate).not.toHaveBeenCalled();
  });

  it('old_world_alliance : accepte 1 Gros Bras (au plafond)', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq('old_world_alliance', {
        choices: choices({ owa_lineman: 10, owa_treeman: 1 }),
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(teamCreate).toHaveBeenCalledTimes(1);
  });

  it('ogre : pas de plafond combiné — 6 Gros Bras (dans les max par poste) reste accepté', async () => {
    const res = createRes();
    await handleBuildTeam(
      buildReq('ogre', {
        choices: choices({ ogre_snotling: 5, ogre_runt: 6 }),
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(teamCreate).toHaveBeenCalledTimes(1);
  });
});
