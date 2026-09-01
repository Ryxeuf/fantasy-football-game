/**
 * S27.8.30 — Smoke tests pour `handleUpdatePlayerSkills` extrait
 * depuis `team-player-handlers.ts` vers
 * `team-player-skills-handler.ts` (polish slice : ramener
 * team-player-handlers.ts sous DoD 400).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn() },
    teamSelection: { findFirst: vi.fn() },
    // Existence, catégorie et exclusivité d'une compétence : table `Skill`
    // (base = source de vérité, cf. audit statique vs base — lot 2).
    skill: { findFirst: vi.fn(), findMany: vi.fn() },
    // Accès Principale/Secondaire de la position.
    position: { findFirst: vi.fn() },
    // Comptabilité du pool de PSP de construction (édition avancée).
    teamPlayer: { findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  },
}));

// Le handler interroge le gel du roster pour décider s'il peut puiser dans
// le pool de PSP de construction. Équipe libre par défaut ici.
vi.mock('../services/team-lock-status', () => ({
  isTeamBuildLocked: vi.fn().mockResolvedValue(false),
}));

vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(),
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { RANDOM_PRIMARY_SKILL_TABLE_2025 } from '@bb/game-engine';
import { prisma } from '../prisma';
import { handleUpdatePlayerSkills } from './team-player-skills-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mockPrisma = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn> };
  skill: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  position: { findFirst: ReturnType<typeof vi.fn> };
  teamPlayer: {
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
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
    params: { id: 'team-1', playerId: 'p-1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...overrides,
  } as AuthenticatedRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.teamPlayer.findMany.mockResolvedValue([]);
});

describe('handleUpdatePlayerSkills — flag excludedFromSelection (Flux B legacy)', () => {
  it('rejette (400) une competence flaggee excludedFromSelection en DB, meme si categorie autorisee', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce({
      id: 'team-1',
      ruleset: 'season_3',
      players: [
        { id: 'p-1', position: 'human_lineman', skills: '', dead: false, advancements: '[]', spp: 20 },
      ],
    });
    mockPrisma.position.findFirst.mockResolvedValueOnce({
      primarySkills: 'G,S',
      secondarySkills: 'A,P',
    });
    // mighty-blow est bien en base, categorie autorisee, mais flagge exclu
    // de la selection pour ce ruleset.
    mockPrisma.skill.findFirst.mockResolvedValueOnce({
      nameFr: 'Châtaigne',
      category: 'Strength',
      excludedFromSelection: true,
    });

    const req = createReq({
      body: { skillSlug: 'mighty-blow', advancementType: 'primary' },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error?: string })?.error).toMatch(/disponible.*selection|selection/i);
  });
});

describe('S27.8.30 — team-player-skills-handler exports', () => {
  it('exposes handleUpdatePlayerSkills', () => {
    expect(typeof handleUpdatePlayerSkills).toBe('function');
  });

  it('re-exports handleUpdatePlayerSkills via team-player-handlers', async () => {
    const mod = await import('./team-player-handlers');
    expect(typeof mod.handleUpdatePlayerSkills).toBe('function');
  });

  it('re-exports handleUpdatePlayerSkills from team.ts (test-import compat)', async () => {
    const mod = await import('./team');
    expect(typeof mod.handleUpdatePlayerSkills).toBe('function');
  });
});

describe('handleUpdatePlayerSkills — defensive gates', () => {
  it('returns 400 when skillSlug missing on chosen advancement', async () => {
    const req = createReq({ body: { advancementType: 'primary' } });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when skillCategory missing on random advancement', async () => {
    const req = createReq({ body: { advancementType: 'random-primary' } });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when team not found', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(null);
    const req = createReq({
      body: { advancementType: 'primary', skillSlug: 'block' },
    });
    const res = createRes();
    await handleUpdatePlayerSkills(req, res);
    expect(res.statusCode).toBe(404);
  });
});

/**
 * Audit statique vs base — lot 2 (S1, S2) : l'accès Principale/Secondaire, le
 * catalogue de compétences et sa catégorisation sont lus EN BASE. Auparavant,
 * `ACCESS_BY_POSITION` (12 postes Saison 2) laissait ~95 % des postes sans
 * aucune restriction, et `SKILLS_BY_SLUG` refusait toute compétence créée en
 * admin.
 */
describe('handleUpdatePlayerSkills — accès et catalogue lus en base', () => {
  const TEAM = {
    id: 'team-1',
    roster: 'lizardmen',
    ruleset: 'season_3',
    startingPspPool: 0,
    tournamentRuleset: null,
    players: [
      {
        id: 'p-1',
        position: 'lizardmen_saurus',
        skills: '',
        dead: false,
        advancements: '[]',
        spp: 30,
      },
    ],
  };

  it('refuse une compétence hors du pool déclaré par la position en base', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(TEAM);
    // Saurus : Force en Principale, Générale en Secondaire — pas de Mutation.
    mockPrisma.position.findFirst.mockResolvedValueOnce({
      primarySkills: 'S',
      secondarySkills: 'G',
    });
    mockPrisma.skill.findFirst.mockResolvedValueOnce({
      nameFr: 'Griffes',
      category: 'Mutation',
      excludedFromSelection: false,
    });

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ body: { skillSlug: 'claws', advancementType: 'primary' } }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error?: string })?.error).toMatch(
      /pas accessible en primary/i,
    );
  });

  it('accepte une compétence créée en admin dès lors que sa catégorie est au pool', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(TEAM);
    mockPrisma.position.findFirst.mockResolvedValueOnce({
      primarySkills: 'S',
      secondarySkills: 'G',
    });
    // Slug absent du catalogue compilé : refusé avant (« inconnue »).
    mockPrisma.skill.findFirst.mockResolvedValueOnce({
      nameFr: 'Coup de Boule Maison',
      category: 'Strength',
      excludedFromSelection: false,
    });
    mockPrisma.teamPlayer.update.mockResolvedValueOnce({});
    mockPrisma.teamPlayer.findUnique.mockResolvedValueOnce({ id: 'p-1' });

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({
        body: { skillSlug: 'maison-headbutt', advancementType: 'primary' },
      }),
      res,
    );

    expect(res.statusCode).not.toBe(400);
    const data = mockPrisma.teamPlayer.update.mock.calls[0][0].data;
    expect(data.skills).toBe('maison-headbutt');
  });

  it("n'impose rien quand la position n'a pas d'accès renseigné (season_2)", async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(TEAM);
    mockPrisma.position.findFirst.mockResolvedValueOnce({
      primarySkills: null,
      secondarySkills: null,
    });
    mockPrisma.skill.findFirst.mockResolvedValueOnce({
      nameFr: 'Griffes',
      category: 'Mutation',
      excludedFromSelection: false,
    });
    mockPrisma.teamPlayer.update.mockResolvedValueOnce({});
    mockPrisma.teamPlayer.findUnique.mockResolvedValueOnce({ id: 'p-1' });

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({ body: { skillSlug: 'claws', advancementType: 'primary' } }),
      res,
    );

    expect(res.statusCode).not.toBe(400);
  });

  it('refuse une catégorie hors du pool Principal pour un tirage aléatoire', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(TEAM);
    mockPrisma.position.findFirst.mockResolvedValueOnce({
      primarySkills: 'S',
      secondarySkills: 'G',
    });

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({
        body: { advancementType: 'random-primary', skillCategory: 'Mutation' },
      }),
      res,
    );

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error?: string })?.error).toMatch(
      /pas accessible en primary/i,
    );
  });

  it('tire dans le pool officiel filtré en base (jamais une variante exclue)', async () => {
    mockPrisma.team.findFirst.mockResolvedValueOnce(TEAM);
    mockPrisma.position.findFirst.mockResolvedValueOnce({
      primarySkills: 'S',
      secondarySkills: 'G',
    });
    // Pool résolu par `resolveRandomPrimaryPool` : table 2D6 filtrée.
    mockPrisma.skill.findMany.mockResolvedValueOnce(
      RANDOM_PRIMARY_SKILL_TABLE_2025.S.map((slug) => ({
        slug,
        category: 'Strength',
        excludedFromSelection: slug === 'guard',
      })),
    );
    mockPrisma.teamPlayer.update.mockResolvedValueOnce({});
    mockPrisma.teamPlayer.findUnique.mockResolvedValueOnce({ id: 'p-1' });

    const res = createRes();
    await handleUpdatePlayerSkills(
      createReq({
        body: { advancementType: 'random-primary', skillCategory: 'Strength' },
      }),
      res,
    );

    expect(res.statusCode).not.toBe(400);
    const rolled = mockPrisma.teamPlayer.update.mock.calls[0][0].data.skills;
    expect(RANDOM_PRIMARY_SKILL_TABLE_2025.S).toContain(rolled);
    expect(rolled).not.toBe('guard');
  });
});
