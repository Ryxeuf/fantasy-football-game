/**
 * Un joueur mort doit pouvoir sortir du roster, même sur une équipe
 * engagée (le verrou anti-triche ne visait que les joueurs actifs), et
 * ne doit plus bloquer le recrutement d'un remplaçant.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    team: { findFirst: vi.fn(), findUnique: vi.fn() },
    teamSelection: { findFirst: vi.fn() },
    teamPlayer: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
}));

vi.mock("../services/team-lock-status", () => ({
  isTeamRosterFrozen: vi.fn(),
  TEAM_ENGAGED_MESSAGE: "equipe engagee",
}));

vi.mock("../utils/team-values", () => ({
  updateTeamValues: vi.fn(async () => {}),
}));

import { prisma } from "../prisma";
import { isTeamRosterFrozen } from "../services/team-lock-status";
import { handleDeleteTeamPlayer } from "./team-player-handlers";
import type { AuthenticatedRequest } from "../middleware/authUser";
import type { Response } from "express";

const mocked = prisma as unknown as {
  team: { findFirst: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> };
  teamSelection: { findFirst: ReturnType<typeof vi.fn> };
  teamPlayer: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};

/** Réponse Express minimale : capture status + body. */
function makeRes(): Response & { statusCode: number; body: unknown } {
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
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function makeReq(playerId: string): AuthenticatedRequest {
  return {
    params: { id: "t1", playerId },
    user: { id: "owner-1" },
  } as unknown as AuthenticatedRequest;
}

const DEAD = { id: "dead-1", teamId: "t1", dead: true, firedAt: null };
const ALIVE = { id: "alive-1", teamId: "t1", dead: false, firedAt: null };

beforeEach(() => {
  vi.resetAllMocks();
  mocked.team.findFirst.mockResolvedValue({
    id: "t1",
    ownerId: "owner-1",
    players: [DEAD, ALIVE],
  });
  mocked.team.findUnique.mockResolvedValue({ id: "t1", players: [ALIVE] });
  mocked.teamSelection.findFirst.mockResolvedValue(null);
  mocked.teamPlayer.update.mockResolvedValue({});
  mocked.teamPlayer.delete.mockResolvedValue({});
});

describe("DELETE /team/:id/players/:playerId — joueur mort", () => {
  it("retire un joueur mort d'une équipe ENGAGÉE (retrait doux)", async () => {
    vi.mocked(isTeamRosterFrozen).mockResolvedValue(true);
    mocked.teamPlayer.findUnique.mockResolvedValue(DEAD);

    const res = makeRes();
    await handleDeleteTeamPlayer(makeReq("dead-1"), res);

    expect(res.statusCode).toBe(200);
    // Retrait doux : la ligne est conservée (pas de delete), seul
    // `firedAt` est posé — la mort reste réversible.
    expect(mocked.teamPlayer.delete).not.toHaveBeenCalled();
    const update = mocked.teamPlayer.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "dead-1" });
    expect(Object.keys(update.data)).toEqual(["firedAt"]);
  });

  it("refuse toujours de retirer un joueur VIVANT d'une équipe engagée", async () => {
    vi.mocked(isTeamRosterFrozen).mockResolvedValue(true);

    const res = makeRes();
    await handleDeleteTeamPlayer(makeReq("alive-1"), res);

    expect(res.statusCode).toBe(403);
    expect(mocked.teamPlayer.delete).not.toHaveBeenCalled();
    expect(mocked.teamPlayer.update).not.toHaveBeenCalled();
  });

  it("supprime normalement un joueur vivant d'une équipe en brouillon", async () => {
    vi.mocked(isTeamRosterFrozen).mockResolvedValue(false);

    const res = makeRes();
    await handleDeleteTeamPlayer(makeReq("alive-1"), res);

    expect(res.statusCode).toBe(200);
    expect(mocked.teamPlayer.delete).toHaveBeenCalledWith({
      where: { id: "alive-1" },
    });
  });

  it("refuse pendant un match en cours, même pour un joueur mort", async () => {
    vi.mocked(isTeamRosterFrozen).mockResolvedValue(true);
    mocked.teamSelection.findFirst.mockResolvedValue({ id: "sel-1" });

    const res = makeRes();
    await handleDeleteTeamPlayer(makeReq("dead-1"), res);

    expect(res.statusCode).toBe(400);
    expect(mocked.teamPlayer.update).not.toHaveBeenCalled();
  });
});
