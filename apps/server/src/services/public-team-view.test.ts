import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({ prisma: {} }));

vi.mock('../utils/server-log', () => ({
  serverLog: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('./team-share', () => ({ getPublicTeamByToken: vi.fn() }));
vi.mock('./roster-staff-config', () => ({ resolveStaffConfigBySlug: vi.fn() }));
vi.mock('./team-budget-summary', () => ({ buildTeamBudgetSummary: vi.fn() }));
vi.mock('../utils/team-values', () => ({ computePlayerValuesFor: vi.fn() }));

import { getPublicTeamByToken } from './team-share';
import { resolveStaffConfigBySlug } from './roster-staff-config';
import { buildTeamBudgetSummary } from './team-budget-summary';
import { computePlayerValuesFor } from '../utils/team-values';
import {
  buildPublicTeamView,
  getPublicTeamViewByToken,
} from './public-team-view';

const resolveByToken = getPublicTeamByToken as unknown as ReturnType<
  typeof vi.fn
>;
const resolveStaff = resolveStaffConfigBySlug as unknown as ReturnType<
  typeof vi.fn
>;
const buildBudget = buildTeamBudgetSummary as unknown as ReturnType<
  typeof vi.fn
>;
const computeValues = computePlayerValuesFor as unknown as ReturnType<
  typeof vi.fn
>;

function teamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    ownerId: 'u1',
    shareToken: 'tok',
    isPublic: true,
    name: 'Les Rats Véloces',
    roster: 'skaven',
    ruleset: 'season_3',
    format: 'bb11',
    teamValue: 1_000_000,
    currentValue: 990_000,
    treasury: 50_000,
    initialBudget: 1000,
    rerolls: 2,
    cheerleaders: 1,
    assistants: 0,
    apothecary: true,
    dedicatedFans: 2,
    logoUrl: null,
    description: 'Écumeurs des égouts.',
    players: [
      {
        id: 'p1',
        name: 'Skitter',
        position: 'skaven_blitzer',
        number: 1,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: 'block',
        dead: false,
        firedAt: null,
        imageUrl: null,
        advancements: '[]',
        spp: 12,
      },
    ],
    starPlayers: [{ id: 's1', starPlayerSlug: 'headsplitter', cost: 200_000 }],
    ...overrides,
  } as never;
}

const STAFF_CONFIG = {
  rerollCost: 60_000,
  maxRerolls: 8,
  apothecaryAllowed: true,
  apothecaryCost: 50_000,
  maxCheerleaders: 12,
  cheerleaderCost: 10_000,
  maxAssistants: 6,
  assistantCost: 10_000,
  maxDedicatedFans: 6,
  dedicatedFanCost: 5_000,
};

const BUDGET = {
  initialBudget: 1_000_000,
  playersCost: 620_000,
  playersHireCost: 600_000,
  advancementsCost: 20_000,
  starPlayersCost: 200_000,
  staffCost: 60_000,
  rerollsCost: 120_000,
  dedicatedFansCost: 5_000,
  totalSpent: 985_000,
  remaining: 15_000,
  treasury: 50_000,
  teamValue: 1_150_000,
  currentValue: 1_100_000,
  unavailablePlayersCost: 50_000,
  cheapLinemenWaived: 0,
};

beforeEach(() => {
  vi.resetAllMocks();
  resolveStaff.mockResolvedValue(STAFF_CONFIG);
  buildBudget.mockResolvedValue(BUDGET);
  computeValues.mockResolvedValue({
    p1: { hireCost: 90_000, advancementsCost: 20_000, value: 110_000, lineman: false },
  });
});

describe('buildPublicTeamView', () => {
  it('sert les chiffres calculés par le serveur (valeur par joueur, staff, budget)', async () => {
    const view = await buildPublicTeamView(teamRow());

    expect(view.playerValues?.p1?.value).toBe(110_000);
    expect(view.staffConfig?.rerollCost).toBe(60_000);
    expect(view.budgetSummary?.playersCost).toBe(620_000);
    expect(resolveStaff).toHaveBeenCalledWith('skaven', 'season_3', 'bb11');
  });

  it('affiche la VE/VEA fraîche du résumé plutôt que la colonne stockée', async () => {
    const view = await buildPublicTeamView(teamRow());
    expect(view.teamValue).toBe(1_150_000);
    expect(view.currentValue).toBe(1_100_000);
  });

  it('retombe sur les colonnes stockées quand le résumé est indisponible', async () => {
    buildBudget.mockRejectedValue(new Error('boom'));
    const view = await buildPublicTeamView(teamRow());
    expect(view.teamValue).toBe(1_000_000);
    expect(view.currentValue).toBe(990_000);
    expect(view.budgetSummary).toBeUndefined();
  });

  it("n'expose ni le propriétaire ni le jeton de partage", async () => {
    const view = await buildPublicTeamView(teamRow());
    expect(view).not.toHaveProperty('ownerId');
    expect(view).not.toHaveProperty('shareToken');
    expect(view).not.toHaveProperty('isPublic');
  });

  it('expose le logo, le fluff et les Star Players', async () => {
    const view = await buildPublicTeamView(
      teamRow({ logoUrl: '/images/team-logos/rats.png' }),
    );
    expect(view.logoUrl).toBe('/images/team-logos/rats.png');
    expect(view.description).toBe('Écumeurs des égouts.');
    expect(view.starPlayers).toEqual([
      { id: 's1', starPlayerSlug: 'headsplitter', cost: 200_000 },
    ]);
  });

  it("ne remonte du joueur que ce dont l'affichage a besoin", async () => {
    const view = await buildPublicTeamView(teamRow());
    expect(view.players[0]).toEqual({
      id: 'p1',
      name: 'Skitter',
      position: 'skaven_blitzer',
      number: 1,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: 'block',
      dead: false,
      firedAt: null,
      imageUrl: null,
      advancements: '[]',
    });
  });

  it("un enrichissement en échec ne prive jamais le visiteur de l'effectif", async () => {
    resolveStaff.mockRejectedValue(new Error('staff KO'));
    computeValues.mockRejectedValue(new Error('valeurs KO'));

    const view = await buildPublicTeamView(teamRow());

    expect(view.staffConfig).toBeUndefined();
    expect(view.playerValues).toBeUndefined();
    expect(view.players).toHaveLength(1);
    expect(view.budgetSummary?.playersCost).toBe(620_000);
  });

  it('replie le format sur bb11 quand la colonne est illisible', async () => {
    await buildPublicTeamView(teamRow({ format: 'inconnu' }));
    expect(resolveStaff).toHaveBeenCalledWith('skaven', 'season_3', 'bb11');
  });
});

describe('getPublicTeamViewByToken', () => {
  it('rend null quand aucune équipe publique ne correspond', async () => {
    resolveByToken.mockResolvedValue(null);
    expect(await getPublicTeamViewByToken('inconnu')).toBeNull();
    expect(resolveStaff).not.toHaveBeenCalled();
  });

  it('enrichit l’équipe résolue par son jeton', async () => {
    resolveByToken.mockResolvedValue(teamRow());
    const view = await getPublicTeamViewByToken('tok');
    expect(view?.name).toBe('Les Rats Véloces');
    expect(view?.playerValues?.p1?.value).toBe(110_000);
  });
});
