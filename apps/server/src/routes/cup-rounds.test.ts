/**
 * Routes des rondes suisses : handlers unitaires (service mocké), passage
 * de l'acteur (créateur / admin) et traduction des erreurs typées.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/cup-rounds", () => ({
  listCupRounds: vi.fn(),
  generateSwissCupRound: vi.fn(),
  deleteLastCupRound: vi.fn(),
  scheduleCupPairing: vi.fn(),
  cancelCupPairing: vi.fn(),
  CupRoundError: class CupRoundError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CupRoundError";
    }
  },
}));
vi.mock("../prisma", () => ({ prisma: {} }));

import type { Response } from "express";
import {
  generateSwissCupRound,
  listCupRounds,
  scheduleCupPairing,
  CupRoundError,
} from "../services/cup-rounds";
import {
  handleGenerateSwissRound,
  handleListCupRounds,
  handleScheduleCupPairing,
} from "./cup-rounds";
import type { AuthenticatedRequest } from "../middleware/authUser";

type MockFn = ReturnType<typeof vi.fn>;
const mocked = {
  list: listCupRounds as unknown as MockFn,
  generate: generateSwissCupRound as unknown as MockFn,
  schedule: scheduleCupPairing as unknown as MockFn,
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
    user: { id: "u1", roles: ["admin"] },
    params: { id: "cup-1", pairingId: "p1" },
    body: {},
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

describe("routes cup-rounds", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 sans utilisateur", async () => {
    const res = makeRes();
    await handleListCupRounds(makeReq({ user: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("liste les rondes", async () => {
    mocked.list.mockResolvedValue([{ id: "r1" }]);
    const res = makeRes();
    await handleListCupRounds(makeReq(), res);
    expect(mocked.list).toHaveBeenCalledWith("cup-1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { rounds: [{ id: "r1" }] } });
  });

  it("génère une ronde avec l'acteur (admin reconnu) -> 201", async () => {
    mocked.generate.mockResolvedValue({ id: "r1", roundNumber: 1 });
    const res = makeRes();
    await handleGenerateSwissRound(makeReq(), res);
    expect(mocked.generate).toHaveBeenCalledWith({
      cupId: "cup-1",
      actor: { userId: "u1", isAdmin: true },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it.each([
    ["cup_not_found", 404],
    ["forbidden", 403],
    ["round_in_progress", 409],
  ])("traduit %s en %i", async (code, status) => {
    mocked.generate.mockRejectedValue(new CupRoundError(code as "forbidden", "refus"));
    const res = makeRes();
    await handleGenerateSwissRound(makeReq({ user: { id: "u1", roles: [] } } as never), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "refus" });
  });

  it("transmet la date (ou null) au service de planification", async () => {
    mocked.schedule.mockResolvedValue({ pairingId: "p1", scheduledAt: null });
    const res = makeRes();
    await handleScheduleCupPairing(makeReq({ body: { scheduledAt: null } } as never), res);
    expect(mocked.schedule).toHaveBeenCalledWith({
      pairingId: "p1",
      actor: { userId: "u1", isAdmin: true },
      scheduledAt: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
