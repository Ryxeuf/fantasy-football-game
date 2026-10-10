/**
 * Inscription d'une équipe à une coupe — règlement de tournoi : égalité
 * stricte coupe ↔ équipe (les deux sens), pool PSP accordé depuis le build
 * de l'équipe pour une coupe à règlement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    cup: { findUnique: vi.fn() },
    team: { findFirst: vi.fn(), findUnique: vi.fn() },
    teamPlayer: { findMany: vi.fn() },
    roster: { findFirst: vi.fn() },
    cupParticipant: { create: vi.fn() },
  },
}));

vi.mock('./team-competition-status', () => ({
  getTeamEngagement: vi.fn(),
}));

vi.mock('./cup-roster-snapshot', () => ({
  captureRosterSnapshot: vi.fn(),
}));

vi.mock('./team-budget-summary', () => ({
  buildTeamBudgetSummary: vi.fn(),
}));

import { prisma } from '../prisma';
import { getTeamEngagement } from './team-competition-status';
import { captureRosterSnapshot } from './cup-roster-snapshot';
import { buildTeamBudgetSummary } from './team-budget-summary';
import {
  registerTeamToCup,
  CupRegistrationError,
} from './cup-registration';

const cupFind = prisma.cup.findUnique as unknown as ReturnType<typeof vi.fn>;
const teamFind = prisma.team.findFirst as unknown as ReturnType<typeof vi.fn>;
const rosterFind = prisma.roster.findFirst as unknown as ReturnType<typeof vi.fn>;
const participantCreate = prisma.cupParticipant
  .create as unknown as ReturnType<typeof vi.fn>;

function baseCup(over: Record<string, unknown> = {}) {
  return {
    id: 'C1',
    status: 'ouverte',
    validated: false,
    ruleset: 'season_3',
    format: 'bb11',
    participants: [],
    tierBudgets: null,
    rosterBudgetOverrides: null,
    tierStartingPsp: null,
    rosterStartingPspOverrides: null,
    tournamentRuleset: null,
    ...over,
  };
}

function baseTeam(over: Record<string, unknown> = {}) {
  return {
    id: 'T1',
    ownerId: 'U1',
    roster: 'orc',
    ruleset: 'season_3',
    format: 'bb11',
    teamValue: 1080,
    startingPspPool: 0,
    tournamentRuleset: null,
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  (getTeamEngagement as ReturnType<typeof vi.fn>).mockResolvedValue({
    engaged: false,
  });
  (captureRosterSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  rosterFind.mockResolvedValue(null);
  participantCreate.mockImplementation(async ({ data }) => ({
    id: 'P1',
    ...data,
  }));
});

describe('registerTeamToCup — règlement de tournoi', () => {
  it("refuse une équipe standard dans une coupe à règlement (l'un des deux sens)", async () => {
    cupFind.mockResolvedValue(
      baseCup({ tournamentRuleset: 'naf_world_cup_2027' }),
    );
    teamFind.mockResolvedValue(baseTeam());

    await expect(
      registerTeamToCup({ cupId: 'C1', teamId: 'T1', userId: 'U1' }),
    ).rejects.toMatchObject({
      name: 'CupRegistrationError',
      code: 'tournament_ruleset_mismatch',
    });
    expect(participantCreate).not.toHaveBeenCalled();
  });

  it("refuse une équipe à règlement dans une coupe standard (l'autre sens)", async () => {
    cupFind.mockResolvedValue(baseCup());
    teamFind.mockResolvedValue(
      baseTeam({ tournamentRuleset: 'naf_world_cup_2027' }),
    );

    const err = await registerTeamToCup({
      cupId: 'C1',
      teamId: 'T1',
      userId: 'U1',
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CupRegistrationError);
    expect((err as CupRegistrationError).code).toBe(
      'tournament_ruleset_mismatch',
    );
    expect((err as Error).message).toMatch(/NAF World Cup 2027/);
  });

  it('accepte une équipe au même règlement et accorde son pool PSP de build', async () => {
    cupFind.mockResolvedValue(
      baseCup({ tournamentRuleset: 'naf_world_cup_2027' }),
    );
    teamFind.mockResolvedValue(
      baseTeam({
        tournamentRuleset: 'naf_world_cup_2027',
        startingPspPool: 44,
      }),
    );

    const out = await registerTeamToCup({
      cupId: 'C1',
      teamId: 'T1',
      userId: 'U1',
    });
    expect(out.participantId).toBe('P1');
    expect(out.pspPoolGranted).toBe(44);
    expect(participantCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pspPoolGranted: 44 }),
      }),
    );
  });

  it('coupe et équipe standard : inscription inchangée', async () => {
    cupFind.mockResolvedValue(baseCup());
    teamFind.mockResolvedValue(baseTeam());

    const out = await registerTeamToCup({
      cupId: 'C1',
      teamId: 'T1',
      userId: 'U1',
    });
    expect(out.participantId).toBe('P1');
    expect(out.pspPoolGranted).toBe(0);
  });
});

describe('registerTeamToCup — budget de la coupe contre la dépense de construction', () => {
  const summary = buildTeamBudgetSummary as unknown as ReturnType<typeof vi.fn>;
  const teamUnique = prisma.team.findUnique as unknown as ReturnType<
    typeof vi.fn
  >;

  beforeEach(() => {
    cupFind.mockResolvedValue(baseCup({ tierBudgets: { I: 1000 } }));
    rosterFind.mockResolvedValue({ tier: 'I', budget: 1000 });
    teamFind.mockResolvedValue(baseTeam({ teamValue: 1_000_000 }));
    teamUnique.mockResolvedValue({
      ...baseTeam({ teamValue: 1_000_000 }),
      players: [],
      starPlayers: [{ starPlayerSlug: 'griff_oberwald', cost: 150_000 }],
      inducements: [],
    });
  });

  it('refuse une VE de 1 000k qui a payé 150k de Star Players hors VE', async () => {
    summary.mockResolvedValue({ totalSpent: 1_150_000 });

    const err = await registerTeamToCup({
      cupId: 'C1',
      teamId: 'T1',
      userId: 'U1',
    }).catch((e: unknown) => e);

    expect((err as CupRegistrationError).code).toBe('budget_exceeded');
    expect((err as Error).message).toMatch(/1150k/);
    expect((err as Error).message).toMatch(/Star Players/);
    expect((err as Error).message).toMatch(/1000k/);
    expect(participantCreate).not.toHaveBeenCalled();
    // La dépense se calcule sur le roster actif, ses Star Players et ses
    // coups de pouce de création.
    expect(summary).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({ id: 'T1' }),
      [],
      [{ starPlayerSlug: 'griff_oberwald', cost: 150_000 }],
      [],
    );
  });

  it('accepte une équipe dont la dépense tient dans le budget', async () => {
    summary.mockResolvedValue({ totalSpent: 990_000 });

    const out = await registerTeamToCup({
      cupId: 'C1',
      teamId: 'T1',
      userId: 'U1',
    });

    expect(out.participantId).toBe('P1');
  });

  it("ne calcule aucune dépense quand la coupe ne fixe pas de budget", async () => {
    cupFind.mockResolvedValue(baseCup());

    await registerTeamToCup({ cupId: 'C1', teamId: 'T1', userId: 'U1' });

    expect(summary).not.toHaveBeenCalled();
  });
});
