/**
 * PATCH /leagues/pairings/:pairingId/schedule — handler unitaire :
 * service mocké, req/res faits à la main (même pattern que
 * `routes/league.test.ts`). Vérifie le passage du body validé et la
 * traduction des erreurs typées en statuts HTTP.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../services/league-pairing-schedule", () => ({
  schedulePairing: vi.fn(),
  // Class d'erreur DANS la factory (cf. CLAUDE.md).
  LeaguePairingScheduleError: class LeaguePairingScheduleError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "LeaguePairingScheduleError";
    }
  },
}));

vi.mock("../prisma", () => ({
  prisma: {},
}));

import type { Response } from "express";
import {
  schedulePairing,
  LeaguePairingScheduleError,
} from "../services/league-pairing-schedule";
import { handleSchedulePairing } from "./league";
import type { AuthenticatedRequest } from "../middleware/authUser";

type MockFn = ReturnType<typeof vi.fn>;
const mockSchedule = schedulePairing as unknown as MockFn;

function makeRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  } as unknown as Response & { status: MockFn; json: MockFn };
  res.status.mockReturnValue(res);
  return res;
}

function makeReq(overrides: Partial<AuthenticatedRequest> = {}) {
  return {
    user: { id: "u-home", roles: [] },
    params: { pairingId: "pair-1" },
    body: { scheduledAt: new Date("2026-09-12T18:30:00.000Z") },
    ...overrides,
  } as unknown as AuthenticatedRequest;
}

describe("handleSchedulePairing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 sans utilisateur", async () => {
    const res = makeRes();
    await handleSchedulePairing(makeReq({ user: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it("transmet pairingId, userId et la date validée au service", async () => {
    mockSchedule.mockResolvedValue({
      pairingId: "pair-1",
      scheduledAt: new Date("2026-09-12T18:30:00.000Z"),
      actorRole: "home",
      notified: 1,
    });
    const res = makeRes();
    await handleSchedulePairing(makeReq(), res);
    expect(mockSchedule).toHaveBeenCalledWith({
      pairingId: "pair-1",
      userId: "u-home",
      scheduledAt: new Date("2026-09-12T18:30:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ actorRole: "home", notified: 1 }),
      }),
    );
  });

  it.each([
    ["pairing_not_found", 404],
    ["forbidden", 403],
    ["pairing_closed", 409],
  ])("traduit %s en %i", async (code, status) => {
    mockSchedule.mockRejectedValue(
      new LeaguePairingScheduleError(code as "forbidden", "refus"),
    );
    const res = makeRes();
    await handleSchedulePairing(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: "refus" });
  });
});
