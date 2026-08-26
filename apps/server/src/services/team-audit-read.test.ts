/**
 * Tests du journal d'équipe (lecture) : parsing tolérant PG/sqlite,
 * résumés français, construction du `where`, pagination bornée.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_AUDIT_PAGE_SIZE,
  MAX_AUDIT_PAGE_SIZE,
  buildTeamAuditWhere,
  listTeamAuditEvents,
  parseJsonColumn,
  summarizeAuditEvent,
  toAuditEventView,
  type TeamAuditEventRow,
} from "./team-audit-read";

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
    before: '{"treasury":400000}',
    after: '{"treasury":320000}',
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("parseJsonColumn", () => {
  it("accepte la chaîne (miroir sqlite) et l'objet natif (Postgres)", () => {
    expect(parseJsonColumn('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonColumn({ a: 1 })).toEqual({ a: 1 });
  });

  it("rend null sur vide, null, ou JSON invalide plutôt que de jeter", () => {
    expect(parseJsonColumn(null)).toBeNull();
    expect(parseJsonColumn(undefined)).toBeNull();
    expect(parseJsonColumn("")).toBeNull();
    expect(parseJsonColumn("{cassé")).toBeNull();
    expect(parseJsonColumn(42)).toBeNull();
  });
});

describe("summarizeAuditEvent", () => {
  it("nomme l'action, l'auteur et les deux deltas économiques", () => {
    const summary = summarizeAuditEvent(row());
    expect(summary).toContain("Achat d'un joueur");
    expect(summary).toContain("par Nuffle");
    expect(summary).toContain("trésorerie -80k po");
    expect(summary).toContain("VE +80k po");
  });

  it("retombe sur le rôle quand l'acteur n'a pas de libellé", () => {
    expect(
      summarizeAuditEvent(
        row({ actorLabel: null, actorRole: "system", treasuryDelta: 0, teamValueDelta: 0 }),
      ),
    ).toBe("Achat d'un joueur par système");
  });

  it("rend le slug brut pour une action encore sans libellé", () => {
    const summary = summarizeAuditEvent(
      row({ action: "team.nouvelle.action", treasuryDelta: 0, teamValueDelta: 0 }),
    );
    expect(summary).toBe("team.nouvelle.action par Nuffle");
  });

  it("marque explicitement les étapes en échec", () => {
    const summary = summarizeAuditEvent(
      row({
        action: "team.purchase.player.failed",
        treasuryDelta: 0,
        teamValueDelta: 0,
      }),
    );
    expect(summary).toContain("Achat d'un joueur (échec)");
  });

  it("n'affiche aucun delta quand rien n'a bougé", () => {
    const summary = summarizeAuditEvent(
      row({ treasuryDelta: 0, teamValueDelta: null }),
    );
    expect(summary).not.toContain("(");
  });
});

describe("toAuditEventView", () => {
  it("parse les colonnes JSON, normalise la date et calcule le résumé", () => {
    const view = toAuditEventView(row());
    expect(view.createdAt).toBe("2026-08-01T10:00:00.000Z");
    expect(view.changes).toEqual({ treasury: { from: 400_000, to: 320_000 } });
    expect(view.details).toEqual({ cost: 80_000 });
    expect(view.summary).toContain("Achat d'un joueur");
  });
});

describe("buildTeamAuditWhere", () => {
  it("filtre au minimum sur l'équipe", () => {
    expect(buildTeamAuditWhere({ teamId: "t1" })).toEqual({ teamId: "t1" });
  });

  it("compose préfixe d'action, acteur et fenêtre temporelle", () => {
    const since = new Date("2026-01-01");
    const until = new Date("2026-02-01");
    expect(
      buildTeamAuditWhere({
        teamId: "t1",
        actionPrefix: "team.purchase",
        actorUserId: "u1",
        since,
        until,
      }),
    ).toEqual({
      teamId: "t1",
      action: { startsWith: "team.purchase" },
      actorUserId: "u1",
      createdAt: { gte: since, lte: until },
    });
  });

  it("`onlyEconomic` ne garde que les étapes qui ont bougé l'or ou la VE", () => {
    expect(buildTeamAuditWhere({ teamId: "t1", onlyEconomic: true }).OR).toEqual([
      { treasuryDelta: { not: 0 } },
      { teamValueDelta: { not: 0 } },
    ]);
  });
});

describe("listTeamAuditEvents", () => {
  function makeDb(rows: TeamAuditEventRow[], total = rows.length) {
    return {
      teamAuditEvent: {
        count: vi.fn().mockResolvedValue(total),
        findMany: vi.fn().mockResolvedValue(rows),
      },
    };
  }

  it("rend la page la plus récente d'abord, avec le total", async () => {
    const db = makeDb([row(), row({ id: "evt-2", step: 2 })], 12);
    const page = await listTeamAuditEvents(db, { teamId: "team-1" });

    expect(page.total).toBe(12);
    expect(page.entries).toHaveLength(2);
    expect(db.teamAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { step: "desc" }],
        skip: 0,
        take: DEFAULT_AUDIT_PAGE_SIZE,
      }),
    );
  });

  it("borne la taille de page et refuse un offset négatif", async () => {
    const db = makeDb([]);
    await listTeamAuditEvents(db, { teamId: "t", limit: 10_000, offset: -5 });
    expect(db.teamAuditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_AUDIT_PAGE_SIZE, skip: 0 }),
    );
  });
});
