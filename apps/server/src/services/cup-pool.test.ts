import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    cup: { findUnique: vi.fn() },
    cupRound: { count: vi.fn() },
    cupPool: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cupParticipant: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  assignCupPools,
  groupCupStandingsByPool,
  UNASSIGNED_POOL_ID,
  autoAssignCupPools,
  computeSnakeAssignment,
  createCupPool,
  CupPoolError,
  deleteCupPool,
  listCupPools,
  updateCupPool,
} from "./cup-pool";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const COMMISH = { userId: "u-com", isAdmin: false };
const ADMIN = { userId: "u-admin", isAdmin: true };
const STRANGER = { userId: "u-x", isAdmin: false };
const CUP = { id: "cup-1", creatorId: "u-com", status: "ouverte" };

async function expectRefusal(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toMatchObject({ code });
}

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.cup.findUnique.mockResolvedValue(CUP);
  mockPrisma.cupRound.count.mockResolvedValue(0);
  mockPrisma.cupPool.aggregate.mockResolvedValue({ _max: { order: null } });
  mockPrisma.$transaction.mockResolvedValue([]);
});

describe("computeSnakeAssignment (PUR)", () => {
  it("équilibre en serpentin plutôt qu'en tourniquet", () => {
    // 1→A, 2→B, puis on repart de B : sans le retour, la poule A recevrait
    // systématiquement les mieux placés.
    expect(
      computeSnakeAssignment(["p1", "p2", "p3", "p4"], ["A", "B"]).map(
        (a) => a.poolId,
      ),
    ).toEqual(["A", "B", "B", "A"]);
  });

  it("répartit 6 équipes en 3 poules", () => {
    expect(
      computeSnakeAssignment(
        ["p1", "p2", "p3", "p4", "p5", "p6"],
        ["A", "B", "C"],
      ).map((a) => a.poolId),
    ).toEqual(["A", "B", "C", "C", "B", "A"]);
  });

  it("ne rend rien sans poule", () => {
    expect(computeSnakeAssignment(["p1"], [])).toEqual([]);
  });
});

describe("createCupPool", () => {
  it("crée la poule et lui donne l'ordre suivant", async () => {
    mockPrisma.cupPool.findFirst.mockResolvedValue(null);
    mockPrisma.cupPool.aggregate.mockResolvedValue({ _max: { order: 2 } });
    mockPrisma.cupPool.create.mockResolvedValue({
      id: "p1",
      name: "Poule A",
      order: 3,
      color: null,
      qualifiesForPlayoffs: 2,
    });

    const out = await createCupPool({
      cupId: "cup-1",
      actor: COMMISH,
      name: "  Poule A  ",
      qualifiesForPlayoffs: 2,
    });

    expect(out).toMatchObject({ id: "p1", order: 3, qualifiesForPlayoffs: 2 });
    expect(mockPrisma.cupPool.create.mock.calls[0][0].data).toMatchObject({
      name: "Poule A",
      order: 3,
    });
  });

  it("part de l'ordre 0 quand la coupe n'a aucune poule", async () => {
    mockPrisma.cupPool.findFirst.mockResolvedValue(null);
    mockPrisma.cupPool.create.mockResolvedValue({
      id: "p1",
      name: "A",
      order: 0,
      color: null,
      qualifiesForPlayoffs: 0,
    });
    await createCupPool({ cupId: "cup-1", actor: COMMISH, name: "A" });
    expect(mockPrisma.cupPool.create.mock.calls[0][0].data.order).toBe(0);
  });

  it("borne le quota de qualifiés", async () => {
    mockPrisma.cupPool.findFirst.mockResolvedValue(null);
    mockPrisma.cupPool.create.mockResolvedValue({
      id: "p1",
      name: "A",
      order: 0,
      color: null,
      qualifiesForPlayoffs: 0,
    });
    await createCupPool({
      cupId: "cup-1",
      actor: COMMISH,
      name: "A",
      qualifiesForPlayoffs: -3,
    });
    expect(
      mockPrisma.cupPool.create.mock.calls[0][0].data.qualifiesForPlayoffs,
    ).toBe(0);
  });

  it("refuse un nom vide ou déjà pris", async () => {
    mockPrisma.cupPool.findFirst.mockResolvedValue(null);
    await expectRefusal(
      () => createCupPool({ cupId: "cup-1", actor: COMMISH, name: "   " }),
      "pool_name_taken",
    );
    mockPrisma.cupPool.findFirst.mockResolvedValue({ id: "autre" });
    await expectRefusal(
      () => createCupPool({ cupId: "cup-1", actor: COMMISH, name: "Poule A" }),
      "pool_name_taken",
    );
  });

  it("réserve la gestion au commissaire (et à l'admin)", async () => {
    await expectRefusal(
      () => createCupPool({ cupId: "cup-1", actor: STRANGER, name: "A" }),
      "forbidden",
    );
    mockPrisma.cupPool.findFirst.mockResolvedValue(null);
    mockPrisma.cupPool.create.mockResolvedValue({
      id: "p1",
      name: "A",
      order: 0,
      color: null,
      qualifiesForPlayoffs: 0,
    });
    await expect(
      createCupPool({ cupId: "cup-1", actor: ADMIN, name: "A" }),
    ).resolves.toBeTruthy();
  });

  it("refuse dès qu'une ronde existe : les appariements en dépendent", async () => {
    mockPrisma.cupRound.count.mockResolvedValue(1);
    await expectRefusal(
      () => createCupPool({ cupId: "cup-1", actor: COMMISH, name: "A" }),
      "cup_started",
    );
  });

  it("refuse sur une coupe terminée", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue({ ...CUP, status: "terminee" });
    await expectRefusal(
      () => createCupPool({ cupId: "cup-1", actor: COMMISH, name: "A" }),
      "cup_closed",
    );
  });

  it("refuse sur une coupe introuvable", async () => {
    mockPrisma.cup.findUnique.mockResolvedValue(null);
    await expectRefusal(
      () => createCupPool({ cupId: "nope", actor: COMMISH, name: "A" }),
      "cup_not_found",
    );
  });
});

describe("updateCupPool", () => {
  beforeEach(() => {
    mockPrisma.cupPool.findUnique.mockResolvedValue({
      id: "p1",
      cupId: "cup-1",
      name: "Poule A",
    });
    mockPrisma.cupPool.update.mockResolvedValue({
      id: "p1",
      name: "Poule A",
      order: 0,
      color: null,
      qualifiesForPlayoffs: 4,
      _count: { participants: 3 },
    });
  });

  it("laisse ajuster le quota MÊME une fois la coupe lancée", async () => {
    // Le quota ne change aucun appariement déjà joué : seulement la lecture
    // du bracket à venir. Seule la COMPOSITION est figée par la 1re ronde.
    mockPrisma.cupRound.count.mockResolvedValue(3);
    const out = await updateCupPool({
      poolId: "p1",
      actor: COMMISH,
      qualifiesForPlayoffs: 4,
    });
    expect(out.qualifiesForPlayoffs).toBe(4);
    expect(out.participantCount).toBe(3);
  });

  it("refuse un nom déjà pris par une autre poule", async () => {
    mockPrisma.cupPool.findFirst.mockResolvedValue({ id: "p2" });
    await expectRefusal(
      () => updateCupPool({ poolId: "p1", actor: COMMISH, name: "Poule B" }),
      "pool_name_taken",
    );
  });

  it("accepte de « renommer » une poule avec son propre nom", async () => {
    await expect(
      updateCupPool({ poolId: "p1", actor: COMMISH, name: "Poule A" }),
    ).resolves.toBeTruthy();
    expect(mockPrisma.cupPool.findFirst).not.toHaveBeenCalled();
  });

  it("refuse une poule introuvable", async () => {
    mockPrisma.cupPool.findUnique.mockResolvedValue(null);
    await expectRefusal(
      () => updateCupPool({ poolId: "nope", actor: COMMISH, name: "A" }),
      "pool_not_found",
    );
  });
});

describe("deleteCupPool", () => {
  it("refuse une poule non vide", async () => {
    mockPrisma.cupPool.findUnique.mockResolvedValue({
      id: "p1",
      cupId: "cup-1",
      _count: { participants: 2 },
    });
    await expectRefusal(
      () => deleteCupPool({ poolId: "p1", actor: COMMISH }),
      "pool_not_empty",
    );
    expect(mockPrisma.cupPool.delete).not.toHaveBeenCalled();
  });

  it("supprime une poule vide", async () => {
    mockPrisma.cupPool.findUnique.mockResolvedValue({
      id: "p1",
      cupId: "cup-1",
      _count: { participants: 0 },
    });
    await expect(
      deleteCupPool({ poolId: "p1", actor: COMMISH }),
    ).resolves.toEqual({ deleted: true });
    expect(mockPrisma.cupPool.delete).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
  });
});

describe("assignCupPools", () => {
  it("applique les affectations en UNE transaction", async () => {
    mockPrisma.cupParticipant.findMany.mockResolvedValue([
      { id: "cp1", cupId: "cup-1" },
      { id: "cp2", cupId: "cup-1" },
    ]);
    mockPrisma.cupPool.findMany.mockResolvedValue([
      { id: "pool-a", cupId: "cup-1" },
    ]);

    const out = await assignCupPools({
      cupId: "cup-1",
      actor: COMMISH,
      assignments: [
        { participantId: "cp1", poolId: "pool-a" },
        { participantId: "cp2", poolId: null },
      ],
    });

    expect(out).toEqual({ updated: 2 });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("ne fait rien sur une liste vide", async () => {
    await expect(
      assignCupPools({ cupId: "cup-1", actor: COMMISH, assignments: [] }),
    ).resolves.toEqual({ updated: 0 });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuse une inscription inconnue ou d'une autre coupe", async () => {
    mockPrisma.cupParticipant.findMany.mockResolvedValue([]);
    await expectRefusal(
      () =>
        assignCupPools({
          cupId: "cup-1",
          actor: COMMISH,
          assignments: [{ participantId: "cp1", poolId: null }],
        }),
      "participant_not_found",
    );

    mockPrisma.cupParticipant.findMany.mockResolvedValue([
      { id: "cp1", cupId: "autre-coupe" },
    ]);
    await expectRefusal(
      () =>
        assignCupPools({
          cupId: "cup-1",
          actor: COMMISH,
          assignments: [{ participantId: "cp1", poolId: null }],
        }),
      "participant_not_in_cup",
    );
  });

  it("refuse une poule d'une autre coupe", async () => {
    mockPrisma.cupParticipant.findMany.mockResolvedValue([
      { id: "cp1", cupId: "cup-1" },
    ]);
    mockPrisma.cupPool.findMany.mockResolvedValue([
      { id: "pool-x", cupId: "autre-coupe" },
    ]);
    await expectRefusal(
      () =>
        assignCupPools({
          cupId: "cup-1",
          actor: COMMISH,
          assignments: [{ participantId: "cp1", poolId: "pool-x" }],
        }),
      "pool_not_found",
    );
  });
});

describe("autoAssignCupPools", () => {
  it("le dit plutôt que d'échouer quand aucune poule n'existe", async () => {
    mockPrisma.cupPool.findMany.mockResolvedValue([]);
    await expect(
      autoAssignCupPools({ cupId: "cup-1", actor: COMMISH }),
    ).resolves.toEqual({ assigned: 0, note: "no-pools" });
  });

  it("répartit les inscrits dans l'ordre d'inscription", async () => {
    mockPrisma.cupPool.findMany.mockResolvedValue([
      { id: "pool-a" },
      { id: "pool-b" },
    ]);
    mockPrisma.cupParticipant.findMany.mockResolvedValue([
      { id: "cp1" },
      { id: "cp2" },
      { id: "cp3" },
    ]);

    const out = await autoAssignCupPools({ cupId: "cup-1", actor: COMMISH });

    expect(out).toEqual({ assigned: 3 });
    // Tri déterministe : `createdAt` puis `id` pour départager.
    expect(mockPrisma.cupParticipant.findMany.mock.calls[0][0].orderBy).toEqual(
      [{ createdAt: "asc" }, { id: "asc" }],
    );
  });
});

describe("listCupPools", () => {
  it("sert les poules ordonnées avec leur effectif", async () => {
    mockPrisma.cupPool.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "A",
        order: 0,
        color: "#ff0000",
        qualifiesForPlayoffs: 2,
        _count: { participants: 4 },
      },
    ]);
    await expect(listCupPools("cup-1")).resolves.toEqual([
      {
        id: "p1",
        name: "A",
        order: 0,
        color: "#ff0000",
        qualifiesForPlayoffs: 2,
        participantCount: 4,
      },
    ]);
  });
});

describe("CupPoolError", () => {
  it("porte son code", () => {
    const e = new CupPoolError("pool_not_empty", "msg");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("pool_not_empty");
  });
});

describe("groupCupStandingsByPool (PUR)", () => {
  const POOLS = [
    { id: "A", name: "Poule A", order: 0, qualifiesForPlayoffs: 2 },
    { id: "B", name: "Poule B", order: 1, qualifiesForPlayoffs: 2 },
  ];
  const STANDINGS = [
    { teamId: "t1" },
    { teamId: "t2" },
    { teamId: "t3" },
    { teamId: "t4" },
  ];
  const affect = (pairs: Array<[string, string | null]>) => new Map(pairs);

  it("ne rend rien sans poule : l'écran garde le classement général", () => {
    expect(groupCupStandingsByPool(STANDINGS, [], affect([]))).toEqual([]);
  });

  it("projette le classement général sans le retrier", () => {
    const out = groupCupStandingsByPool(
      STANDINGS,
      POOLS,
      affect([
        ["t1", "A"],
        ["t2", "B"],
        ["t3", "A"],
        ["t4", "B"],
      ]),
    );
    expect(out.map((g) => g.poolId)).toEqual(["A", "B"]);
    // L'ordre à l'intérieur d'une poule est celui du classement général.
    expect(out[0].standings.map((r) => r.teamId)).toEqual(["t1", "t3"]);
    expect(out[1].standings.map((r) => r.teamId)).toEqual(["t2", "t4"]);
    expect(out[0].qualifiesForPlayoffs).toBe(2);
  });

  it("regroupe les équipes sans poule en queue", () => {
    const out = groupCupStandingsByPool(
      STANDINGS,
      [POOLS[0]],
      affect([
        ["t1", "A"],
        ["t2", null],
      ]),
    );
    expect(out.map((g) => g.poolId)).toEqual(["A", UNASSIGNED_POOL_ID]);
    // t3 et t4 sont absents de la map : eux aussi sont « non affectés »,
    // les taire les ferait disparaître du classement.
    expect(out[1].standings.map((r) => r.teamId)).toEqual(["t2", "t3", "t4"]);
  });

  it("rend une poule vide plutôt que de la masquer", () => {
    const out = groupCupStandingsByPool(
      [{ teamId: "t1" }],
      POOLS,
      affect([["t1", "A"]]),
    );
    expect(out.find((g) => g.poolId === "B")?.standings).toEqual([]);
  });

  it("récupère une équipe dont la poule a disparu", () => {
    const out = groupCupStandingsByPool(
      [{ teamId: "t1" }],
      POOLS,
      affect([["t1", "fantome"]]),
    );
    expect(out.at(-1)?.poolId).toBe(UNASSIGNED_POOL_ID);
    expect(out.at(-1)?.standings.map((r) => r.teamId)).toEqual(["t1"]);
  });
});
