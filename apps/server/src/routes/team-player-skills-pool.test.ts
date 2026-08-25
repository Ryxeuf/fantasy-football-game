/**
 * Financement d'un avancement : pool de PSP de construction D'ABORD, SPP du
 * joueur ensuite.
 *
 * Avant, `PUT /team/:id/players/:playerId/skills` ne savait dépenser que les
 * SPP du joueur — nuls tant qu'il n'a pas joué. Une équipe libre dotée d'un
 * pool ne pouvait donc rien acheter après sa création.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn() },
    teamSelection: { findFirst: vi.fn() },
    skill: { findMany: vi.fn() },
    teamPlayer: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
}));

vi.mock('../services/team-lock-status', () => ({
  isTeamRosterFrozen: vi.fn(),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(),
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { prisma } from '../prisma';
import { isTeamRosterFrozen } from '../services/team-lock-status';
import { handleUpdatePlayerSkills } from './team-player-skills-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const p = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn> };
  teamSelection: { findFirst: ReturnType<typeof vi.fn> };
  skill: { findMany: ReturnType<typeof vi.fn> };
  teamPlayer: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
};
const frozen = isTeamRosterFrozen as unknown as ReturnType<typeof vi.fn>;

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

function createReq(body: Record<string, unknown>): AuthenticatedRequest {
  return {
    body,
    params: { id: 'team-1', playerId: 'p-1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
  } as unknown as AuthenticatedRequest;
}

function team(overrides: Record<string, unknown> = {}) {
  return {
    id: 'team-1',
    roster: 'human',
    ruleset: 'season_3',
    startingPspPool: 20,
    tournamentRuleset: null,
    players: [
      {
        id: 'p-1',
        position: 'human_lineman',
        skills: '',
        dead: false,
        advancements: '[]',
        spp: 0,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  frozen.mockResolvedValue(false);
  p.teamSelection.findFirst.mockResolvedValue(null);
  p.skill.findMany.mockResolvedValue([]);
  p.teamPlayer.findMany.mockResolvedValue([{ advancements: '[]' }]);
  p.teamPlayer.update.mockResolvedValue({});
  p.teamPlayer.findUnique.mockResolvedValue({ id: 'p-1' });
});

describe('financement pool-first', () => {
  it('puise dans le pool et laisse les SPP du joueur intacts', async () => {
    p.team.findFirst.mockResolvedValue(team());

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ skillSlug: 'block', advancementType: 'primary' }),
      res,
    );

    expect(res.payload?.data?.fundedBy).toBe('pool');
    const data = p.teamPlayer.update.mock.calls[0][0].data;
    // Aucun decrement de SPP : c'est le pool qui paie.
    expect(data.spp).toBeUndefined();
    const [adv] = JSON.parse(data.advancements);
    expect(adv).toMatchObject({
      skillSlug: 'block',
      pspCost: 6,
      fundedBy: 'pool',
    });
  });

  it('retombe sur les SPP du joueur quand le pool est épuisé', async () => {
    p.team.findFirst.mockResolvedValue(
      team({
        players: [
          {
            id: 'p-1',
            position: 'human_lineman',
            skills: '',
            dead: false,
            advancements: '[]',
            spp: 12,
            ma: 6,
            st: 3,
            ag: 3,
            pa: 4,
            av: 9,
          },
        ],
        startingPspPool: 6,
      }),
    );
    // 6 PSP du pool déjà consommés par un autre joueur.
    p.teamPlayer.findMany.mockResolvedValue([
      {
        advancements: JSON.stringify([
          { type: 'primary', pspCost: 6, fundedBy: 'pool' },
        ]),
      },
    ]);

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ skillSlug: 'block', advancementType: 'primary' }),
      res,
    );

    expect(res.payload?.data?.fundedBy).toBe('player');
    expect(p.teamPlayer.update.mock.calls[0][0].data.spp).toEqual({
      decrement: 6,
    });
  });

  it('ignore le pool quand l’équipe est engagée (roster figé)', async () => {
    frozen.mockResolvedValue(true);
    p.team.findFirst.mockResolvedValue(
      team({
        players: [
          {
            id: 'p-1',
            position: 'human_lineman',
            skills: '',
            dead: false,
            advancements: '[]',
            spp: 6,
            ma: 6,
            st: 3,
            ag: 3,
            pa: 4,
            av: 9,
          },
        ],
      }),
    );

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ skillSlug: 'block', advancementType: 'primary' }),
      res,
    );

    expect(res.payload?.data?.fundedBy).toBe('player');
    expect(p.teamPlayer.update.mock.calls[0][0].data.spp).toEqual({
      decrement: 6,
    });
  });

  it('refuse quand ni le pool ni les SPP ne couvrent le coût', async () => {
    p.team.findFirst.mockResolvedValue(team({ startingPspPool: 0 }));

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ skillSlug: 'block', advancementType: 'primary' }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toMatch(/PSP insuffisants/);
    expect(p.teamPlayer.update).not.toHaveBeenCalled();
  });

  it('applique le barème du règlement de tournoi sur un achat au pool', async () => {
    p.team.findFirst.mockResolvedValue(
      team({ tournamentRuleset: 'naf_world_cup_2027', startingPspPool: 60 }),
    );
    p.teamPlayer.findMany.mockResolvedValue([{ id: 'p-1', advancements: '[]' }]);

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ skillSlug: 'block', advancementType: 'primary' }),
      res,
    );

    const { tournamentSkillCost, getTournamentRuleset } = await import(
      '@bb/game-engine'
    );
    const pack = getTournamentRuleset('naf_world_cup_2027')!;
    expect(res.payload?.data?.sppSpent).toBe(
      tournamentSkillCost(pack, 0, 'primary', 'block'),
    );
  });

  it('applique les restrictions du règlement (caractéristique interdite)', async () => {
    p.team.findFirst.mockResolvedValue(
      team({
        tournamentRuleset: 'naf_world_cup_2027',
        startingPspPool: 60,
        players: [
          {
            id: 'p-1',
            position: 'human_lineman',
            skills: '',
            dead: false,
            advancements: '[]',
            spp: 0,
            ma: 6,
            st: 3,
            ag: 3,
            pa: 4,
            av: 9,
          },
        ],
      }),
    );
    p.teamPlayer.findMany.mockResolvedValue([{ id: 'p-1', advancements: '[]' }]);

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ advancementType: 'characteristic', stat: 'ma', d8: 8 }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect(res.payload?.error).toMatch(/règlement|compétences au choix/i);
    expect(p.teamPlayer.update).not.toHaveBeenCalled();
  });
});
