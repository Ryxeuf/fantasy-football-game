/**
 * Tests des handlers d'archivage / suppression (service mocké).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../services/competition-lifecycle", () => {
  class CompetitionLifecycleError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "CompetitionLifecycleError";
    }
  }
  return {
    CompetitionLifecycleError,
    archiveLeague: vi.fn(),
    deleteLeague: vi.fn(),
    archiveCup: vi.fn(),
    deleteCup: vi.fn(),
  };
});

vi.mock("../utils/server-log", () => ({
  serverLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}));

import {
  handleArchiveCompetition,
  handleDeleteCompetition,
  leagueLifecycleRouter,
  cupLifecycleRouter,
} from "./competition-lifecycle";
import {
  archiveLeague,
  deleteLeague,
  archiveCup,
  deleteCup,
  CompetitionLifecycleError,
} from "../services/competition-lifecycle";

const svc = {
  archiveLeague: archiveLeague as ReturnType<typeof vi.fn>,
  deleteLeague: deleteLeague as ReturnType<typeof vi.fn>,
  archiveCup: archiveCup as ReturnType<typeof vi.fn>,
  deleteCup: deleteCup as ReturnType<typeof vi.fn>,
};

function createRes() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = {};
  res.status = vi.fn((c: number) => {
    res.statusCode = c;
    return res;
  });
  res.json = vi.fn((p: unknown) => {
    res.payload = p;
    return res;
  });
  return res;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createReq(overrides: any = {}): any {
  return {
    body: {},
    params: { id: "lg-1" },
    query: {},
    user: { id: "user-1", roles: ["user"] },
    ...overrides,
  };
}

describe("routes/competition-lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("401 sans utilisateur", async () => {
    const res = createRes();
    await handleArchiveCompetition("league", createReq({ user: undefined }), res);
    expect(res.statusCode).toBe(401);
    expect(svc.archiveLeague).not.toHaveBeenCalled();
  });

  it("archive une ligue : acteur dérivé de req.user (isAdmin selon le rôle)", async () => {
    svc.archiveLeague.mockResolvedValue({ id: "lg-1", changed: true });
    const res = createRes();
    await handleArchiveCompetition(
      "league",
      createReq({ user: { id: "adm", roles: ["user", "admin"] } }),
      res,
    );
    expect(svc.archiveLeague).toHaveBeenCalledWith("lg-1", {
      userId: "adm",
      isAdmin: true,
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      success: true,
      data: { id: "lg-1", changed: true },
    });
  });

  it("archive une coupe via le service coupe", async () => {
    svc.archiveCup.mockResolvedValue({ id: "cup-1", changed: false });
    const res = createRes();
    await handleArchiveCompetition("cup", createReq({ params: { id: "cup-1" } }), res);
    expect(svc.archiveCup).toHaveBeenCalledWith("cup-1", {
      userId: "user-1",
      isAdmin: false,
    });
    expect(svc.archiveLeague).not.toHaveBeenCalled();
  });

  it("supprime : payload enrichi de deleted=true", async () => {
    svc.deleteLeague.mockResolvedValue({ id: "lg-1", name: "L", notified: 2 });
    const res = createRes();
    await handleDeleteCompetition("league", createReq(), res);
    expect(res.payload).toEqual({
      success: true,
      data: { id: "lg-1", name: "L", notified: 2, deleted: true },
    });
    svc.deleteCup.mockResolvedValue({ id: "cup-1", name: "C", notified: 0 });
    const res2 = createRes();
    await handleDeleteCompetition("cup", createReq({ params: { id: "cup-1" } }), res2);
    expect(svc.deleteCup).toHaveBeenCalledWith("cup-1", expect.anything());
  });

  it("mappe not_found → 404 et forbidden → 403", async () => {
    svc.deleteLeague.mockRejectedValue(
      new CompetitionLifecycleError("not_found", "Ligue introuvable"),
    );
    const res = createRes();
    await handleDeleteCompetition("league", createReq(), res);
    expect(res.statusCode).toBe(404);
    expect(res.payload).toEqual({ success: false, error: "Ligue introuvable" });

    svc.archiveCup.mockRejectedValue(
      new CompetitionLifecycleError("forbidden", "Non"),
    );
    const res2 = createRes();
    await handleArchiveCompetition("cup", createReq(), res2);
    expect(res2.statusCode).toBe(403);
  });

  it("erreur inattendue → 500 propre", async () => {
    svc.archiveLeague.mockRejectedValue(new Error("boom"));
    const res = createRes();
    await handleArchiveCompetition("league", createReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res.payload).toEqual({ success: false, error: "Erreur serveur" });
  });

  it("expose deux routeurs Express distincts", () => {
    expect(typeof leagueLifecycleRouter).toBe("function");
    expect(typeof cupLifecycleRouter).toBe("function");
    expect(leagueLifecycleRouter).not.toBe(cupLifecycleRouter);
  });
});
