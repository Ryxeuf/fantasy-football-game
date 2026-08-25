/**
 * Règlement de tournoi (NAF World Cup 2027) au build (`POST /team/build`) :
 * budget d'or + pool de SPP imposés par le tier du roster, restrictions de
 * Star Players (autorisation par roster + bannis + taxe SPP), plan de
 * compétences (types autorisés + cumul), persistance du slug.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const txMock = {
  team: { create: vi.fn() },
  teamPlayer: { createMany: vi.fn() },
  teamStarPlayer: { createMany: vi.fn() },
};

vi.mock('../prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    team: { findUnique: vi.fn(), delete: vi.fn() },
    teamPlayer: { findMany: vi.fn() },
    cup: { findUnique: vi.fn() },
    cupParticipant: { create: vi.fn() },
    roster: { findUnique: vi.fn() },
    rosterStaffConfig: { findUnique: vi.fn() },
    starPlayer: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
    skill: { findMany: vi.fn() },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(),
}));

vi.mock('../utils/roster-helpers', () => ({
  getRosterFromDb: vi.fn(),
}));

vi.mock('../utils/star-player-validation', () => ({
  validateStarPlayerPairs: vi.fn(),
  validateStarPlayersForTeam: vi.fn(),
  calculateStarPlayersCost: vi.fn(),
}));

vi.mock('../utils/star-player-repository', () => ({
  getStarPlayerBySlugDb: vi.fn(),
}));

vi.mock('../services/cup-build-advancements', async () => {
  const actual = await vi.importActual<
    typeof import('../services/cup-build-advancements')
  >('../services/cup-build-advancements');
  return {
    ...actual,
    applyCupBuildAdvancements: vi.fn(),
  };
});

vi.mock('../services/cup-roster-snapshot', () => ({
  captureRosterSnapshot: vi.fn(),
}));

import { handleBuildTeam } from './team-build-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';
import { prisma } from '../prisma';
import { getRosterFromDb } from '../utils/roster-helpers';
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from '../utils/star-player-validation';
import { getStarPlayerBySlugDb } from '../utils/star-player-repository';
import { applyCupBuildAdvancements } from '../services/cup-build-advancements';

function createRes() {
  const res: Partial<Response> & { statusCode?: number; payload?: unknown } = {};
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

function createReq(body: Record<string, unknown>): AuthenticatedRequest {
  return {
    body,
    params: {},
    query: {},
    user: { id: 'user-1', roles: ['user'] },
  } as unknown as AuthenticatedRequest;
}

function errorOf(res: { payload?: unknown }): string {
  return (res.payload as { error?: string } | undefined)?.error ?? '';
}

/** Extrait le `data` de l'enveloppe ApiResponse (`{ success, data }`). */
function dataOf<T>(res: { payload?: unknown }): T {
  return (res.payload as { data: T }).data;
}

/** Roster minimal : un poste Lineman 0-16 à 50 kpo. */
function rosterDef(over: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'orc',
    tier: 'I',
    budget: 1000,
    positions: [
      {
        slug: 'lineman',
        displayName: 'Lineman',
        cost: 50,
        min: 0,
        max: 16,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: '',
      },
    ],
    ...over,
  };
}

const ELEVEN_LINEMEN = [{ key: 'lineman', count: 11 }];

beforeEach(() => {
  vi.resetAllMocks();
  // Staff config : resolveStaffConfigBySlug retombe sur le défaut dérivé des
  // constantes de format quand la DB ne connaît pas le roster.
  (prisma.roster.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (getRosterFromDb as ReturnType<typeof vi.fn>).mockResolvedValue(rosterDef());
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock),
  );
  txMock.team.create.mockImplementation(async ({ data }: { data: unknown }) => ({
    id: 'team-1',
    ...(data as Record<string, unknown>),
  }));
  txMock.teamPlayer.createMany.mockResolvedValue({ count: 11 });
  txMock.teamStarPlayer.createMany.mockResolvedValue({ count: 0 });
  (prisma.team.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'team-1',
    players: [],
    starPlayers: [],
  });
  (validateStarPlayerPairs as ReturnType<typeof vi.fn>).mockReturnValue({
    valid: true,
  });
  (validateStarPlayersForTeam as ReturnType<typeof vi.fn>).mockResolvedValue({
    valid: true,
  });
  (calculateStarPlayersCost as ReturnType<typeof vi.fn>).mockResolvedValue(0);
  (getStarPlayerBySlugDb as ReturnType<typeof vi.fn>).mockResolvedValue({
    cost: 0,
  });
  (applyCupBuildAdvancements as ReturnType<typeof vi.fn>).mockResolvedValue({
    poolSpent: 0,
    poolRemaining: 0,
    count: 0,
  });
});

describe('handleBuildTeam — règlement de tournoi : garde-fous', () => {
  it('refuse (400) un slug de règlement inconnu', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'ruleset_inconnu',
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/Règlement de tournoi inconnu/);
  });

  it("refuse (400) l'édition season_2 avec le NAF World Cup 2027", async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        ruleset: 'season_2',
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/requiert l'édition season_3/);
  });

  it('refuse (400) le format sevens avec le NAF World Cup 2027', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        format: 'sevens',
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/requiert le format bb11/);
  });
});

describe('handleBuildTeam — budget et pool imposés par le règlement', () => {
  it("impose le budget d'or du tier (teamValue client ignoré) et le pool de SPP", async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        teamValue: 2000,
        startingPspPool: 200,
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    const payload = dataOf<{ budget: number; startingPspPool: number }>(res);
    // Orc : tier 1 080 000 po / 44 SPP.
    expect(payload.budget).toBe(1080);
    expect(payload.startingPspPool).toBe(44);
    expect(txMock.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tournamentRuleset: 'naf_world_cup_2027',
          teamValue: 1080,
          initialBudget: 1080,
          startingPspPool: 44,
        }),
      }),
    );
  });

  it('sans règlement : budget par défaut du format et tournamentRuleset null', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({ name: 'T', roster: 'orc', choices: ELEVEN_LINEMEN }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(dataOf<{ budget: number }>(res).budget).toBe(1000);
    expect(txMock.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tournamentRuleset: null }),
      }),
    );
  });
});

describe('handleBuildTeam — Star Players sous règlement', () => {
  it("refuse (400) un Star Player pour un roster non marqué d'une étoile (orc)", async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        starPlayers: ['glart_smashrip'],
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/n'autorise pas les Star Players/);
  });

  it('refuse (400) un Star Player banni par le règlement (goblin + Morg)', async () => {
    (getRosterFromDb as ReturnType<typeof vi.fn>).mockResolvedValue(
      rosterDef({ slug: 'goblin' }),
    );
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'goblin',
        choices: ELEVEN_LINEMEN,
        starPlayers: ['morg_n_thorg'],
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/interdit\(s\) par le règlement/);
    expect(errorOf(res)).toMatch(/morg_n_thorg/);
  });

  it('déduit la taxe SPP du pool selon le coût cumulé des stars', async () => {
    (getRosterFromDb as ReturnType<typeof vi.fn>).mockResolvedValue(
      rosterDef({ slug: 'goblin' }),
    );
    // 2 stars à 150 kpo → 300 kpo cumulés → taxe 32 SPP.
    (calculateStarPlayersCost as ReturnType<typeof vi.fn>).mockResolvedValue(
      300_000,
    );
    (getStarPlayerBySlugDb as ReturnType<typeof vi.fn>).mockResolvedValue({
      cost: 150_000,
    });
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'goblin',
        // Les Gobelins ont deux Ligues possibles : le choix est obligatoire.
        regionalLeague: 'badlands_brawl',
        choices: ELEVEN_LINEMEN,
        starPlayers: ['fungus_the_loon', 'scrappa_sorehead'],
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    // Goblin : 60 SPP − 32 de taxe = 28.
    expect(dataOf<{ startingPspPool: number }>(res).startingPspPool).toBe(28);
  });

  it('applique la première tranche de taxe (18 SPP) pour un star bon marché', async () => {
    // NB : avec le NAF WC 2027 la taxe (max 32) ne peut jamais dépasser le
    // pool du tier (min 44) — la branche « taxe > pool » du handler reste
    // purement défensive pour de futurs packs.
    (getRosterFromDb as ReturnType<typeof vi.fn>).mockResolvedValue(
      rosterDef({ slug: 'goblin' }),
    );
    (calculateStarPlayersCost as ReturnType<typeof vi.fn>).mockResolvedValue(
      100_000,
    );
    (getStarPlayerBySlugDb as ReturnType<typeof vi.fn>).mockResolvedValue({
      cost: 100_000,
    });
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'goblin',
        regionalLeague: 'badlands_brawl',
        choices: ELEVEN_LINEMEN,
        starPlayers: ['fungus_the_loon'],
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(dataOf<{ startingPspPool: number }>(res).startingPspPool).toBe(
      60 - 18,
    );
  });
});

describe('handleBuildTeam — plan de compétences sous règlement', () => {
  it('refuse (400) une amélioration de caractéristique', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        advancements: [
          {
            positionSlug: 'lineman',
            ordinal: 0,
            type: 'characteristic',
            stat: 'ma',
            d8: 4,
          },
        ],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/compétences au choix/);
  });

  it('refuse (400) le cumul de 2 compétences quand le roster ne le permet pas', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        advancements: [
          { positionSlug: 'lineman', ordinal: 0, type: 'primary', skillSlug: 'block' },
          { positionSlug: 'lineman', ordinal: 0, type: 'primary', skillSlug: 'tackle' },
        ],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/ne peut pas cumuler/);
  });

  it("refuse un Star Player sous l'effectif régulier minimum du règlement", async () => {
    // NAF WC 2027 : 11 joueurs réguliers avant tout Star Player. Les
    // Snotlings sont autorisés à en recruter et n'ont qu'une Ligue (pas de
    // choix régional à trancher dans ce test).
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'snotling',
        choices: [{ key: 'lineman', count: 10 }],
        tournamentRuleset: 'naf_world_cup_2027',
        starPlayers: ['morg_n_thorg_2025'],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/11 joueurs réguliers/);
  });

  it("accepte un Star Player dès l'effectif régulier minimum atteint", async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'snotling',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        starPlayers: ['morg_n_thorg_2025'],
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
  });

  it('applique les améliorations valides avec le barème du pack', async () => {
    (prisma.teamPlayer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1', position: 'lineman' },
      { id: 'p2', position: 'lineman' },
    ]);
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        advancements: [
          { positionSlug: 'lineman', ordinal: 0, type: 'primary', skillSlug: 'block' },
          { positionSlug: 'lineman', ordinal: 1, type: 'secondary', skillSlug: 'dodge' },
        ],
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(applyCupBuildAdvancements).toHaveBeenCalledTimes(1);
    const [teamId, pool, mapped, costFn] = (
      applyCupBuildAdvancements as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(teamId).toBe('team-1');
    expect(pool).toBe(44);
    expect(mapped).toHaveLength(2);
    // Barème NAF WC 2027 : 1re primaire 6, 1re secondaire 10, 2e primaire 8.
    // Référentiel de compétences indisponible ici (mock étroit) ⇒ aucune
    // compétence n'est reconnue Elite, donc aucun surcoût.
    expect(costFn(0, 'primary', 'block')).toBe(6);
    expect(costFn(0, 'secondary', 'dodge')).toBe(10);
    expect(costFn(1, 'primary', 'block')).toBe(8);
  });

  it("facture le surcoût Elite du pack depuis le référentiel de compétences", async () => {
    // Le pack facture 2 PSP par compétence Elite sans republier la liste :
    // ce sont celles de l'édition (`Skill.isElite`).
    (prisma.skill.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'block' },
      { slug: 'dodge' },
      { slug: 'guard' },
    ]);
    (prisma.teamPlayer.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'p1', position: 'lineman' },
      { id: 'p2', position: 'lineman' },
    ]);
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        advancements: [
          { positionSlug: 'lineman', ordinal: 0, type: 'primary', skillSlug: 'block' },
          { positionSlug: 'lineman', ordinal: 1, type: 'primary', skillSlug: 'tackle' },
        ],
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    const [, , , costFn] = (
      applyCupBuildAdvancements as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    // Elite : 6 + 2. Non Elite : 6.
    expect(costFn(0, 'primary', 'block')).toBe(8);
    expect(costFn(0, 'primary', 'dodge')).toBe(8);
    expect(costFn(0, 'primary', 'tackle')).toBe(6);
    // Le référentiel n'est lu qu'une fois, pour l'édition de l'équipe.
    expect(prisma.skill.findMany).toHaveBeenCalledWith({
      where: { isElite: true, ruleset: 'season_3' },
      select: { slug: true },
    });
  });
});

describe('handleBuildTeam — cohérence coupe ↔ règlement', () => {
  const openCup = {
    id: 'cup-1',
    ruleset: 'season_3',
    format: 'bb11',
    status: 'ouverte',
    validated: false,
    resurrectionMode: false,
    tierBudgets: null,
    rosterBudgetOverrides: null,
    tierStartingPsp: null,
    rosterStartingPspOverrides: null,
    tournamentRuleset: null as string | null,
  };

  it('refuse (400) une équipe à règlement pour une coupe sans règlement', async () => {
    (prisma.cup.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...openCup,
    });
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        cupId: 'cup-1',
        tournamentRuleset: 'naf_world_cup_2027',
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/n’impose pas de règlement/);
  });

  it('impose le règlement de la coupe (budget du pack, slug persisté)', async () => {
    (prisma.cup.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...openCup,
      tournamentRuleset: 'naf_world_cup_2027',
    });
    (prisma.cupParticipant.create as ReturnType<typeof vi.fn>).mockResolvedValue(
      { id: 'cp-1' },
    );
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        cupId: 'cup-1',
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(dataOf<{ budget: number }>(res).budget).toBe(1080);
    expect(txMock.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tournamentRuleset: 'naf_world_cup_2027',
        }),
      }),
    );
  });
});
