import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: { team: { findUnique: vi.fn() } },
}));

vi.mock('./inducement-repository', () => ({
  loadInducementCatalogue: vi.fn(async () => [
    { slug: 'team_mascot', displayNameFr: "Mascotte d'Équipe" },
  ]),
}));

import { prisma } from '../prisma';
import {
  buildRosterSnapshot,
  captureRosterSnapshot,
  parseSnapshotInducements,
  type TeamForSnapshot,
} from './cup-roster-snapshot';

const mockTeamFind = prisma.team.findUnique as unknown as ReturnType<
  typeof vi.fn
>;

const team: TeamForSnapshot = {
  roster: 'skaven',
  ruleset: 'season_3',
  format: 'bb11',
  teamValue: 1000,
  currentValue: 1000,
  treasury: 35_000,
  initialBudget: 1000,
  startingPspPool: 6,
  rerolls: 2,
  cheerleaders: 0,
  assistants: 0,
  apothecary: true,
  dedicatedFans: 1,
  players: [
    {
      name: 'Lineman 1',
      position: 'skaven_lineman',
      number: 1,
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: '',
      spp: 0,
      advancements: '[{"skillSlug":"block","type":"primary","isRandom":false,"at":1}]',
    },
  ],
  starPlayers: [{ starPlayerSlug: 'hakflem', cost: 250 }],
};

describe('buildRosterSnapshot', () => {
  it('capture les métadonnées, joueurs et star players', () => {
    const snap = buildRosterSnapshot(team, 42);
    expect(snap.capturedAt).toBe(42);
    expect(snap.roster).toBe('skaven');
    expect(snap.startingPspPool).toBe(6);
    // Trésorerie figée (en-tête de feuille de match au début du match).
    expect(snap.treasury).toBe(35_000);
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0].advancements).toContain('block');
    expect(snap.starPlayers[0]).toEqual({ starPlayerSlug: 'hakflem', cost: 250 });
  });

  it('produit un objet JSON-sérialisable stable', () => {
    const snap = buildRosterSnapshot(team, 42);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });
});

describe('captureRosterSnapshot — filtre des joueurs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTeamFind.mockResolvedValue({ ...team, players: [], starPlayers: [] });
  });

  it('exclut morts et licenciés par défaut, sans filtre missNextMatch (coupe)', async () => {
    await captureRosterSnapshot('team-1');
    const where = mockTeamFind.mock.calls[0][0].include.players.where;
    expect(where).toEqual({ dead: false, firedAt: null });
  });

  it('exclut AUSSI les absents avec excludeMissNextMatch (feuille de match)', async () => {
    await captureRosterSnapshot('team-1', { excludeMissNextMatch: true });
    const where = mockTeamFind.mock.calls[0][0].include.players.where;
    expect(where).toEqual({
      dead: false,
      firedAt: null,
      missNextMatch: false,
    });
  });
});

describe('coups de pouce de création dans le snapshot', () => {
  beforeEach(() => mockTeamFind.mockReset());

  it('fige les coups de pouce de l’équipe, nommés depuis le catalogue', async () => {
    mockTeamFind.mockResolvedValue({
      ...team,
      inducements: [
        { slug: 'team_mascot', quantity: 1, unitCost: 25_000 },
        { slug: 'bloodweiser_kegs', quantity: 2, unitCost: 50_000 },
      ],
    });

    const snap = await captureRosterSnapshot('t1');

    expect(snap?.inducements).toEqual([
      { slug: 'team_mascot', name: "Mascotte d'Équipe", quantity: 1, unitCost: 25_000 },
      // Slug absent du catalogue mocké : le libellé retombe sur le slug.
      { slug: 'bloodweiser_kegs', name: 'bloodweiser_kegs', quantity: 2, unitCost: 50_000 },
    ]);
    expect(mockTeamFind.mock.calls[0][0].include.inducements).toBe(true);
  });

  it('une équipe sans coup de pouce fige une liste vide', () => {
    expect(buildRosterSnapshot(team, 1).inducements).toEqual([]);
  });

  it('un snapshot antérieur (sans le champ) se lit « aucun coup de pouce »', () => {
    const legacy = { ...buildRosterSnapshot(team, 1) } as Record<string, unknown>;
    delete legacy.inducements;
    expect(parseSnapshotInducements(legacy)).toEqual([]);
    expect(parseSnapshotInducements(JSON.stringify(legacy))).toEqual([]);
    expect(parseSnapshotInducements('{pas du json')).toEqual([]);
    expect(parseSnapshotInducements(null)).toEqual([]);
  });

  it('relit les coups de pouce figés, objet natif ou chaîne', () => {
    const snap = buildRosterSnapshot(
      {
        ...team,
        inducements: [
          { slug: 'team_mascot', name: 'Mascotte', quantity: 1, unitCost: 25_000 },
        ],
      },
      1,
    );
    const expected = [
      { slug: 'team_mascot', name: 'Mascotte', quantity: 1, unitCost: 25_000 },
    ];
    expect(parseSnapshotInducements(snap)).toEqual(expected);
    expect(parseSnapshotInducements(JSON.stringify(snap))).toEqual(expected);
  });
});
