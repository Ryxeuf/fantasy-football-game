/**
 * Fan Dévoué offert des équipes de ligue : octroi à l'inscription, reprise
 * (ou transfert) au départ. Prisma, la config staff et le journal d'équipe
 * sont mockés ; la règle de calcul (pure) est celle du moteur.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const client = {
    $transaction: vi.fn(),
    team: { findUnique: vi.fn(), updateMany: vi.fn() },
    leagueParticipant: {
      create: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return client;
});

vi.mock("../prisma", () => ({ prisma: db }));

vi.mock("./roster-staff-config", () => ({
  resolveStaffConfigBySlug: vi.fn(),
}));

vi.mock("./team-audit", () => ({
  captureTeamState: vi.fn(async (_db: unknown, teamId: string) => ({ teamId })),
  safeRecordTeamAudit: vi.fn(async () => {}),
}));

import { safeRecordTeamAudit } from "./team-audit";
import { resolveStaffConfigBySlug } from "./roster-staff-config";
import {
  createLeagueParticipant,
  withLeagueFreeFanRevoked,
  withLeagueFreeFansRevokedForLeague,
} from "./league-free-fan";

const audit = vi.mocked(safeRecordTeamAudit);

const DATA = {
  seasonId: "season-1",
  teamId: "team-1",
  seasonElo: 1000,
  status: "active" as const,
};

function team(overrides: Record<string, unknown> = {}) {
  return {
    id: "team-1",
    roster: "human",
    ruleset: "season_3",
    format: "bb11",
    dedicatedFans: 2,
    leagueFreeFan: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(resolveStaffConfigBySlug).mockResolvedValue({
    maxDedicatedFans: 6,
    dedicatedFanCost: 5000,
  } as Awaited<ReturnType<typeof resolveStaffConfigBySlug>>);
  db.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(db),
  );
  db.leagueParticipant.create.mockImplementation(async (args: { data: object }) => ({
    id: "p-new",
    ...args.data,
  }));
  db.team.updateMany.mockResolvedValue({ count: 1 });
  db.leagueParticipant.updateMany.mockResolvedValue({ count: 1 });
  db.leagueParticipant.findFirst.mockResolvedValue(null);
});

describe("createLeagueParticipant — octroi à l'inscription", () => {
  it.each([null, true, undefined])(
    "marqueur %s : inscription seule, rien d'accordé",
    async (marker) => {
      await createLeagueParticipant(DATA, team({ leagueFreeFan: marker }));
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.team.updateMany).not.toHaveBeenCalled();
      expect(db.leagueParticipant.create).toHaveBeenCalledWith({ data: DATA });
      expect(audit).not.toHaveBeenCalled();
    },
  );

  it("équipe sans fan offert : +1 fan, inscription marquée, journal", async () => {
    const created = await createLeagueParticipant(DATA, team());

    expect(db.team.updateMany).toHaveBeenCalledWith({
      where: { id: "team-1", leagueFreeFan: false, dedicatedFans: { lt: 6 } },
      data: { leagueFreeFan: true, dedicatedFans: { increment: 1 } },
    });
    expect(db.leagueParticipant.create).toHaveBeenCalledWith({
      data: { ...DATA, freeFanGrant: "fan", freeFanRefund: null },
    });
    expect(created).toMatchObject({ id: "p-new", freeFanGrant: "fan" });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        teamId: "team-1",
        action: "team.league_free_fan.granted",
        details: expect.objectContaining({ grant: "fan", seasonId: "season-1" }),
      }),
    );
  });

  it("équipe au plafond : le prix d'un fan en trésorerie", async () => {
    await createLeagueParticipant(DATA, team({ dedicatedFans: 6 }));

    expect(db.team.updateMany).toHaveBeenCalledWith({
      where: { id: "team-1", leagueFreeFan: false },
      data: { leagueFreeFan: true, treasury: { increment: 5000 } },
    });
    expect(db.leagueParticipant.create).toHaveBeenCalledWith({
      data: { ...DATA, freeFanGrant: "refund", freeFanRefund: 5000 },
    });
  });

  it("course perdue : l'inscription se crée sans rien accorder", async () => {
    db.team.updateMany.mockResolvedValue({ count: 0 });
    await createLeagueParticipant(DATA, team());
    expect(db.leagueParticipant.create).toHaveBeenCalledWith({ data: DATA });
    expect(audit).not.toHaveBeenCalled();
  });
});

describe("withLeagueFreeFanRevoked — reprise au départ", () => {
  const op = vi.fn();

  beforeEach(() => {
    op.mockResolvedValue("done");
  });

  it("aucune inscription n'a rien accordé : l'opération seule, sans transaction", async () => {
    const out = await withLeagueFreeFanRevoked(
      {
        participants: [{ id: "p1", teamId: "team-1", freeFanGrant: null }],
        reason: "withdrawn",
      },
      op,
    );
    expect(out).toBe("done");
    expect(op).toHaveBeenCalledWith(db);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.team.updateMany).not.toHaveBeenCalled();
  });

  it("fan accordé : −1 fan, marqueur rendu, octroi effacé, journal", async () => {
    db.team.findUnique.mockResolvedValue({
      dedicatedFans: 3,
      treasury: 0,
      leagueFreeFan: true,
    });

    const out = await withLeagueFreeFanRevoked(
      {
        participants: [{ id: "p1", teamId: "team-1", freeFanGrant: "fan" }],
        reason: "withdrawn",
      },
      op,
    );

    expect(out).toBe("done");
    expect(db.leagueParticipant.updateMany).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { freeFanGrant: null, freeFanRefund: null },
    });
    expect(db.team.updateMany).toHaveBeenCalledWith({
      where: { id: "team-1", leagueFreeFan: true, dedicatedFans: { gte: 1 } },
      data: { leagueFreeFan: false, dedicatedFans: { decrement: 1 } },
    });
    expect(op).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "team.league_free_fan.revoked",
        details: expect.objectContaining({
          reason: "withdrawn",
          grant: "fan",
          revoked: "fan",
        }),
      }),
    );
  });

  it("remboursement couvert par la trésorerie : on reprend le montant", async () => {
    db.team.findUnique.mockResolvedValue({
      dedicatedFans: 6,
      treasury: 8000,
      leagueFreeFan: true,
    });
    await withLeagueFreeFanRevoked(
      {
        participants: [
          { id: "p1", teamId: "team-1", freeFanGrant: "refund", freeFanRefund: 5000 },
        ],
        reason: "removed_by_commissioner",
      },
      op,
    );
    expect(db.team.updateMany).toHaveBeenCalledWith({
      where: { id: "team-1", leagueFreeFan: true, treasury: { gte: 5000 } },
      data: { leagueFreeFan: false, treasury: { decrement: 5000 } },
    });
  });

  it("remboursement déjà dépensé : −1 fan à la place", async () => {
    db.team.findUnique.mockResolvedValue({
      dedicatedFans: 6,
      treasury: 2000,
      leagueFreeFan: true,
    });
    await withLeagueFreeFanRevoked(
      {
        participants: [
          { id: "p1", teamId: "team-1", freeFanGrant: "refund", freeFanRefund: 5000 },
        ],
        reason: "withdrawn",
      },
      op,
    );
    expect(db.team.updateMany).toHaveBeenCalledWith({
      where: { id: "team-1", leagueFreeFan: true, dedicatedFans: { gte: 1 } },
      data: { leagueFreeFan: false, dedicatedFans: { decrement: 1 } },
    });
  });

  it("plus aucun fan : seul le marqueur est rendu", async () => {
    db.team.findUnique.mockResolvedValue({
      dedicatedFans: 0,
      treasury: 0,
      leagueFreeFan: true,
    });
    await withLeagueFreeFanRevoked(
      {
        participants: [{ id: "p1", teamId: "team-1", freeFanGrant: "fan" }],
        reason: "withdrawn",
      },
      op,
    );
    expect(db.team.updateMany).toHaveBeenCalledWith({
      where: { id: "team-1", leagueFreeFan: true },
      data: { leagueFreeFan: false },
    });
  });

  it("l'équipe reste en ligue ailleurs : l'octroi est transféré, rien n'est repris", async () => {
    db.leagueParticipant.findFirst.mockResolvedValue({ id: "p-other" });
    await withLeagueFreeFanRevoked(
      {
        participants: [{ id: "p1", teamId: "team-1", freeFanGrant: "fan" }],
        reason: "withdrawn",
      },
      op,
    );
    expect(db.leagueParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamId: "team-1", status: "active", id: { notIn: ["p1"] } },
      }),
    );
    expect(db.leagueParticipant.updateMany).toHaveBeenCalledWith({
      where: { id: "p-other" },
      data: { freeFanGrant: "fan", freeFanRefund: null },
    });
    expect(db.team.updateMany).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("marqueur déjà rendu : aucune écriture d'équipe, le départ a lieu", async () => {
    db.team.findUnique.mockResolvedValue({
      dedicatedFans: 3,
      treasury: 0,
      leagueFreeFan: false,
    });
    await withLeagueFreeFanRevoked(
      {
        participants: [{ id: "p1", teamId: "team-1", freeFanGrant: "fan" }],
        reason: "withdrawn",
      },
      op,
    );
    expect(db.team.updateMany).not.toHaveBeenCalled();
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("course perdue sur les fans : le marqueur est rendu, jamais de compte négatif", async () => {
    db.team.findUnique.mockResolvedValue({
      dedicatedFans: 1,
      treasury: 0,
      leagueFreeFan: true,
    });
    db.team.updateMany.mockResolvedValueOnce({ count: 0 }).mockResolvedValue({ count: 1 });
    await withLeagueFreeFanRevoked(
      {
        participants: [{ id: "p1", teamId: "team-1", freeFanGrant: "fan" }],
        reason: "withdrawn",
      },
      op,
    );
    expect(db.team.updateMany).toHaveBeenLastCalledWith({
      where: { id: "team-1", leagueFreeFan: true },
      data: { leagueFreeFan: false },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({ revoked: "none" }),
      }),
    );
  });
});

describe("withLeagueFreeFansRevokedForLeague — suppression de la ligue", () => {
  it("reprend les octrois de la ligue, sans transfert vers ses propres inscriptions", async () => {
    db.leagueParticipant.findMany.mockResolvedValue([
      { id: "p1", teamId: "team-1", freeFanGrant: "fan", freeFanRefund: null },
    ]);
    db.team.findUnique.mockResolvedValue({
      dedicatedFans: 2,
      treasury: 0,
      leagueFreeFan: true,
    });
    const op = vi.fn().mockResolvedValue({});

    await withLeagueFreeFansRevokedForLeague("lg-1", op);

    expect(db.leagueParticipant.findMany).toHaveBeenCalledWith({
      where: { season: { leagueId: "lg-1" }, freeFanGrant: { not: null } },
      select: { id: true, teamId: true, freeFanGrant: true, freeFanRefund: true },
    });
    expect(db.leagueParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          season: { leagueId: { not: "lg-1" } },
        }),
      }),
    );
    expect(db.team.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { leagueFreeFan: false, dedicatedFans: { decrement: 1 } },
      }),
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("ligue sans octroi : la suppression seule", async () => {
    db.leagueParticipant.findMany.mockResolvedValue([]);
    const op = vi.fn().mockResolvedValue({});
    await withLeagueFreeFansRevokedForLeague("lg-1", op);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(op).toHaveBeenCalledWith(db);
  });
});
