/**
 * Tests de l'endpoint de lecture du journal d'équipe : parsing des filtres,
 * contrôle d'accès (coach / admin / commissaire) et masquage de l'IP.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    leagueParticipant: { findFirst: vi.fn() },
    teamAuditEvent: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() },
}));

import { prisma } from "../prisma";
import {
  handleGetTeamJournal,
  parseTeamAuditQuery,
  redactForNonAdmin,
  resolveJournalAccess,
} from "./team-audit-handlers";
import { MAX_AUDIT_PAGE_SIZE } from "../services/team-audit-read";
import type { TeamAuditEventView } from "../services/team-audit-read";

const db = prisma as unknown as {
  team: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
  leagueParticipant: { findFirst: ReturnType<typeof vi.fn> };
  teamAuditEvent: {
    count: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

function makeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("parseTeamAuditQuery", () => {
  it("applique les défauts sur une query vide", () => {
    expect(parseTeamAuditQuery("t1", {})).toMatchObject({
      teamId: "t1",
      offset: 0,
      actionPrefix: null,
      actorUserId: null,
      onlyEconomic: false,
      since: null,
      until: null,
    });
  });

  it("borne `limit` au plafond de page", () => {
    expect(parseTeamAuditQuery("t1", { limit: "9999" }).limit).toBe(
      MAX_AUDIT_PAGE_SIZE,
    );
    expect(parseTeamAuditQuery("t1", { limit: "0" }).limit).toBe(1);
  });

  it("lit les filtres et accepte `economic` sous ses deux formes", () => {
    const parsed = parseTeamAuditQuery("t1", {
      action: "team.purchase",
      actor: "u9",
      economic: "true",
      since: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.actionPrefix).toBe("team.purchase");
    expect(parsed.actorUserId).toBe("u9");
    expect(parsed.onlyEconomic).toBe(true);
    expect(parsed.since?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(parseTeamAuditQuery("t1", { economic: "1" }).onlyEconomic).toBe(true);
  });

  it("ignore une date invalide plutôt que de produire un `Invalid Date`", () => {
    expect(parseTeamAuditQuery("t1", { since: "pas-une-date" }).since).toBeNull();
  });
});

describe("resolveJournalAccess", () => {
  it("autorise le coach propriétaire, sans détail admin", async () => {
    db.team.findUnique.mockResolvedValue({ ownerId: "u1", name: "Les Rats" });
    db.user.findUnique.mockResolvedValue({ role: "user", roles: ["user"] });

    const access = await resolveJournalAccess(prisma as never, "t1", "u1");
    expect(access).toEqual({ allowed: true, isAdmin: false, teamName: "Les Rats" });
    expect(db.leagueParticipant.findFirst).not.toHaveBeenCalled();
  });

  it("autorise un admin sur l'équipe d'un autre, avec le détail admin", async () => {
    db.team.findUnique.mockResolvedValue({ ownerId: "u1", name: "Les Rats" });
    db.user.findUnique.mockResolvedValue({ roles: ["admin"] });

    const access = await resolveJournalAccess(prisma as never, "t1", "u2");
    expect(access.allowed).toBe(true);
    expect(access.isAdmin).toBe(true);
  });

  it("autorise le commissaire d'une ligue où l'équipe est inscrite", async () => {
    db.team.findUnique.mockResolvedValue({ ownerId: "u1", name: "Les Rats" });
    db.user.findUnique.mockResolvedValue({ roles: ["user"] });
    db.leagueParticipant.findFirst.mockResolvedValue({ id: "lp1" });

    const access = await resolveJournalAccess(prisma as never, "t1", "commish");
    expect(access.allowed).toBe(true);
    expect(access.isAdmin).toBe(false);
  });

  it("refuse un tiers sans lien avec l'équipe", async () => {
    db.team.findUnique.mockResolvedValue({ ownerId: "u1", name: "Les Rats" });
    db.user.findUnique.mockResolvedValue({ roles: ["user"] });
    db.leagueParticipant.findFirst.mockResolvedValue(null);

    expect((await resolveJournalAccess(prisma as never, "t1", "u3")).allowed).toBe(
      false,
    );
  });

  it("refuse sur une équipe inexistante sans interroger les rôles", async () => {
    db.team.findUnique.mockResolvedValue(null);
    const access = await resolveJournalAccess(prisma as never, "nope", "u1");
    expect(access.allowed).toBe(false);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("redactForNonAdmin", () => {
  it("retire l'IP de l'acteur et laisse le reste intact", () => {
    const entry = {
      id: "e1",
      ipAddress: "10.0.0.1",
      actorLabel: "Nuffle",
      treasury: 1,
    } as unknown as TeamAuditEventView;
    const redacted = redactForNonAdmin(entry);
    expect(redacted.ipAddress).toBeNull();
    expect(redacted.actorLabel).toBe("Nuffle");
    expect(redacted.treasury).toBe(1);
  });
});

describe("handleGetTeamJournal", () => {
  it("répond 404 quand le lecteur n'a pas accès", async () => {
    db.team.findUnique.mockResolvedValue({ ownerId: "u1", name: "T" });
    db.user.findUnique.mockResolvedValue({ roles: ["user"] });
    db.leagueParticipant.findFirst.mockResolvedValue(null);

    const res = makeRes();
    await handleGetTeamJournal(
      { params: { id: "t1" }, query: {}, user: { id: "u3" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(404);
  });

  it("sert la page et masque l'IP pour un coach", async () => {
    db.team.findUnique.mockResolvedValue({ ownerId: "u1", name: "Les Rats" });
    db.user.findUnique.mockResolvedValue({ roles: ["user"] });
    db.teamAuditEvent.count.mockResolvedValue(1);
    db.teamAuditEvent.findMany.mockResolvedValue([
      {
        id: "e1",
        teamId: "t1",
        createdAt: new Date("2026-08-01T10:00:00.000Z"),
        correlationId: "req-1",
        step: 1,
        action: "team.purchase.player",
        entity: "Team",
        entityId: null,
        actorUserId: "u1",
        actorRole: "owner",
        actorLabel: "Nuffle",
        impersonatorId: null,
        source: "http",
        route: "POST /team/:id/purchase",
        ipAddress: "10.0.0.1",
        changes: null,
        before: null,
        after: null,
        details: null,
        treasury: 320_000,
        teamValue: null,
        currentValue: null,
        treasuryDelta: -80_000,
        teamValueDelta: null,
        note: null,
      },
    ]);

    const res = makeRes();
    await handleGetTeamJournal(
      { params: { id: "t1" }, query: {}, user: { id: "u1" } } as never,
      res as never,
    );

    const body = res.body as {
      data: { total: number; teamName: string; entries: TeamAuditEventView[] };
    };
    expect(res.statusCode).toBe(200);
    expect(body.data.total).toBe(1);
    expect(body.data.teamName).toBe("Les Rats");
    expect(body.data.entries[0].ipAddress).toBeNull();
    expect(body.data.entries[0].summary).toContain("Achat d'un joueur");
  });

  it("répond 500 sans faire fuiter l'erreur interne", async () => {
    db.team.findUnique.mockRejectedValue(new Error("db down"));
    const res = makeRes();
    await handleGetTeamJournal(
      { params: { id: "t1" }, query: {}, user: { id: "u1" } } as never,
      res as never,
    );
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("db down");
  });
});
