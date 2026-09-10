/**
 * Routes des play-offs de coupe : handlers unitaires (service mocké). La
 * couche route ne porte que trois choses — l'acteur, le passage des champs,
 * et la traduction des erreurs typées en statuts HTTP.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/cup-playoffs", () => {
  class CupPlayoffError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CupPlayoffError";
    }
  }
  return {
    CupPlayoffError,
    getCupBracket: vi.fn(),
    startCupPlayoffs: vi.fn(),
    setCupPlayoffsPublished: vi.fn(),
    overrideCupPlayoffSeeds: vi.fn(),
  };
});
vi.mock("../prisma", () => ({ prisma: {} }));

import type { Response } from "express";
import {
  CupPlayoffError,
  getCupBracket,
  overrideCupPlayoffSeeds,
  setCupPlayoffsPublished,
  startCupPlayoffs,
} from "../services/cup-playoffs";
import {
  handleGetCupBracket,
  handleOverrideCupPlayoffSeeds,
  handlePublishCupPlayoffs,
  handleStartCupPlayoffs,
} from "./cup-playoffs";
import type { AuthenticatedRequest } from "../middleware/authUser";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  bracket: getCupBracket as unknown as MockFn,
  start: startCupPlayoffs as unknown as MockFn,
  publish: setCupPlayoffsPublished as unknown as MockFn,
  seeds: overrideCupPlayoffSeeds as unknown as MockFn,
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
    params: { id: "cup-1" },
    body: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

beforeEach(() => vi.resetAllMocks());

describe("play-offs de coupe — handlers", () => {
  it("sert le bracket au lecteur courant", async () => {
    mocked.bracket.mockResolvedValue({ published: true, rounds: [] });
    await handleGetCupBracket(makeReq(), makeRes());
    expect(mocked.bracket).toHaveBeenCalledWith({
      cupId: "cup-1",
      viewerId: "u1",
      isAdmin: false,
    });
  });

  it("génère le premier tour et répond 201", async () => {
    mocked.start.mockResolvedValue({ size: 4, created: 2 });
    const res = makeRes();
    await handleStartCupPlayoffs(makeReq({ body: { force: true } }), res);
    expect(mocked.start).toHaveBeenCalledWith({
      cupId: "cup-1",
      actor: { userId: "u1", isAdmin: false },
      force: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("`force` absent vaut faux — jamais une clôture forcée par défaut", async () => {
    mocked.start.mockResolvedValue({ size: 4, created: 2 });
    await handleStartCupPlayoffs(makeReq(), makeRes());
    expect(mocked.start.mock.calls[0][0].force).toBe(false);
  });

  it("reconnaît un administrateur", async () => {
    mocked.publish.mockResolvedValue({ published: true });
    await handlePublishCupPlayoffs(
      makeReq({
        user: { id: "u9", roles: ["admin"] },
        body: { published: true },
      } as Partial<AuthenticatedRequest>),
      makeRes(),
    );
    expect(mocked.publish.mock.calls[0][0].actor).toEqual({
      userId: "u9",
      isAdmin: true,
    });
  });

  it("publie et dépublie", async () => {
    mocked.publish.mockResolvedValue({ published: false });
    await handlePublishCupPlayoffs(
      makeReq({ body: { published: false } }),
      makeRes(),
    );
    expect(mocked.publish.mock.calls[0][0].published).toBe(false);
  });

  it("réécrit les têtes de série", async () => {
    mocked.seeds.mockResolvedValue({ size: 4 });
    await handleOverrideCupPlayoffSeeds(
      makeReq({ body: { teamIds: ["t1", "t2", "t3", "t4"] } }),
      makeRes(),
    );
    expect(mocked.seeds.mock.calls[0][0].teamIds).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
    ]);
  });

  it("traduit chaque code d'erreur en son statut", async () => {
    const cases: Array<[string, number]> = [
      ["cup_not_found", 404],
      ["forbidden", 403],
      // Configuration invalide : l'appelant peut corriger ⇒ 400.
      ["playoffs_disabled", 400],
      ["size_mismatch", 400],
      ["duplicate_team", 400],
      ["team_not_in_cup", 400],
      // Conflits d'état ⇒ 409.
      ["playoffs_already_started", 409],
      ["playoffs_not_started", 409],
      ["regular_rounds_open", 409],
      ["insufficient_participants", 409],
      ["pool_qualification_mismatch", 409],
      ["playoffs_in_progress", 409],
    ];
    for (const [code, status] of cases) {
      mocked.start.mockRejectedValue(new CupPlayoffError(code, "boum"));
      const res = makeRes();
      await handleStartCupPlayoffs(makeReq(), res);
      expect(res.status, code).toHaveBeenCalledWith(status);
    }
  });

  it("rend 500 sur une erreur inattendue", async () => {
    mocked.bracket.mockRejectedValue(new Error("boum"));
    const res = makeRes();
    await handleGetCupBracket(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("refuse un appelant non authentifié", async () => {
    const res = makeRes();
    await handleGetCupBracket(
      makeReq({ user: undefined } as Partial<AuthenticatedRequest>),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocked.bracket).not.toHaveBeenCalled();
  });
});
