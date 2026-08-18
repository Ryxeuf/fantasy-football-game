/**
 * Retrait du roster d'un joueur déjà inactif (mort ou licencié).
 *
 * Le verrou anti-triche interdit de retirer un joueur d'une équipe
 * engagée : un joueur mort restait donc sur la feuille à vie. Ce retrait
 * doux le sort du roster sans toucher à la provenance de sa mort, qui
 * doit rester réversible si la feuille de match est invalidée.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    teamPlayer: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { removeInactivePlayerFromRoster } from "./player-status";

const mocked = prisma as unknown as {
  teamPlayer: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.resetAllMocks();
  mocked.teamPlayer.update.mockResolvedValue({});
});

describe("removeInactivePlayerFromRoster", () => {
  it("sort un joueur mort du roster sans toucher à sa mort", async () => {
    mocked.teamPlayer.findUnique.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      dead: true,
      firedAt: null,
    });

    const out = await removeInactivePlayerFromRoster({ playerId: "p1" });

    expect(out).toEqual({ removed: true, teamId: "t1" });
    const call = mocked.teamPlayer.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "p1" });
    // Seul `firedAt` bouge : `dead`, `diedAt` et la provenance restent en
    // place pour que l'invalidation d'une feuille puisse reverter la mort.
    expect(Object.keys(call.data)).toEqual(["firedAt"]);
    expect(call.data.firedAt).toBeInstanceOf(Date);
  });

  it("est idempotent sur un joueur déjà licencié", async () => {
    mocked.teamPlayer.findUnique.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      dead: false,
      firedAt: new Date("2026-01-01"),
    });

    const out = await removeInactivePlayerFromRoster({ playerId: "p1" });

    expect(out).toEqual({ removed: true, teamId: "t1" });
    expect(mocked.teamPlayer.update).not.toHaveBeenCalled();
  });

  it("refuse un joueur encore actif (il passe par la suppression normale)", async () => {
    mocked.teamPlayer.findUnique.mockResolvedValue({
      id: "p1",
      teamId: "t1",
      dead: false,
      firedAt: null,
    });

    expect(await removeInactivePlayerFromRoster({ playerId: "p1" })).toEqual({
      skipped: true,
      reason: "player-active",
    });
    expect(mocked.teamPlayer.update).not.toHaveBeenCalled();
  });

  it("refuse un joueur d'une autre équipe", async () => {
    mocked.teamPlayer.findUnique.mockResolvedValue({
      id: "p1",
      teamId: "autre-equipe",
      dead: true,
      firedAt: null,
    });

    expect(
      await removeInactivePlayerFromRoster({
        playerId: "p1",
        allowedTeamIds: ["t1"],
      }),
    ).toEqual({ skipped: true, reason: "team-not-allowed" });
    expect(mocked.teamPlayer.update).not.toHaveBeenCalled();
  });

  it("refuse un joueur introuvable", async () => {
    mocked.teamPlayer.findUnique.mockResolvedValue(null);
    expect(await removeInactivePlayerFromRoster({ playerId: "nope" })).toEqual({
      skipped: true,
      reason: "player-not-found",
    });
  });
});
