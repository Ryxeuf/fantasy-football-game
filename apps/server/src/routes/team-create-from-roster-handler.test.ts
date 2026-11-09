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
    // Défensif : le calcul de coût/validation des Star Players est
    // maintenant DB-backed (star-player-repository.ts).
    starPlayer: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
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

// Config staff par roster × format : défaut dérivé du moteur (orc BB11).
// Lue SEULEMENT quand l'assistant envoie du staff.
vi.mock('../services/roster-staff-config', async () => {
  const engine = await vi.importActual<typeof import('@bb/game-engine')>(
    '@bb/game-engine',
  );
  return {
    resolveStaffConfigBySlug: vi.fn(
      async (slug: string, _r: string, format: 'bb11' | 'sevens') =>
        engine.defaultStaffConfig(slug, format),
    ),
  };
});

// Neutralise le recalcul de VE (I/O Prisma supplementaire).
vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(async () => ({ teamValue: 0, currentValue: 0 })),
}));

import { handleCreateFromRoster } from './team-create-from-roster-handler';
import type { AuthenticatedRequest } from '../middleware/authUser';
import { prisma } from '../prisma';
import { getRosterFromDb } from '../utils/roster-helpers';
import { getTeamPositions, defaultStaffConfig } from '@bb/game-engine';
import { resolveStaffConfigBySlug } from '../services/roster-staff-config';
import { createFromRosterSchema } from '../schemas/team.schemas';

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

/** Lignes de joueurs telles que passees a `createMany`. */
type PlayerRow = { position: string; name: string; number: number };

function createdPlayerRows(): PlayerRow[] {
  return createManySpy.mock.calls[0][0].data as PlayerRow[];
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
    const rows = createdPlayerRows();
    // 11 joueurs, tous avec des slugs de position du roster orc.
    expect(rows).toHaveLength(11);
    expect(rows.every((r) => r.position.startsWith('orc_'))).toBe(true);
    // Aucune position lizardmen ne doit fuiter (bug historique).
    expect(rows.some((r) => r.position.startsWith('lizardmen_'))).toBe(false);
  });
});

/**
 * Regression : les templates figes (skaven / wood_elf / lizardmen)
 * utilisaient des slugs Saison 2 absents des rosters Saison 3. Une
 * equipe creee via l'onboarding (ruleset season_3) se retrouvait avec
 * des positions introuvables -> cout par defaut 50k, nom = slug brut,
 * stats Saison 2, VE faussee. La compo doit desormais toujours provenir
 * des positions reelles du ruleset cible.
 */
describe('handleCreateFromRoster — Saison 3 (pas de fuite de slug Saison 2)', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.team.findUnique as any).mockResolvedValue({
      id: 'team-1',
      ruleset: 'season_3',
      players: [],
      starPlayers: [],
    });
  });

  it('lizardmen : derive la compo des positions reelles Saison 3 (fallback statique)', async () => {
    // DB non seedee -> fallback sur getTeamPositions (donnees statiques @bb/game-engine).
    vi.mocked(getRosterFromDb).mockResolvedValueOnce(null);

    const req = createReq({
      body: { name: 'Sauriens', roster: 'lizardmen', ruleset: 'season_3' },
    });
    const res = createRes();
    await handleCreateFromRoster(req, res);

    expect(res.statusCode).toBe(201);
    const rows = createdPlayerRows();
    expect(rows).toHaveLength(11);

    // Tous les slugs sont des positions Saison 3 reelles du roster lizardmen.
    const season3Slugs = new Set(
      getTeamPositions('lizardmen', 'season_3').map((p) => p.slug),
    );
    expect(season3Slugs.size).toBeGreaterThan(0);
    expect(rows.every((r) => season3Slugs.has(r.position))).toBe(true);

    // Le slug Saison 2 historique ne doit jamais fuiter (cause du bug 50k).
    expect(rows.some((r) => r.position === 'lizardmen_saurus')).toBe(false);

    // Le nom affiche est le displayName lisible, pas le slug brut.
    expect(rows.every((r) => !r.name.startsWith('lizardmen_'))).toBe(true);

    // Numerotation sequentielle 1..11 sans trou.
    expect(rows.map((r) => r.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it('skaven : aucun slug Saison 2 (skaven_lineman / thrower / gutter_runner)', async () => {
    vi.mocked(getRosterFromDb).mockResolvedValueOnce(null);

    const req = createReq({
      body: { name: 'Rats', roster: 'skaven', ruleset: 'season_3' },
    });
    const res = createRes();
    await handleCreateFromRoster(req, res);

    expect(res.statusCode).toBe(201);
    const rows = createdPlayerRows();
    const season3Slugs = new Set(
      getTeamPositions('skaven', 'season_3').map((p) => p.slug),
    );
    expect(rows).toHaveLength(11);
    expect(rows.every((r) => season3Slugs.has(r.position))).toBe(true);
    expect(
      rows.some((r) =>
        ['skaven_lineman', 'skaven_thrower', 'skaven_gutter_runner'].includes(
          r.position,
        ),
      ),
    ).toBe(false);
  });
});

describe('handleCreateFromRoster — règlement de tournoi', () => {
  it('refuse (400) un slug de règlement inconnu', async () => {
    const req = createReq({
      body: {
        name: 'Test',
        roster: 'orc',
        tournamentRuleset: 'ruleset_inconnu',
      },
    });
    const res = createRes();
    await handleCreateFromRoster(req, res);
    expect(res.statusCode).toBe(400);
    expect(
      (res as { payload?: { error?: string } }).payload?.error,
    ).toMatch(/Règlement de tournoi inconnu/);
  });

  it("impose le budget d'or du tier et persiste le slug (orc → 1080)", async () => {
    const req = createReq({
      body: {
        name: 'Test',
        roster: 'orc',
        teamValue: 2000,
        tournamentRuleset: 'naf_world_cup_2027',
      },
    });
    const res = createRes();
    await handleCreateFromRoster(req, res);
    expect(res.statusCode).toBe(201);
    expect(txCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamValue: 1080,
          initialBudget: 1080,
          tournamentRuleset: 'naf_world_cup_2027',
        }),
      }),
    );
  });

  it('sans règlement : tournamentRuleset null persisté', async () => {
    const req = createReq({ body: { name: 'Test', roster: 'orc' } });
    const res = createRes();
    await handleCreateFromRoster(req, res);
    expect(res.statusCode).toBe(201);
    expect(txCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tournamentRuleset: null }),
      }),
    );
  });

  it('aucun fan offert à la création (règle de ligue) : 0 fan, leagueFreeFan false', async () => {
    const req = createReq({ body: { name: 'Test', roster: 'orc' } });
    const res = createRes();
    await handleCreateFromRoster(req, res);
    expect(res.statusCode).toBe(201);
    expect(txCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dedicatedFans: 0, leagueFreeFan: false }),
      }),
    );
  });

  it("refuse (400) un Star Player quand le règlement ne l'autorise pas (orc)", async () => {
    const req = createReq({
      body: {
        name: 'Test',
        roster: 'orc',
        starPlayers: ['varag_ghoul_chewer'],
        tournamentRuleset: 'naf_world_cup_2027',
      },
    });
    const res = createRes();
    await handleCreateFromRoster(req, res);
    expect(res.statusCode).toBe(400);
    expect(
      (res as { payload?: { error?: string } }).payload?.error,
    ).toMatch(/n'autorise pas les Star Players/);
  });

  it('refuse (400) un Star Player banni pour un roster étoilé (goblin)', async () => {
    const req = createReq({
      body: {
        name: 'Test',
        roster: 'goblin',
        // Les Gobelins ont deux Ligues possibles : sans ce choix la
        // création est refusée avant même d'atteindre la règle testée.
        regionalLeague: 'badlands_brawl',
        starPlayers: ['ripper_bolgrot'],
        tournamentRuleset: 'naf_world_cup_2027',
      },
    });
    const res = createRes();
    await handleCreateFromRoster(req, res);
    expect(res.statusCode).toBe(400);
    expect(
      (res as { payload?: { error?: string } }).payload?.error,
    ).toMatch(/interdit\(s\) par le règlement/);
  });
});

describe("handleCreateFromRoster — staff choisi dans l'assistant", () => {
  const orcStaff = defaultStaffConfig('orc', 'bb11');

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma.team.findUnique as any).mockResolvedValue({
      id: 'team-1',
      ruleset: 'season_3',
      players: [],
      starPlayers: [],
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createdTeamData = (): Record<string, any> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (txCreateSpy.mock.calls[0] as any)[0].data;

  it('sans champ de staff : aucun staff, config jamais lue (historique)', async () => {
    const res = createRes();
    await handleCreateFromRoster(
      createReq({ body: { name: 'Da Boyz', roster: 'orc' } }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(createdTeamData()).toMatchObject({
      rerolls: 0,
      cheerleaders: 0,
      assistants: 0,
      apothecary: false,
      dedicatedFans: 0,
      leagueFreeFan: false,
    });
    expect(resolveStaffConfigBySlug).not.toHaveBeenCalled();
  });

  it('enregistre les fans, relances et apothicaire demandés (aucun fan offert)', async () => {
    const res = createRes();
    await handleCreateFromRoster(
      createReq({
        body: {
          name: 'Da Boyz',
          roster: 'orc',
          dedicatedFans: 3,
          rerolls: 2,
          apothecary: true,
        },
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(createdTeamData()).toMatchObject({
      rerolls: 2,
      apothecary: true,
      dedicatedFans: 3,
      leagueFreeFan: false,
    });
    expect(resolveStaffConfigBySlug).toHaveBeenCalledWith('orc', 'season_3', 'bb11');
  });

  it('refuse (400) au-delà du plafond de fans du roster', async () => {
    const res = createRes();
    await handleCreateFromRoster(
      createReq({
        body: {
          name: 'Da Boyz',
          roster: 'orc',
          dedicatedFans: orcStaff.maxDedicatedFans + 1,
        },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: string }).error).toMatch(/fans dévoués/);
    expect(txCreateSpy).not.toHaveBeenCalled();
  });

  it("refuse (422) l'apothicaire à un roster qui n'y a pas droit", async () => {
    vi.mocked(resolveStaffConfigBySlug).mockResolvedValueOnce({
      ...orcStaff,
      apothecaryAllowed: false,
    });
    const res = createRes();
    await handleCreateFromRoster(
      createReq({ body: { name: 'Da Boyz', roster: 'orc', apothecary: true } }),
      res,
    );
    expect(res.statusCode).toBe(422);
    expect(txCreateSpy).not.toHaveBeenCalled();
  });

  it('refuse (400) un staff qui dépasse le budget (11 × 50k + staff > 600k)', async () => {
    // 11 Orc Linemen = 550k ; une relance suffit à dépasser 600k.
    const res = createRes();
    await handleCreateFromRoster(
      createReq({
        body: { name: 'Da Boyz', roster: 'orc', teamValue: 600, rerolls: 1 },
      }),
      res,
    );
    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: string }).error).toMatch(/Budget dépassé/);
    expect(txCreateSpy).not.toHaveBeenCalled();
  });

  it('accepte un staff qui tient tout juste dans le budget', async () => {
    // 550k de joueurs + 5 fans, au kpo près.
    const res = createRes();
    await handleCreateFromRoster(
      createReq({
        body: {
          name: 'Da Boyz',
          roster: 'orc',
          teamValue: 550 + (5 * orcStaff.dedicatedFanCost) / 1000,
          dedicatedFans: 5,
        },
      }),
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(createdTeamData().dedicatedFans).toBe(5);
  });
});

describe('createFromRosterSchema — staff optionnel', () => {
  it('accepte le staff aux bornes du builder', () => {
    expect(
      createFromRosterSchema.safeParse({
        name: 'X',
        roster: 'orc',
        dedicatedFans: 6,
        rerolls: 8,
        apothecary: true,
      }).success,
    ).toBe(true);
  });

  it('refuse un compte hors bornes ou fractionnaire', () => {
    expect(
      createFromRosterSchema.safeParse({ name: 'X', roster: 'orc', dedicatedFans: 7 })
        .success,
    ).toBe(false);
    expect(
      createFromRosterSchema.safeParse({ name: 'X', roster: 'orc', rerolls: 1.5 }).success,
    ).toBe(false);
  });
});
