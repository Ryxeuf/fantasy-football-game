/**
 * Le règlement de tournoi s'applique aussi APRÈS la création : recrutement,
 * renvoi et liste des recrutables. La décision elle-même est testée dans
 * `services/tournament-star-player-rules.test.ts` ; ici, on vérifie que les
 * handlers la consultent et écrivent ce qu'elle rend.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response } from 'express';

vi.mock('../prisma', () => ({
  prisma: {
    team: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    teamSelection: { findFirst: vi.fn() },
    teamStarPlayer: { create: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock('../utils/team-values', () => ({
  updateTeamValues: vi.fn(),
  sumPlayerCostsForTeam: vi.fn(),
}));
vi.mock('../services/team-audit', () => ({
  captureTeamState: vi.fn(),
  safeRecordTeamAudit: vi.fn(),
}));
vi.mock('../utils/star-player-repository', () => ({
  getStarPlayerBySlugDb: vi.fn(),
}));
vi.mock('../utils/star-player-validation', () => ({
  validateStarPlayerHire: vi.fn(),
  requiresPair: vi.fn(),
  getTeamAvailableStarPlayers: vi.fn(),
}));
vi.mock('../services/tournament-ruleset-repository', () => ({
  getTournamentRulesetDefinition: vi.fn(),
}));
vi.mock('../services/tournament-star-player-rules', async () => {
  const actual = await vi.importActual<
    typeof import('../services/tournament-star-player-rules')
  >('../services/tournament-star-player-rules');
  return {
    packStarBlockReason: actual.packStarBlockReason,
    decidePackStarChangeForTeam: vi.fn(),
  };
});

import { NAF_WORLD_CUP_2027_V3 } from '@bb/game-engine';
import { prisma } from '../prisma';
import { sumPlayerCostsForTeam } from '../utils/team-values';
import { safeRecordTeamAudit } from '../services/team-audit';
import { getStarPlayerBySlugDb } from '../utils/star-player-repository';
import {
  getTeamAvailableStarPlayers,
  requiresPair,
  validateStarPlayerHire,
} from '../utils/star-player-validation';
import { getTournamentRulesetDefinition } from '../services/tournament-ruleset-repository';
import { decidePackStarChangeForTeam } from '../services/tournament-star-player-rules';
import {
  handleDeleteTeamStarPlayer,
  handleHireStarPlayer,
  handleListAvailableStarPlayers,
} from './team-star-player-handlers';
import type { AuthenticatedRequest } from '../middleware/authUser';

const mock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

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

function createReq(over: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return {
    body: { starPlayerSlug: 'fungus_the_loon' },
    params: { id: 'team-1', starPlayerId: 'tsp-1' },
    query: {},
    user: { id: 'user-1', roles: ['user'] },
    ...over,
  } as AuthenticatedRequest;
}

function ogreTeam(over: Record<string, unknown> = {}) {
  return {
    id: 'team-1',
    ownerId: 'user-1',
    roster: 'ogre',
    ruleset: 'season_3',
    format: 'bb11',
    initialBudget: 1200,
    startingPspPool: 72,
    tournamentRuleset: 'naf_world_cup_2027_v3',
    players: [],
    starPlayers: [],
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mock(prisma.teamSelection.findFirst).mockResolvedValue(null);
  mock(sumPlayerCostsForTeam).mockResolvedValue(0);
  mock(validateStarPlayerHire).mockResolvedValue({
    valid: true,
    starPlayer: { slug: 'fungus_the_loon', cost: 80_000 },
  });
  mock(requiresPair).mockResolvedValue(null);
  mock(getStarPlayerBySlugDb).mockResolvedValue({
    slug: 'fungus_the_loon',
    displayName: 'Fungus the Loon',
    cost: 80_000,
  });
  mock(prisma.teamStarPlayer.create).mockReturnValue('create-op');
  mock(prisma.teamStarPlayer.deleteMany).mockReturnValue('delete-op');
  mock(prisma.team.update).mockReturnValue('update-op');
  mock(prisma.$transaction).mockResolvedValue([
    { id: 'tsp-1', starPlayerSlug: 'fungus_the_loon', cost: 80_000 },
    {},
  ]);
  mock(prisma.team.findUnique).mockResolvedValue(ogreTeam());
});

describe('POST /team/:id/star-players — règlement de tournoi', () => {
  it('refuse (400) ce que le règlement refuse, sans rien écrire', async () => {
    mock(prisma.team.findFirst).mockResolvedValue(ogreTeam());
    mock(decidePackStarChangeForTeam).mockResolvedValue({
      ok: false,
      error: 'Star Player(s) interdit(s) par le règlement',
    });
    const res = createRes();
    await handleHireStarPlayer(createReq(), res);

    expect(res.statusCode).toBe(400);
    expect((res.payload as { error: string }).error).toMatch(/interdit/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.teamStarPlayer.create).not.toHaveBeenCalled();
  });

  it('soumet au règlement les Star Players déjà recrutés PLUS le nouveau', async () => {
    mock(prisma.team.findFirst).mockResolvedValue(
      ogreTeam({
        startingPspPool: 54,
        starPlayers: [{ id: 'tsp-0', starPlayerSlug: 'scrappa_sorehead', cost: 130_000 }],
      }),
    );
    mock(decidePackStarChangeForTeam).mockResolvedValue({ ok: true, nextPool: 48 });
    await handleHireStarPlayer(createReq(), createRes());

    expect(mock(decidePackStarChangeForTeam).mock.calls[0][1]).toEqual([
      { slug: 'scrappa_sorehead', cost: 130_000 },
      { slug: 'fungus_the_loon', cost: 80_000 },
    ]);
  });

  it('prélève la taxe sur le pool dans la MÊME transaction que le recrutement', async () => {
    mock(prisma.team.findFirst).mockResolvedValue(ogreTeam());
    mock(decidePackStarChangeForTeam).mockResolvedValue({ ok: true, nextPool: 54 });
    const res = createRes();
    await handleHireStarPlayer(createReq(), res);

    expect(res.statusCode).toBe(201);
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { startingPspPool: 54 },
    });
    expect(mock(prisma.$transaction).mock.calls[0][0]).toEqual([
      'create-op',
      'update-op',
    ]);
    // Le journal d'équipe garde le pool obtenu.
    expect(mock(safeRecordTeamAudit).mock.calls[0][1].details).toMatchObject({
      startingPspPool: 54,
    });
    // La réponse ne confond pas la mise à jour d'équipe avec un Star Player.
    const data = (res.payload as { data: { newStarPlayers: unknown[] } }).data;
    expect(data.newStarPlayers).toHaveLength(1);
  });

  it("équipe sans règlement : aucune écriture de pool", async () => {
    mock(prisma.team.findFirst).mockResolvedValue(
      ogreTeam({ tournamentRuleset: null }),
    );
    mock(decidePackStarChangeForTeam).mockResolvedValue(null);
    const res = createRes();
    await handleHireStarPlayer(createReq(), res);

    expect(res.statusCode).toBe(201);
    expect(prisma.team.update).not.toHaveBeenCalled();
    expect(mock(prisma.$transaction).mock.calls[0][0]).toEqual(['create-op']);
  });
});

describe('DELETE /team/:id/star-players/:starPlayerId — règlement de tournoi', () => {
  const withStar = () =>
    ogreTeam({
      startingPspPool: 54,
      starPlayers: [{ id: 'tsp-1', starPlayerSlug: 'fungus_the_loon', cost: 80_000 }],
    });

  it('rend la taxe au pool avec le renvoi', async () => {
    mock(prisma.team.findFirst).mockResolvedValue(withStar());
    mock(decidePackStarChangeForTeam).mockResolvedValue({ ok: true, nextPool: 72 });
    const res = createRes();
    await handleDeleteTeamStarPlayer(createReq(), res);

    expect(res.statusCode ?? 200).toBe(200);
    // Le règlement voit l'équipe SANS le Star Player renvoyé.
    expect(mock(decidePackStarChangeForTeam).mock.calls[0][1]).toEqual([]);
    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { startingPspPool: 72 },
    });
    expect(mock(prisma.$transaction).mock.calls[0][0]).toEqual([
      'delete-op',
      'update-op',
    ]);
  });

  it('équipe sans règlement : renvoi simple, pool intact', async () => {
    mock(prisma.team.findFirst).mockResolvedValue(withStar());
    mock(decidePackStarChangeForTeam).mockResolvedValue(null);
    await handleDeleteTeamStarPlayer(createReq(), createRes());

    expect(prisma.teamStarPlayer.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.team.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('GET /team/:id/star-players/available — règlement de tournoi', () => {
  const CANDIDATES = [
    { slug: 'fungus_the_loon', cost: 80_000, keywords: null },
    { slug: 'glotl_stop', cost: 270_000, keywords: null },
  ];
  const listed = async (team: Record<string, unknown>) => {
    mock(prisma.team.findFirst).mockResolvedValue(team);
    mock(getTeamAvailableStarPlayers).mockResolvedValue(CANDIDATES);
    const res = createRes();
    await handleListAvailableStarPlayers(createReq(), res);
    return (
      res.payload as {
        data: {
          availableStarPlayers: Array<{
            slug: string;
            canHire: boolean;
            rulesetBlockReason: string | null;
          }>;
        };
      }
    ).data.availableStarPlayers;
  };

  it('un Star Player banni par le règlement est listé non recrutable, avec la raison', async () => {
    mock(getTournamentRulesetDefinition).mockResolvedValue(NAF_WORLD_CUP_2027_V3);
    const [fungus, glotl] = await listed(ogreTeam());
    expect(fungus).toMatchObject({ canHire: true, rulesetBlockReason: null });
    expect(glotl.canHire).toBe(false);
    expect(glotl.rulesetBlockReason).toMatch(/interdit/);
  });

  it("aucun Star Player n'est recrutable sur un roster qui n'y a pas droit", async () => {
    mock(getTournamentRulesetDefinition).mockResolvedValue(NAF_WORLD_CUP_2027_V3);
    const list = await listed(ogreTeam({ roster: 'orc' }));
    expect(list.every((sp) => !sp.canHire)).toBe(true);
  });

  it('sans règlement, la liste est inchangée', async () => {
    mock(getTournamentRulesetDefinition).mockResolvedValue(null);
    const list = await listed(ogreTeam({ tournamentRuleset: null }));
    expect(list.map((sp) => sp.canHire)).toEqual([true, true]);
  });
});
