/**
 * Coups de pouce achetés À LA CRÉATION (`POST /team/build`) : contexte
 * autorisé (règlement de tournoi, coupe en mode `build`), catalogue effectif
 * (mocké ici, testé dans `inducement-options.test.ts`), prix du serveur,
 * budget d'or, écriture dans la transaction et journal d'équipe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

const txMock = {
  team: { create: vi.fn() },
  teamPlayer: { createMany: vi.fn() },
  teamStarPlayer: { createMany: vi.fn() },
  teamInducement: { createMany: vi.fn() },
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

vi.mock('../services/inducement-options', () => ({
  buildInducementCatalogue: vi.fn(),
}));

vi.mock('../services/team-audit', async () => {
  const actual = await vi.importActual<typeof import('../services/team-audit')>(
    '../services/team-audit',
  );
  return { ...actual, safeRecordTeamAudit: vi.fn() };
});

import { handleBuildTeam } from './team-build-handler';
import { buildInducementCatalogue } from '../services/inducement-options';
import { safeRecordTeamAudit } from '../services/team-audit';
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

const catalogue = buildInducementCatalogue as unknown as ReturnType<typeof vi.fn>;

const NAF_CATALOGUE = [
  { slug: 'team_mascot', name: "Mascotte d'Équipe", cost: 25_000, maxQuantity: 1, description: '' },
  { slug: 'bloodweiser_kegs', name: 'Fûts de Blitz Premium', cost: 50_000, maxQuantity: 2, description: '' },
  { slug: 'bribe', name: 'Pots-de-vin', cost: 100_000, maxQuantity: 3, description: '' },
];

const openCup = {
  id: 'cup-1',
  ruleset: 'season_3',
  format: 'bb11',
  status: 'ouverte',
  validated: false,
  resurrectionMode: true,
  tierBudgets: null,
  rosterBudgetOverrides: null,
  tierStartingPsp: null,
  rosterStartingPspOverrides: null,
  tournamentRuleset: null as string | null,
  inducementMode: 'build' as string | null,
  allowedInducements: null as string | null,
};

beforeEach(() => {
  txMock.teamInducement.createMany.mockResolvedValue({ count: 0 });
  catalogue.mockResolvedValue(NAF_CATALOGUE);
  (prisma.cupParticipant.create as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: 'cp-1',
  });
});

describe('handleBuildTeam — coups de pouce sous règlement de tournoi', () => {
  it('achète la Mascotte sur le budget d’or du pack et l’écrit avec son prix', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'team_mascot', quantity: 1 }],
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    // 11 × 50 kpo + 25 kpo de Mascotte, sur un budget de 1080 kpo.
    expect(dataOf<{ cost: number; budget: number }>(res)).toMatchObject({
      cost: 575,
      budget: 1080,
    });
    expect(
      dataOf<{ breakdown: { inducements: number } }>(res).breakdown.inducements,
    ).toBe(25);
    expect(txMock.teamInducement.createMany).toHaveBeenCalledWith({
      data: [{ teamId: 'team-1', slug: 'team_mascot', quantity: 1, unitCost: 25_000 }],
    });
  });

  it('refuse (400) un coup de pouce hors de la liste du règlement, en le nommant', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'weather_mage', quantity: 1 }],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/weather_mage/);
    expect(errorOf(res)).toMatch(/NAF World Cup 2027/);
    expect(txMock.team.create).not.toHaveBeenCalled();
  });

  it('refuse (400) une quantité au-delà du plafond servi', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'bribe', quantity: 3 }],
      }),
      res,
    );
    // Le catalogue (mocké) plafonne à 3 : accepté ; à 2 avec Arme Secrète.
    expect(res.statusCode).toBe(201);
    catalogue.mockResolvedValue(
      NAF_CATALOGUE.map((c) => (c.slug === 'bribe' ? { ...c, maxQuantity: 2 } : c)),
    );
    const capped = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'bribe', quantity: 3 }],
      }),
      capped,
    );
    expect(capped.statusCode).toBe(400);
    expect(errorOf(capped)).toMatch(/2 au plus/);
  });

  it('transmet les Star Players recrutés au catalogue (plafond Arme Secrète)', async () => {
    (getRosterFromDb as ReturnType<typeof vi.fn>).mockResolvedValue(
      rosterDef({ slug: 'goblin' }),
    );
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'goblin',
        regionalLeague: 'badlands_brawl',
        choices: ELEVEN_LINEMEN,
        starPlayers: ['bomber_dribblesnot'],
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'bribe', quantity: 1 }],
      }),
      res,
    );
    expect(catalogue).toHaveBeenCalledWith(
      expect.objectContaining({
        roster: 'goblin',
        hiredStarSlugs: ['bomber_dribblesnot'],
      }),
    );
  });

  it('refuse (400) un budget dépassé en nommant la part des coups de pouce', async () => {
    // 16 joueurs à 50 kpo = 800 + 3 × 100 kpo de Pots-de-vin = 1100 > 1080.
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: [{ key: 'lineman', count: 16 }],
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'bribe', quantity: 3 }],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/300k coups de pouce/);
  });

  it('ignore un prix envoyé par le client', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'team_mascot', quantity: 1, cost: 0 }],
      }),
      res,
    );
    expect(txMock.teamInducement.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ unitCost: 25_000 })],
    });
  });

  it('détaille les coups de pouce dans l’étape team.create du journal', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        tournamentRuleset: 'naf_world_cup_2027',
        inducements: [{ slug: 'bloodweiser_kegs', quantity: 2 }],
      }),
      res,
    );
    const createStep = (safeRecordTeamAudit as ReturnType<typeof vi.fn>).mock.calls
      .map((c) => c[1])
      .find((e) => e.action === 'team.create');
    expect(createStep.details.inducements).toEqual([
      { slug: 'bloodweiser_kegs', quantity: 2, unitCost: 50_000 },
    ]);
  });
});

describe('handleBuildTeam — coups de pouce hors contexte et en coupe', () => {
  it('refuse (400) des coups de pouce en jeu libre', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        inducements: [{ slug: 'team_mascot', quantity: 1 }],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect(errorOf(res)).toMatch(/ne s'achètent à la création/);
    expect(catalogue).not.toHaveBeenCalled();
  });

  it('accepte des coups de pouce pour une coupe en mode build, avec sa liste', async () => {
    (prisma.cup.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...openCup,
      allowedInducements: '["team_mascot"]',
    });
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        cupId: 'cup-1',
        inducements: [{ slug: 'team_mascot', quantity: 1 }],
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(catalogue).toHaveBeenCalledWith(
      expect.objectContaining({ allowlist: ['team_mascot'], pack: null }),
    );
  });

  it('refuse (400) des coups de pouce pour une coupe en mode match', async () => {
    (prisma.cup.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...openCup,
      inducementMode: 'match',
    });
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        cupId: 'cup-1',
        inducements: [{ slug: 'team_mascot', quantity: 1 }],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it('une coupe antérieure au réglage (null) se lit en match', async () => {
    (prisma.cup.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...openCup,
      inducementMode: null,
    });
    const res = createRes();
    await handleBuildTeam(
      createReq({
        name: 'T',
        roster: 'orc',
        choices: ELEVEN_LINEMEN,
        cupId: 'cup-1',
        inducements: [{ slug: 'team_mascot', quantity: 1 }],
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
  });

  it('sans coup de pouce demandé, rien ne change (aucune résolution)', async () => {
    const res = createRes();
    await handleBuildTeam(
      createReq({ name: 'T', roster: 'orc', choices: ELEVEN_LINEMEN }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(catalogue).not.toHaveBeenCalled();
    expect(txMock.teamInducement.createMany).not.toHaveBeenCalled();
  });
});
