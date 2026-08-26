/**
 * Tests du journal d'équipe (écriture) : capture d'état, diff, corrélation
 * des étapes, résilience, coupe-circuit.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureTeamState,
  countAdvancements,
  diffTeamState,
  recordTeamAudit,
  safeRecordTeamAudit,
  withTeamAudit,
  type TeamStateSnapshot,
} from "./team-audit";
import {
  createAuditContext,
  resolveActorRole,
  runWithAuditContext,
} from "../utils/audit-context";

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn() },
}));

function makeDb(team: Record<string, unknown> | null = teamRow()) {
  return {
    team: { findUnique: vi.fn().mockResolvedValue(team) },
    teamAuditEvent: { create: vi.fn().mockResolvedValue({}) },
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ coachName: "Nuffle", email: "n@x.io" }),
    },
  };
}

function teamRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    ownerId: "coach-1",
    name: "Les Rats",
    roster: "skaven",
    ruleset: "season_3",
    format: "bb11",
    treasury: 400_000,
    teamValue: 1_000_000,
    currentValue: 950_000,
    initialBudget: 1_000,
    rerolls: 2,
    cheerleaders: 1,
    assistants: 0,
    apothecary: true,
    dedicatedFans: 2,
    startingPspPool: 0,
    deletedAt: null,
    players: [
      {
        id: "p1",
        name: "Skitter",
        position: "gutter_runner",
        number: 1,
        spp: 12,
        dead: false,
        firedAt: null,
        missNextMatch: false,
        nigglingInjuries: 0,
        advancements: '[{"type":"primary"}]',
      },
      {
        id: "p2",
        name: "Feu",
        position: "lineman",
        number: 2,
        spp: 0,
        dead: true,
        firedAt: null,
        missNextMatch: false,
        nigglingInjuries: 1,
        advancements: "[]",
      },
    ],
    starPlayers: [{ id: "sp1", cost: 250_000 }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.TEAM_AUDIT_DISABLED;
});

describe("countAdvancements", () => {
  it("compte un CSV JSON, un tableau natif, et tolère les formes cassées", () => {
    expect(countAdvancements('[{"type":"primary"},{"type":"secondary"}]')).toBe(2);
    expect(countAdvancements([1, 2, 3])).toBe(3);
    expect(countAdvancements("pas du json")).toBe(0);
    expect(countAdvancements(null)).toBe(0);
    expect(countAdvancements('{"pas":"un tableau"}')).toBe(0);
  });
});

describe("captureTeamState", () => {
  it("projette l'équipe, ses joueurs et ses Star Players", async () => {
    const db = makeDb();
    const snap = await captureTeamState(db, "team-1");

    expect(snap).not.toBeNull();
    expect(snap!.treasury).toBe(400_000);
    expect(snap!.teamValue).toBe(1_000_000);
    expect(snap!.currentValue).toBe(950_000);
    expect(snap!.totalPlayerCount).toBe(2);
    // Le mort ne compte pas dans les actifs (ceux qui portent la VE).
    expect(snap!.activePlayerCount).toBe(1);
    expect(snap!.starPlayerCount).toBe(1);
    expect(snap!.starPlayersCost).toBe(250_000);
    expect(snap!.players[0]).toMatchObject({
      id: "p1",
      name: "Skitter",
      spp: 12,
      advancements: 1,
    });
  });

  it("rend null si l'équipe n'existe pas", async () => {
    expect(await captureTeamState(makeDb(null), "team-1")).toBeNull();
  });

  it("rend null plutôt que de propager une erreur de lecture", async () => {
    const db = makeDb();
    db.team.findUnique.mockRejectedValue(new Error("db down"));
    expect(await captureTeamState(db, "team-1")).toBeNull();
  });
});

describe("diffTeamState", () => {
  const before = {
    treasury: 400_000,
    teamValue: 1_000_000,
    name: "Les Rats",
    apothecary: false,
  } as unknown as TeamStateSnapshot;
  const after = {
    treasury: 320_000,
    teamValue: 1_000_000,
    name: "Les Rats",
    apothecary: true,
  } as unknown as TeamStateSnapshot;

  it("ne retient que les champs qui ont bougé", () => {
    const diff = diffTeamState(before, after);
    expect(diff.treasury).toEqual({ from: 400_000, to: 320_000 });
    expect(diff.apothecary).toEqual({ from: false, to: true });
    expect(diff.teamValue).toBeUndefined();
    expect(diff.name).toBeUndefined();
  });

  it("rend tous les champs de `after` quand il n'y a pas d'avant (création)", () => {
    const diff = diffTeamState(null, after);
    expect(diff.treasury).toEqual({ from: null, to: 320_000 });
    expect(diff.name).toEqual({ from: null, to: "Les Rats" });
  });

  it("rend un diff vide quand rien n'est fourni", () => {
    expect(diffTeamState(null, null)).toEqual({});
  });
});

describe("resolveActorRole", () => {
  it("classe le propriétaire en `owner`, même s'il est admin", () => {
    expect(
      resolveActorRole({
        actorUserId: "u1",
        teamOwnerId: "u1",
        roles: ["admin"],
      }),
    ).toBe("owner");
  });

  it("classe un admin non-propriétaire en `admin` et un job en `system`", () => {
    expect(
      resolveActorRole({ actorUserId: "u2", teamOwnerId: "u1", roles: ["admin"] }),
    ).toBe("admin");
    expect(resolveActorRole({ actorUserId: null })).toBe("system");
  });
});

describe("recordTeamAudit", () => {
  it("écrit une étape complète : acteur, diff, état résultant, deltas", async () => {
    const db = makeDb();
    const before = { ...(await captureTeamState(db, "team-1"))! };
    db.team.findUnique.mockResolvedValue(teamRow({ treasury: 320_000 }));

    await runWithAuditContext(
      createAuditContext({
        correlationId: "req-42",
        source: "http",
        route: "POST /team/:id/purchase",
        ipAddress: "10.0.0.1",
        actorUserId: "coach-1",
      }),
      () =>
        recordTeamAudit(db, {
          teamId: "team-1",
          action: "team.purchase.player",
          before,
          details: { type: "player", cost: 80_000 },
        }),
    );

    expect(db.teamAuditEvent.create).toHaveBeenCalledTimes(1);
    const { data } = db.teamAuditEvent.create.mock.calls[0][0];
    expect(data).toMatchObject({
      teamId: "team-1",
      action: "team.purchase.player",
      correlationId: "req-42",
      step: 1,
      actorUserId: "coach-1",
      actorRole: "owner",
      actorLabel: "Nuffle",
      source: "http",
      route: "POST /team/:id/purchase",
      ipAddress: "10.0.0.1",
      treasury: 320_000,
      treasuryDelta: -80_000,
      teamValueDelta: 0,
    });
    // Colonnes Json sérialisées en chaîne : Postgres (Json) comme le
    // miroir sqlite (String) l'acceptent.
    expect(JSON.parse(data.changes).treasury).toEqual({
      from: 400_000,
      to: 320_000,
    });
    expect(JSON.parse(data.after).treasury).toBe(320_000);
    expect(JSON.parse(data.details)).toEqual({ type: "player", cost: 80_000 });
  });

  it("numérote les étapes d'une même corrélation dans l'ordre", async () => {
    const db = makeDb();
    await runWithAuditContext(createAuditContext({ correlationId: "req-7" }), async () => {
      await recordTeamAudit(db, { teamId: "team-1", action: "a" });
      await recordTeamAudit(db, { teamId: "team-1", action: "b" });
      await recordTeamAudit(db, { teamId: "team-1", action: "c" });
    });

    const steps = db.teamAuditEvent.create.mock.calls.map(
      (c: [{ data: { step: number; correlationId: string } }]) => c[0].data,
    );
    expect(steps.map((d) => d.step)).toEqual([1, 2, 3]);
    expect(new Set(steps.map((d) => d.correlationId))).toEqual(new Set(["req-7"]));
  });

  it("n'écrit rien quand le coupe-circuit est armé", async () => {
    process.env.TEAM_AUDIT_DISABLED = "1";
    const db = makeDb();
    await recordTeamAudit(db, { teamId: "team-1", action: "team.update" });
    expect(db.teamAuditEvent.create).not.toHaveBeenCalled();
  });

  it("préfère l'acteur explicite au contexte ambiant", async () => {
    const db = makeDb();
    await runWithAuditContext(
      createAuditContext({ actorUserId: "coach-1" }),
      () =>
        recordTeamAudit(db, {
          teamId: "team-1",
          action: "commissioner.team.adjust_treasury",
          actor: { userId: "commish-9", role: "commissioner", label: null },
        }),
    );
    const { data } = db.teamAuditEvent.create.mock.calls[0][0];
    expect(data.actorUserId).toBe("commish-9");
    expect(data.actorRole).toBe("commissioner");
  });
});

describe("safeRecordTeamAudit", () => {
  it("avale l'échec d'écriture : la mutation métier reste committée", async () => {
    const db = makeDb();
    db.teamAuditEvent.create.mockRejectedValue(new Error("table absente"));
    await expect(
      safeRecordTeamAudit(db, { teamId: "team-1", action: "team.update" }),
    ).resolves.toBeUndefined();
  });
});

describe("withTeamAudit", () => {
  it("capture avant, exécute, journalise après, et rend le résultat", async () => {
    const db = makeDb();
    const mutate = vi.fn(async () => {
      db.team.findUnique.mockResolvedValue(teamRow({ treasury: 300_000 }));
      return { ok: true };
    });

    const result = await withTeamAudit(
      db,
      { teamId: "team-1", action: "team.purchase.reroll" },
      mutate,
    );

    expect(result).toEqual({ ok: true });
    const { data } = db.teamAuditEvent.create.mock.calls[0][0];
    expect(data.treasuryDelta).toBe(-100_000);
    expect(data.treasury).toBe(300_000);
  });

  it("journalise une étape `.failed` puis propage l'erreur", async () => {
    const db = makeDb();
    const boom = new Error("trésorerie insuffisante");

    await expect(
      withTeamAudit(db, { teamId: "team-1", action: "team.purchase.reroll" }, () =>
        Promise.reject(boom),
      ),
    ).rejects.toThrow("trésorerie insuffisante");

    const { data } = db.teamAuditEvent.create.mock.calls[0][0];
    expect(data.action).toBe("team.purchase.reroll.failed");
    expect(data.note).toBe("trésorerie insuffisante");
  });

  it("fusionne `detailsFrom` dans la charge utile de l'étape", async () => {
    const db = makeDb();
    await withTeamAudit(
      db,
      {
        teamId: "team-1",
        action: "team.player.add",
        details: { position: "blitzer" },
        detailsFrom: (r) => ({ playerId: (r as { id: string }).id }),
      },
      async () => ({ id: "p-new" }),
    );
    const { data } = db.teamAuditEvent.create.mock.calls[0][0];
    expect(JSON.parse(data.details)).toEqual({
      position: "blitzer",
      playerId: "p-new",
    });
  });

  it("court-circuite entièrement quand le journal est désarmé", async () => {
    process.env.TEAM_AUDIT_DISABLED = "1";
    const db = makeDb();
    const result = await withTeamAudit(
      db,
      { teamId: "team-1", action: "team.update" },
      async () => "valeur",
    );
    expect(result).toBe("valeur");
    expect(db.team.findUnique).not.toHaveBeenCalled();
    expect(db.teamAuditEvent.create).not.toHaveBeenCalled();
  });
});
