/**
 * Tests de la recherche transversale du journal : forme exacte du `where`
 * (y compris les branches par provider), enrichissement sans N+1, agrégats
 * et exports machine.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CSV_COLUMNS,
  MAX_SEARCH_PAGE_SIZE,
  MAX_TEAM_NAME_MATCHES,
  attachTeamContext,
  buildAdminAuditOrderBy,
  buildAdminAuditWhere,
  detectProviderCapabilities,
  escapeCsvField,
  resolveTeamIdFilter,
  searchTeamAuditEvents,
  summarizeAuditActivity,
  toCsv,
  toNdjson,
  type AdminAuditEventView,
  type ProviderCapabilities,
} from "./team-audit-search";
import type { TeamAuditEventRow } from "./team-audit-read";

const PG: ProviderCapabilities = {
  caseInsensitive: true,
  jsonContains: "string_contains",
};
const SQLITE: ProviderCapabilities = {
  caseInsensitive: false,
  jsonContains: "contains",
};

function row(overrides: Partial<TeamAuditEventRow> = {}): TeamAuditEventRow {
  return {
    id: "evt-1",
    teamId: "team-1",
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    correlationId: "req-1",
    step: 1,
    action: "team.purchase.player",
    entity: "Team",
    entityId: null,
    actorUserId: "coach-1",
    actorRole: "owner",
    actorLabel: "Nuffle",
    impersonatorId: null,
    source: "http",
    route: "POST /team/:id/purchase",
    ipAddress: "10.0.0.1",
    changes: '{"treasury":{"from":400000,"to":320000}}',
    before: null,
    after: null,
    details: '{"cost":80000}',
    treasury: 320_000,
    teamValue: 1_080_000,
    currentValue: 1_030_000,
    treasuryDelta: -80_000,
    teamValueDelta: 80_000,
    note: null,
    ...overrides,
  };
}

function makeDb(options: {
  rows?: TeamAuditEventRow[];
  total?: number;
  teams?: Array<Record<string, unknown>>;
  groups?: Array<Array<Record<string, unknown>>>;
} = {}) {
  const groupBy = vi.fn();
  for (const g of options.groups ?? []) groupBy.mockResolvedValueOnce(g);
  groupBy.mockResolvedValue([]);
  return {
    teamAuditEvent: {
      count: vi.fn().mockResolvedValue(options.total ?? (options.rows ?? []).length),
      findMany: vi.fn().mockResolvedValue(options.rows ?? []),
      groupBy,
    },
    team: { findMany: vi.fn().mockResolvedValue(options.teams ?? []) },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.TEST_SQLITE;
});

describe("detectProviderCapabilities", () => {
  it("active le mode insensible et string_contains hors sqlite (Postgres)", () => {
    expect(detectProviderCapabilities()).toEqual({
      caseInsensitive: true,
      jsonContains: "string_contains",
    });
  });

  it("désactive le mode insensible sur le miroir sqlite des tests", () => {
    process.env.TEST_SQLITE = "1";
    expect(detectProviderCapabilities()).toEqual({
      caseInsensitive: false,
      jsonContains: "contains",
    });
  });
});

describe("buildAdminAuditWhere", () => {
  it("rend un `where` vide sans filtre (toutes les équipes)", () => {
    expect(buildAdminAuditWhere({}, PG)).toEqual({});
  });

  it("applique les filtres d'égalité simples", () => {
    const where = buildAdminAuditWhere(
      {
        teamId: "t1",
        actorUserId: "u1",
        actorRole: "commissioner",
        source: "http",
        entity: "TeamPlayer",
        entityId: "p1",
        correlationId: "req-9",
      },
      PG,
    );
    expect(where).toMatchObject({
      teamId: "t1",
      actorUserId: "u1",
      actorRole: "commissioner",
      source: "http",
      entity: "TeamPlayer",
      entityId: "p1",
      correlationId: "req-9",
    });
  });

  it("fait primer l'action exacte sur le préfixe", () => {
    expect(
      buildAdminAuditWhere(
        { action: "team.purchase.player", actionPrefix: "team" },
        PG,
      ).action,
    ).toBe("team.purchase.player");
    expect(
      buildAdminAuditWhere({ actionPrefix: "team.purchase" }, PG).action,
    ).toEqual({ startsWith: "team.purchase" });
  });

  it("restreint aux équipes résolues en amont", () => {
    expect(buildAdminAuditWhere({}, PG, ["a", "b"]).teamId).toEqual({
      in: ["a", "b"],
    });
  });

  it("ignore la liste d'équipes quand une équipe précise est demandée", () => {
    expect(buildAdminAuditWhere({ teamId: "t1" }, PG, ["a"]).teamId).toBe("t1");
  });

  it("compose la fenêtre temporelle", () => {
    const since = new Date("2026-01-01");
    const until = new Date("2026-02-01");
    expect(buildAdminAuditWhere({ since, until }, PG).createdAt).toEqual({
      gte: since,
      lte: until,
    });
  });

  it("filtre les étapes en échec sur le suffixe du slug", () => {
    const and = buildAdminAuditWhere({ onlyFailed: true }, PG).AND as unknown[];
    expect(and).toContainEqual({ action: { endsWith: ".failed" } });
  });

  it("filtre les mutations faites en impersonation", () => {
    const and = buildAdminAuditWhere({ onlyImpersonated: true }, PG)
      .AND as unknown[];
    expect(and).toContainEqual({ impersonatorId: { not: null } });
  });

  it("teste les seuils dans LES DEUX sens (un gros crédit est aussi suspect)", () => {
    const and = buildAdminAuditWhere({ minAbsTreasuryDelta: 100_000 }, PG)
      .AND as Array<{ OR: unknown[] }>;
    expect(and[0].OR).toEqual([
      { treasuryDelta: { gte: 100_000 } },
      { treasuryDelta: { lte: -100_000 } },
    ]);
  });

  it("ignore un seuil nul ou négatif", () => {
    expect(buildAdminAuditWhere({ minAbsTreasuryDelta: 0 }, PG).AND).toBeUndefined();
    expect(
      buildAdminAuditWhere({ minAbsTeamValueDelta: -5 }, PG).AND,
    ).toBeUndefined();
  });

  it("cherche le texte libre sur les colonnes scalaires, en insensible sur PG", () => {
    const and = buildAdminAuditWhere({ q: "nuffle" }, PG).AND as Array<{
      OR: Array<Record<string, unknown>>;
    }>;
    expect(and[0].OR).toContainEqual({
      actorLabel: { contains: "nuffle", mode: "insensitive" },
    });
    expect(and[0].OR).toContainEqual({
      action: { contains: "nuffle", mode: "insensitive" },
    });
  });

  it("omet `mode` sur sqlite, qui ne le supporte pas", () => {
    const and = buildAdminAuditWhere({ q: "nuffle" }, SQLITE).AND as Array<{
      OR: Array<Record<string, unknown>>;
    }>;
    expect(and[0].OR).toContainEqual({ actorLabel: { contains: "nuffle" } });
    for (const clause of and[0].OR) {
      expect(JSON.stringify(clause)).not.toContain("insensitive");
    }
  });

  it("étend la recherche aux charges utiles avec l'opérateur du provider", () => {
    const pgOr = (
      buildAdminAuditWhere({ q: "80000", deep: true }, PG).AND as Array<{
        OR: Array<Record<string, unknown>>;
      }>
    )[0].OR;
    expect(pgOr).toContainEqual({ details: { string_contains: "80000" } });
    expect(pgOr).toContainEqual({ changes: { string_contains: "80000" } });

    const sqliteOr = (
      buildAdminAuditWhere({ q: "80000", deep: true }, SQLITE).AND as Array<{
        OR: Array<Record<string, unknown>>;
      }>
    )[0].OR;
    expect(sqliteOr).toContainEqual({ details: { contains: "80000" } });
  });

  it("ne cherche pas dans les charges utiles sans `deep`", () => {
    const or = (
      buildAdminAuditWhere({ q: "80000" }, PG).AND as Array<{
        OR: Array<Record<string, unknown>>;
      }>
    )[0].OR;
    expect(JSON.stringify(or)).not.toContain("details");
  });

  it("ignore un texte libre vide ou blanc", () => {
    expect(buildAdminAuditWhere({ q: "   " }, PG).AND).toBeUndefined();
  });
});

describe("buildAdminAuditOrderBy", () => {
  it("trie du plus récent au plus ancien par défaut", () => {
    expect(buildAdminAuditOrderBy()).toEqual([
      { createdAt: "desc" },
      { step: "desc" },
    ]);
  });

  it("propose un tri par impact pour faire remonter les gros mouvements", () => {
    expect(buildAdminAuditOrderBy("treasury-impact")[0]).toEqual({
      treasuryDelta: "desc",
    });
    expect(buildAdminAuditOrderBy("team-value-impact")[0]).toEqual({
      teamValueDelta: "desc",
    });
  });

  it("inverse l'ordre chronologique sur demande", () => {
    expect(buildAdminAuditOrderBy("oldest")).toEqual([
      { createdAt: "asc" },
      { step: "asc" },
    ]);
  });
});

describe("resolveTeamIdFilter", () => {
  it("rend null quand aucun filtre d'équipe n'est demandé (pas de restriction)", async () => {
    const db = makeDb();
    expect(await resolveTeamIdFilter(db, {}, PG)).toBeNull();
    expect(db.team.findMany).not.toHaveBeenCalled();
  });

  it("résout un nom d'équipe en liste d'ids, bornée", async () => {
    const db = makeDb({ teams: [{ id: "t1" }, { id: "t2" }] });
    expect(await resolveTeamIdFilter(db, { teamSearch: "rats" }, PG)).toEqual([
      "t1",
      "t2",
    ]);
    expect(db.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_TEAM_NAME_MATCHES }),
    );
  });

  it("distingue « rien ne matche » (liste vide) de « pas de filtre » (null)", async () => {
    const db = makeDb({ teams: [] });
    expect(await resolveTeamIdFilter(db, { teamSearch: "zzz" }, PG)).toEqual([]);
  });

  it("combine propriétaire et nom d'équipe", async () => {
    const db = makeDb({ teams: [{ id: "t1" }] });
    await resolveTeamIdFilter(db, { ownerId: "u1", teamSearch: "rats" }, PG);
    expect(db.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: "u1", name: { contains: "rats", mode: "insensitive" } },
      }),
    );
  });
});

describe("attachTeamContext", () => {
  it("joint le contexte en UN aller-retour, quel que soit le nombre de lignes", async () => {
    const db = makeDb({
      teams: [
        {
          id: "team-1",
          name: "Les Rats",
          ownerId: "u1",
          deletedAt: null,
          owner: { coachName: "Nuffle", email: "n@x.io" },
        },
      ],
    });
    const { toAuditEventView } = await import("./team-audit-read");
    const entries = [row(), row({ id: "e2" }), row({ id: "e3" })].map(
      toAuditEventView,
    );

    const enriched = await attachTeamContext(db, entries);

    expect(db.team.findMany).toHaveBeenCalledTimes(1);
    expect(db.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["team-1"] } } }),
    );
    expect(enriched[0].team).toEqual({
      teamId: "team-1",
      teamName: "Les Rats",
      ownerId: "u1",
      ownerLabel: "Nuffle",
      teamDeleted: false,
    });
  });

  it("sert l'étape avec un contexte null si l'équipe a été purgée", async () => {
    const db = makeDb({ teams: [] });
    const { toAuditEventView } = await import("./team-audit-read");
    const enriched = await attachTeamContext(db, [toAuditEventView(row())]);
    expect(enriched).toHaveLength(1);
    expect(enriched[0].team).toBeNull();
  });

  it("marque une équipe supprimée en soft delete", async () => {
    const db = makeDb({
      teams: [
        {
          id: "team-1",
          name: "Les Rats",
          ownerId: "u1",
          deletedAt: new Date(),
          owner: { coachName: null, email: "n@x.io" },
        },
      ],
    });
    const { toAuditEventView } = await import("./team-audit-read");
    const enriched = await attachTeamContext(db, [toAuditEventView(row())]);
    expect(enriched[0].team?.teamDeleted).toBe(true);
    // Repli sur l'e-mail quand le coach n'a pas de nom.
    expect(enriched[0].team?.ownerLabel).toBe("n@x.io");
  });

  it("rend une liste vide sur une page vide, sans requête", async () => {
    const db = makeDb();
    expect(await attachTeamContext(db, [])).toEqual([]);
    expect(db.team.findMany).not.toHaveBeenCalled();
  });
});

describe("searchTeamAuditEvents", () => {
  it("borne la taille de page", async () => {
    const db = makeDb({ rows: [] });
    await searchTeamAuditEvents(db, { limit: 99_999 }, PG);
    expect(db.teamAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_SEARCH_PAGE_SIZE }),
    );
  });

  it("court-circuite sans requête quand le filtre d'équipe ne matche rien", async () => {
    const db = makeDb({ teams: [] });
    const page = await searchTeamAuditEvents(db, { teamSearch: "zzz" }, PG);
    expect(page).toEqual({ total: 0, limit: 50, offset: 0, entries: [] });
    expect(db.teamAuditEvent.findMany).not.toHaveBeenCalled();
  });

  it("rend une page enrichie avec le total non tronqué", async () => {
    const db = makeDb({
      rows: [row()],
      total: 1_234,
      teams: [
        {
          id: "team-1",
          name: "Les Rats",
          ownerId: "u1",
          deletedAt: null,
          owner: { coachName: "Nuffle" },
        },
      ],
    });
    const page = await searchTeamAuditEvents(db, {}, PG);
    expect(page.total).toBe(1_234);
    expect(page.entries[0].team?.teamName).toBe("Les Rats");
    expect(page.entries[0].summary).toContain("Achat d'un joueur");
  });
});

describe("summarizeAuditActivity", () => {
  it("agrège par action, par rôle et par équipe, avec les nets", async () => {
    const db = makeDb({
      groups: [
        [
          {
            action: "team.purchase.player",
            _count: { _all: 3 },
            _sum: { treasuryDelta: -240_000, teamValueDelta: 0 },
          },
          {
            action: "league.patron.bonus",
            _count: { _all: 1 },
            _sum: { treasuryDelta: 100_000, teamValueDelta: 0 },
          },
        ],
        [
          {
            actorRole: "owner",
            _count: { _all: 4 },
            _sum: { treasuryDelta: -140_000, teamValueDelta: 0 },
          },
        ],
        [
          {
            teamId: "team-1",
            _count: { _all: 4 },
            _sum: { treasuryDelta: -140_000, teamValueDelta: 0 },
          },
        ],
      ],
    });

    const summary = await summarizeAuditActivity(db, {}, PG);
    expect(summary.totalEvents).toBe(4);
    expect(summary.netTreasuryDelta).toBe(-140_000);
    expect(summary.byAction[0]).toEqual({
      key: "team.purchase.player",
      count: 3,
      treasuryDelta: -240_000,
      teamValueDelta: 0,
    });
    expect(summary.byActorRole[0].key).toBe("owner");
    expect(summary.byTeam[0].key).toBe("team-1");
  });

  it("tolère des sommes nulles (aucune étape économique dans le groupe)", async () => {
    const db = makeDb({
      groups: [
        [
          {
            action: "team.player.identity.update",
            _count: { _all: 2 },
            _sum: { treasuryDelta: null, teamValueDelta: null },
          },
        ],
      ],
    });
    const summary = await summarizeAuditActivity(db, {}, PG);
    expect(summary.byAction[0].treasuryDelta).toBe(0);
    expect(summary.netTreasuryDelta).toBe(0);
  });

  it("rend des agrégats vides quand le filtre d'équipe ne matche rien", async () => {
    const db = makeDb({ teams: [] });
    const summary = await summarizeAuditActivity(db, { teamSearch: "zzz" }, PG);
    expect(summary.totalEvents).toBe(0);
    expect(db.teamAuditEvent.groupBy).not.toHaveBeenCalled();
  });
});

describe("escapeCsvField", () => {
  it("cite les champs qui contiennent un séparateur, un guillemet ou un saut de ligne", () => {
    expect(escapeCsvField("simple")).toBe("simple");
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('il a dit "non"')).toBe('"il a dit ""non"""');
    expect(escapeCsvField("ligne1\nligne2")).toBe('"ligne1\nligne2"');
  });

  it("neutralise l'injection de formule (un libellé vient d'une saisie)", () => {
    expect(escapeCsvField("=1+1")).toBe("'=1+1");
    expect(escapeCsvField("+33600000000")).toBe("'+33600000000");
    expect(escapeCsvField("@SUM(A1)")).toBe("'@SUM(A1)");
    // Le `-` d'un nombre négatif reste un nombre : c'est la CHAÎNE qui est
    // préfixée, pas la valeur numérique.
    expect(escapeCsvField(-80_000)).toBe("-80000");
  });

  it("rend une cellule vide pour null / undefined", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
});

describe("toCsv / toNdjson", () => {
  function view(overrides: Partial<AdminAuditEventView> = {}) {
    return {
      id: "e1",
      teamId: "team-1",
      createdAt: "2026-08-01T10:00:00.000Z",
      correlationId: "req-1",
      step: 1,
      action: "team.purchase.player",
      entity: "Team",
      entityId: null,
      actorUserId: "coach-1",
      actorRole: "owner",
      actorLabel: "Nuffle",
      impersonatorId: null,
      source: "http",
      route: "POST /team/:id/purchase",
      ipAddress: "10.0.0.1",
      changes: { treasury: { from: 400_000, to: 320_000 } },
      before: null,
      after: null,
      details: { cost: 80_000 },
      treasury: 320_000,
      teamValue: 1_080_000,
      currentValue: 1_030_000,
      treasuryDelta: -80_000,
      teamValueDelta: 80_000,
      note: null,
      summary: "Achat d'un joueur par Nuffle",
      team: {
        teamId: "team-1",
        teamName: "Les Rats",
        ownerId: "u1",
        ownerLabel: "Nuffle",
        teamDeleted: false,
      },
      ...overrides,
    } as AdminAuditEventView;
  }

  it("écrit un en-tête puis une ligne par étape", () => {
    const csv = toCsv([view()]);
    const [header, line] = csv.split("\n");
    expect(header).toBe(CSV_COLUMNS.join(","));
    expect(line).toContain("Les Rats");
    // Montants en po BRUTS : un export sert à calculer, pas à lire.
    expect(line).toContain("-80000");
    expect(line).toContain("320000");
  });

  it("sérialise les colonnes structurées en JSON cité", () => {
    const line = toCsv([view()]).split("\n")[1];
    expect(line).toContain('"{""treasury"":{""from"":400000,""to"":320000}}"');
  });

  it("laisse les colonnes d'équipe vides quand l'équipe est purgée", () => {
    const line = toCsv([view({ team: null })]).split("\n")[1];
    expect(line.split(",")[4]).toBe("");
  });

  it("rend un en-tête seul pour un export vide", () => {
    expect(toCsv([])).toBe(CSV_COLUMNS.join(","));
  });

  it("écrit un JSON complet et indépendant par ligne en NDJSON", () => {
    const ndjson = toNdjson([view(), view({ id: "e2" })]);
    const lines = ndjson.split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe("e1");
    expect(JSON.parse(lines[1]).details).toEqual({ cost: 80_000 });
  });

  it("rend une chaîne vide pour un NDJSON sans étape", () => {
    expect(toNdjson([])).toBe("");
  });
});
