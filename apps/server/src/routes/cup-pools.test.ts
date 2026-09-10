/**
 * Routes des poules de coupe : handlers unitaires (service mocké), passage de
 * l'acteur, et surtout la traduction des erreurs typées en statuts HTTP —
 * c'est tout ce que la couche route porte.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/cup-pool", () => {
  class CupPoolError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CupPoolError";
    }
  }
  return {
    CupPoolError,
    listCupPools: vi.fn(),
    createCupPool: vi.fn(),
    updateCupPool: vi.fn(),
    deleteCupPool: vi.fn(),
    assignCupPools: vi.fn(),
    autoAssignCupPools: vi.fn(),
  };
});
vi.mock("../prisma", () => ({ prisma: {} }));

import type { Response } from "express";
import {
  assignCupPools,
  autoAssignCupPools,
  createCupPool,
  CupPoolError,
  deleteCupPool,
  listCupPools,
  updateCupPool,
} from "../services/cup-pool";
import {
  handleAssignCupPools,
  handleAutoAssignCupPools,
  handleCreateCupPool,
  handleDeleteCupPool,
  handleListCupPools,
  handleUpdateCupPool,
} from "./cup-pools";
import type { AuthenticatedRequest } from "../middleware/authUser";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  list: listCupPools as unknown as MockFn,
  create: createCupPool as unknown as MockFn,
  update: updateCupPool as unknown as MockFn,
  remove: deleteCupPool as unknown as MockFn,
  assign: assignCupPools as unknown as MockFn,
  auto: autoAssignCupPools as unknown as MockFn,
};

function makeRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response & {
    status: MockFn;
    json: MockFn;
  };
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<AuthenticatedRequest> = {}) {
  return {
    user: { id: "u1", roles: [] },
    params: { id: "cup-1", poolId: "pool-1" },
    body: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

beforeEach(() => vi.resetAllMocks());

describe("poules de coupe — handlers", () => {
  it("liste les poules", async () => {
    mocked.list.mockResolvedValue([{ id: "p1" }]);
    const res = makeRes();
    await handleListCupPools(makeReq(), res);
    expect(mocked.list).toHaveBeenCalledWith("cup-1");
  });

  it("crée une poule et répond 201", async () => {
    mocked.create.mockResolvedValue({ id: "p1" });
    const res = makeRes();
    await handleCreateCupPool(
      makeReq({ body: { name: "Poule A", qualifiesForPlayoffs: 2 } }),
      res,
    );
    expect(mocked.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cupId: "cup-1",
        actor: { userId: "u1", isAdmin: false },
        name: "Poule A",
        qualifiesForPlayoffs: 2,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("reconnaît un administrateur", async () => {
    mocked.create.mockResolvedValue({ id: "p1" });
    await handleCreateCupPool(
      makeReq({
        user: { id: "u9", roles: ["admin"] },
        body: { name: "A" },
      } as Partial<AuthenticatedRequest>),
      makeRes(),
    );
    expect(mocked.create.mock.calls[0][0].actor).toEqual({
      userId: "u9",
      isAdmin: true,
    });
  });

  it("à la création, une couleur absente EFFACE (null) ; à l'édition elle NE TOUCHE PAS", async () => {
    mocked.create.mockResolvedValue({ id: "p1" });
    await handleCreateCupPool(makeReq({ body: { name: "A" } }), makeRes());
    expect(mocked.create.mock.calls[0][0].color).toBeNull();

    mocked.update.mockResolvedValue({ id: "p1" });
    await handleUpdateCupPool(makeReq({ body: { name: "B" } }), makeRes());
    expect(mocked.update.mock.calls[0][0].color).toBeUndefined();
  });

  it("supprime une poule", async () => {
    mocked.remove.mockResolvedValue({ deleted: true });
    await handleDeleteCupPool(makeReq(), makeRes());
    expect(mocked.remove).toHaveBeenCalledWith(
      expect.objectContaining({ poolId: "pool-1" }),
    );
  });

  it("affecte des équipes et lance la répartition automatique", async () => {
    mocked.assign.mockResolvedValue({ updated: 2 });
    const assignments = [{ participantId: "cp1", poolId: "pool-1" }];
    await handleAssignCupPools(makeReq({ body: { assignments } }), makeRes());
    expect(mocked.assign.mock.calls[0][0].assignments).toEqual(assignments);

    mocked.auto.mockResolvedValue({ assigned: 4 });
    await handleAutoAssignCupPools(makeReq(), makeRes());
    expect(mocked.auto).toHaveBeenCalledWith(
      expect.objectContaining({ cupId: "cup-1" }),
    );
  });

  it("traduit chaque code d'erreur en son statut", async () => {
    const cases: Array<[string, number]> = [
      ["cup_not_found", 404],
      ["pool_not_found", 404],
      ["participant_not_found", 404],
      ["forbidden", 403],
      ["cup_started", 409],
      ["cup_closed", 409],
      ["pool_name_taken", 409],
      ["pool_not_empty", 409],
      ["participant_not_in_cup", 409],
    ];
    for (const [code, status] of cases) {
      mocked.create.mockRejectedValue(new CupPoolError(code, "boum"));
      const res = makeRes();
      await handleCreateCupPool(makeReq({ body: { name: "A" } }), res);
      expect(res.status, code).toHaveBeenCalledWith(status);
    }
  });

  it("rend 500 sur une erreur inattendue", async () => {
    mocked.list.mockRejectedValue(new Error("boum"));
    const res = makeRes();
    await handleListCupPools(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("refuse un appelant non authentifié", async () => {
    const res = makeRes();
    await handleListCupPools(
      makeReq({ user: undefined } as Partial<AuthenticatedRequest>),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocked.list).not.toHaveBeenCalled();
  });
});
