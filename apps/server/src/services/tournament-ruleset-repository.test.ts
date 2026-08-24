/**
 * Repository des règlements de tournoi : parsing tolérant (objet natif PG
 * vs string sérialisée SQLite), résolution DB → fallback registre statique,
 * sémantique d'archivage (refusé pour une nouvelle sélection, résolu pour
 * une entité existante), labels batchés, listing fusionné DB + statique.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prisma', () => ({
  prisma: {
    tournamentRuleset: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('../utils/server-log', () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import { NAF_WORLD_CUP_2027 } from '@bb/game-engine';
import { prisma } from '../prisma';
import {
  parseTournamentRulesetRow,
  serializeDefinitionForDb,
  getTournamentRulesetRecord,
  resolveTournamentRulesetSelection,
  getTournamentRulesetLabels,
  listTournamentRulesetSummaries,
  type TournamentRulesetRow,
} from './tournament-ruleset-repository';
import { seedTournamentRulesets } from '../scripts/seed-tournament-rulesets';

const findUnique = prisma.tournamentRuleset
  .findUnique as unknown as ReturnType<typeof vi.fn>;
const findMany = prisma.tournamentRuleset
  .findMany as unknown as ReturnType<typeof vi.fn>;

/** Ligne DB valide au format miroir SQLite (Json = strings sérialisées). */
function sqliteRow(over: Partial<TournamentRulesetRow> = {}): TournamentRulesetRow {
  return {
    id: 'tr-1',
    slug: 'coupe_maison',
    nameFr: 'Coupe Maison 2027',
    nameEn: 'House Cup 2027',
    shortLabel: 'Coupe Maison',
    version: 'V1',
    edition: 'season_3',
    format: 'bb11',
    descriptionFr: 'Règlement maison.',
    resurrection: true,
    minRegularPlayersBeforeStars: 11,
    rosterRules: JSON.stringify({
      orc: {
        goldBudget: 1100,
        sppBudget: 50,
        skillStacking: 'one_player',
        starPlayersAllowed: true,
      },
    }),
    skillCosts: JSON.stringify({
      firstPrimary: 6,
      firstSecondary: 10,
      secondPrimary: 8,
      secondSecondary: 12,
      eliteSurcharge: 2,
    }),
    eliteSkills: JSON.stringify(['dodge']),
    bannedStarPlayers: JSON.stringify(['morg_n_thorg']),
    starPlayerSppTax: JSON.stringify([
      { maxTotalCostK: 199, spp: 18 },
      { maxTotalCostK: null, spp: 32 },
    ]),
    allowedInducements: JSON.stringify([{ slug: 'bribe', cost: 100000 }]),
    scoring: JSON.stringify({ win: 5, draw: 2, loss: 0, concession: -5 }),
    archivedAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('parseTournamentRulesetRow', () => {
  it('parse une ligne SQLite (Json en strings sérialisées)', () => {
    const def = parseTournamentRulesetRow(sqliteRow());
    expect(def).not.toBeNull();
    expect(def!.rosterRules.orc.goldBudget).toBe(1100);
    expect(def!.rosterRules.orc.skillStacking).toBe('one_player');
    expect(def!.skillCosts.firstSecondary).toBe(10);
    expect(def!.eliteSkills).toEqual(['dodge']);
    expect(def!.bannedStarPlayers).toEqual(['morg_n_thorg']);
    // maxTotalCostK: null → tranche ouverte (Infinity).
    expect(def!.starPlayerSppTax[1].maxTotalCostK).toBe(
      Number.POSITIVE_INFINITY,
    );
    expect(def!.scoring).toEqual({ win: 5, draw: 2, loss: 0, concession: -5 });
  });

  it('parse une ligne PG (Json en objets natifs)', () => {
    const def = parseTournamentRulesetRow(
      sqliteRow({
        rosterRules: {
          skaven: {
            goldBudget: 1080,
            sppBudget: 44,
            skillStacking: 'none',
            starPlayersAllowed: false,
          },
        },
        skillCosts: {
          firstPrimary: 6,
          firstSecondary: 10,
          secondPrimary: 8,
          secondSecondary: 12,
          eliteSurcharge: 2,
        },
        starPlayerSppTax: [{ maxTotalCostK: 299, spp: 24 }],
      }),
    );
    expect(def).not.toBeNull();
    expect(def!.rosterRules.skaven.sppBudget).toBe(44);
    expect(def!.starPlayerSppTax[0].maxTotalCostK).toBe(299);
  });

  it('renvoie null si rosterRules ou skillCosts sont illisibles', () => {
    expect(
      parseTournamentRulesetRow(sqliteRow({ rosterRules: 'pas du json' })),
    ).toBeNull();
    expect(
      parseTournamentRulesetRow(sqliteRow({ skillCosts: '{"firstPrimary":-1}' })),
    ).toBeNull();
  });

  it('ignore les entrées de roster invalides mais garde les valides', () => {
    const def = parseTournamentRulesetRow(
      sqliteRow({
        rosterRules: JSON.stringify({
          orc: {
            goldBudget: 1100,
            sppBudget: 50,
            skillStacking: 'none',
            starPlayersAllowed: false,
          },
          casse: { goldBudget: -5, sppBudget: 'x' },
        }),
      }),
    );
    expect(def).not.toBeNull();
    expect(Object.keys(def!.rosterRules)).toEqual(['orc']);
  });
});

describe('serializeDefinitionForDb ↔ parseTournamentRulesetRow', () => {
  it('round-trip fidèle sur le NAF World Cup 2027 (Infinity ↔ null)', () => {
    const data = serializeDefinitionForDb(NAF_WORLD_CUP_2027);
    const parsed = parseTournamentRulesetRow({
      ...(data as unknown as TournamentRulesetRow),
      id: 'x',
      descriptionFr: NAF_WORLD_CUP_2027.descriptionFr,
      archivedAt: null,
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.rosterRules).toEqual(NAF_WORLD_CUP_2027.rosterRules);
    expect(parsed!.skillCosts).toEqual(NAF_WORLD_CUP_2027.skillCosts);
    expect(parsed!.bannedStarPlayers).toEqual(
      NAF_WORLD_CUP_2027.bannedStarPlayers,
    );
    expect(parsed!.starPlayerSppTax).toEqual(NAF_WORLD_CUP_2027.starPlayerSppTax);
    expect(parsed!.scoring).toEqual(NAF_WORLD_CUP_2027.scoring);
  });
});

describe('getTournamentRulesetRecord', () => {
  it('résout une ligne DB (archivée incluse)', async () => {
    findUnique.mockResolvedValue(sqliteRow({ archivedAt: new Date() }));
    const record = await getTournamentRulesetRecord('coupe_maison');
    expect(record).not.toBeNull();
    expect(record!.source).toBe('db');
    expect(record!.archived).toBe(true);
    expect(record!.def.shortLabel).toBe('Coupe Maison');
  });

  it('retombe sur le registre statique quand le slug est absent de la DB', async () => {
    findUnique.mockResolvedValue(null);
    const record = await getTournamentRulesetRecord('naf_world_cup_2027');
    expect(record).not.toBeNull();
    expect(record!.source).toBe('static');
    expect(record!.archived).toBe(false);
  });

  it('retombe sur le statique si la ligne DB est illisible', async () => {
    findUnique.mockResolvedValue(
      sqliteRow({ slug: 'naf_world_cup_2027', rosterRules: 'corrompu' }),
    );
    const record = await getTournamentRulesetRecord('naf_world_cup_2027');
    expect(record!.source).toBe('static');
  });

  it('retombe sur le statique si la lecture DB échoue (env non migré)', async () => {
    findUnique.mockRejectedValue(new Error('no such table'));
    const record = await getTournamentRulesetRecord('naf_world_cup_2027');
    expect(record!.source).toBe('static');
  });

  it('null pour un slug inconnu des deux sources', async () => {
    findUnique.mockResolvedValue(null);
    expect(await getTournamentRulesetRecord('inconnu')).toBeNull();
  });
});

describe('resolveTournamentRulesetSelection', () => {
  it('null/vide = aucun règlement', async () => {
    expect(await resolveTournamentRulesetSelection(null)).toEqual({
      ok: true,
      def: null,
    });
    expect(await resolveTournamentRulesetSelection('')).toEqual({
      ok: true,
      def: null,
    });
    expect(await resolveTournamentRulesetSelection(undefined)).toEqual({
      ok: true,
      def: null,
    });
  });

  it('refuse un slug inconnu', async () => {
    findUnique.mockResolvedValue(null);
    const res = await resolveTournamentRulesetSelection('inconnu');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/inconnu/);
  });

  it('refuse un règlement archivé pour une nouvelle sélection', async () => {
    findUnique.mockResolvedValue(sqliteRow({ archivedAt: new Date() }));
    const res = await resolveTournamentRulesetSelection('coupe_maison');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/archivé/);
  });

  it('accepte un règlement DB actif', async () => {
    findUnique.mockResolvedValue(sqliteRow());
    const res = await resolveTournamentRulesetSelection('coupe_maison');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.def?.slug).toBe('coupe_maison');
  });
});

describe('getTournamentRulesetLabels', () => {
  it('batch DB + fallback statique + slug brut', async () => {
    findMany.mockResolvedValue([
      { slug: 'coupe_maison', shortLabel: 'Coupe Maison' },
    ]);
    const labels = await getTournamentRulesetLabels([
      'coupe_maison',
      'naf_world_cup_2027',
      'inconnu',
      null,
      undefined,
    ]);
    expect(labels.get('coupe_maison')).toBe('Coupe Maison');
    expect(labels.get('naf_world_cup_2027')).toBe('NAF World Cup 2027');
    expect(labels.get('inconnu')).toBe('inconnu');
    expect(labels.size).toBe(3);
  });

  it('aucun slug → aucune requête DB', async () => {
    const labels = await getTournamentRulesetLabels([null, undefined]);
    expect(labels.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('listTournamentRulesetSummaries', () => {
  it('fusionne DB + statique (la DB prime par slug) et masque les archivés', async () => {
    findMany.mockResolvedValue([
      sqliteRow({
        slug: 'naf_world_cup_2027',
        nameFr: 'NAF WC (édité admin)',
      }),
      sqliteRow({ id: 'tr-2', slug: 'archive_pack', archivedAt: new Date() }),
    ]);
    const list = await listTournamentRulesetSummaries();
    const slugs = list.map((s) => s.slug);
    expect(slugs).toContain('naf_world_cup_2027');
    expect(slugs).not.toContain('archive_pack');
    const naf = list.find((s) => s.slug === 'naf_world_cup_2027');
    expect(naf?.source).toBe('db');
    expect(naf?.nameFr).toBe('NAF WC (édité admin)');
  });

  it('includeArchived expose aussi les archivés (vue admin)', async () => {
    findMany.mockResolvedValue([
      sqliteRow({ slug: 'archive_pack', archivedAt: new Date() }),
    ]);
    const list = await listTournamentRulesetSummaries({
      includeArchived: true,
    });
    expect(list.map((s) => s.slug)).toContain('archive_pack');
  });

  it('DB vide : le registre statique reste proposé', async () => {
    findMany.mockResolvedValue([]);
    const list = await listTournamentRulesetSummaries();
    expect(list.map((s) => s.slug)).toContain('naf_world_cup_2027');
    expect(list.find((s) => s.slug === 'naf_world_cup_2027')?.source).toBe(
      'static',
    );
  });
});

describe('seedTournamentRulesets', () => {
  it('create-only : crée les manquants, ne réécrit jamais les existants', async () => {
    const create = prisma.tournamentRuleset
      .create as unknown as ReturnType<typeof vi.fn>;
    findUnique.mockResolvedValue(null);
    create.mockResolvedValue({ id: 'tr-1' });

    const first = await seedTournamentRulesets();
    expect(first.created).toBe(first.packs);
    expect(first.skipped).toBe(0);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'naf_world_cup_2027' }),
      }),
    );

    vi.resetAllMocks();
    findUnique.mockResolvedValue({ id: 'tr-1' });
    const second = await seedTournamentRulesets();
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(second.packs);
    expect(create).not.toHaveBeenCalled();
  });
});
