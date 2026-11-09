/**
 * Suppression d'une saison : Prisma, la visibilité, le fan offert et les
 * notifications sont mockés ; la décision est la règle pure réelle.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  leagueSeason: { findUnique: vi.fn(), delete: vi.fn() },
  leagueMatchSheet: { count: vi.fn() },
  match: { count: vi.fn() },
  leaguePairing: { count: vi.fn() },
  leaguePostMatchSequence: { count: vi.fn() },
  leagueParticipant: { findMany: vi.fn(), count: vi.fn() },
  leagueInvitation: { updateMany: vi.fn() },
}));

vi.mock("../prisma", () => ({ prisma: db }));

vi.mock("./league-access", () => ({
  LEAGUE_VISIBILITY_SELECT: { id: true, creatorId: true, isPublic: true },
  canViewLeagueRow: vi.fn(),
}));

vi.mock("./league-free-fan", () => ({
  withLeagueFreeFansRevokedForSeason: vi.fn(),
}));

vi.mock("./in-app-notifications", () => ({
  createInAppNotifications: vi.fn(),
}));

import { canViewLeagueRow } from "./league-access";
import { withLeagueFreeFansRevokedForSeason } from "./league-free-fan";
import { createInAppNotifications } from "./in-app-notifications";
import {
  deleteLeagueSeason,
  LeagueSeasonDeletionError,
} from "./league-season-deletion";

const canView = vi.mocked(canViewLeagueRow);
const revoke = vi.mocked(withLeagueFreeFansRevokedForSeason);
const notify = vi.mocked(createInAppNotifications);
const COMMISSIONER = { userId: "u-comm", isAdmin: false };

function season(over: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    name: "Saison 2027",
    seasonNumber: 2,
    status: "scheduled",
    league: { id: "lg-1", creatorId: "u-comm", isPublic: true, name: "Kraken" },
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  canView.mockResolvedValue(true);
  db.leagueSeason.findUnique.mockResolvedValue(season());
  db.leagueSeason.delete.mockResolvedValue({});
  db.leagueMatchSheet.count.mockResolvedValue(0);
  db.match.count.mockResolvedValue(0);
  db.leaguePairing.count.mockResolvedValue(0);
  db.leaguePostMatchSequence.count.mockResolvedValue(0);
  db.leagueParticipant.findMany.mockResolvedValue([
    { team: { ownerId: "u-comm" } },
    { team: { ownerId: "u-a" } },
    { team: { ownerId: "u-a" } },
    { team: { ownerId: "u-b" } },
  ]);
  db.leagueParticipant.count.mockResolvedValue(4);
  db.leagueInvitation.updateMany.mockResolvedValue({ count: 1 });
  revoke.mockImplementation(async (_seasonId, op) => op(db as never));
  notify.mockResolvedValue(2);
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(LeagueSeasonDeletionError);
  await expect(p).rejects.toMatchObject({ code });
}

describe("deleteLeagueSeason", () => {
  it("saison sans effet joué : fans repris, invitations annulées, saison supprimée, coachs notifiés", async () => {
    const out = await deleteLeagueSeason({ seasonId: "s-1", actor: COMMISSIONER });

    expect(revoke).toHaveBeenCalledWith("s-1", expect.any(Function));
    expect(db.leagueInvitation.updateMany).toHaveBeenCalledWith({
      where: { seasonId: "s-1", status: "pending" },
      data: { status: "cancelled" },
    });
    expect(db.leagueSeason.delete).toHaveBeenCalledWith({ where: { id: "s-1" } });
    // Dédoublonnés, auteur exclu, APRÈS la suppression.
    expect(notify).toHaveBeenCalledWith(
      ["u-a", "u-b"],
      expect.objectContaining({
        kind: "league.season.deleted",
        url: "/leagues/lg-1",
      }),
    );
    expect(notify.mock.invocationCallOrder[0]).toBeGreaterThan(
      db.leagueSeason.delete.mock.invocationCallOrder[0],
    );
    expect(out).toEqual({
      deleted: true,
      seasonId: "s-1",
      leagueId: "lg-1",
      name: "Saison 2027",
      seasonNumber: 2,
      participantsRemoved: 4,
      invitationsCancelled: 1,
      notified: 2,
    });
  });

  it("un admin non commissaire peut supprimer", async () => {
    await deleteLeagueSeason({
      seasonId: "s-1",
      actor: { userId: "u-admin", isAdmin: true },
    });
    expect(db.leagueSeason.delete).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(
      ["u-comm", "u-a", "u-b"],
      expect.objectContaining({
        body: expect.stringContaining("par un administrateur"),
      }),
    );
  });

  it("saison inconnue ⇒ season_not_found", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(null);
    await expectCode(
      deleteLeagueSeason({ seasonId: "s-x", actor: COMMISSIONER }),
      "season_not_found",
    );
  });

  it("ligue privée invisible ⇒ season_not_found, rien n'est compté", async () => {
    canView.mockResolvedValue(false);
    await expectCode(
      deleteLeagueSeason({
        seasonId: "s-1",
        actor: { userId: "u-stranger", isAdmin: false },
      }),
      "season_not_found",
    );
    expect(db.leagueMatchSheet.count).not.toHaveBeenCalled();
    expect(db.leagueSeason.delete).not.toHaveBeenCalled();
  });

  it("coach de la ligue (visible) ⇒ forbidden", async () => {
    await expectCode(
      deleteLeagueSeason({
        seasonId: "s-1",
        actor: { userId: "u-a", isAdmin: false },
      }),
      "forbidden",
    );
    expect(db.leagueSeason.delete).not.toHaveBeenCalled();
  });

  it.each([
    ["feuille validée", () => db.leagueMatchSheet.count.mockResolvedValue(1), "sheets_validated"],
    ["résultat saisi", () => db.leaguePairing.count.mockResolvedValue(1), "results_recorded"],
    ["match reporté", () => db.match.count.mockResolvedValue(1), "matches_scored"],
    ["séquence d'après-match", () => db.leaguePostMatchSequence.count.mockResolvedValue(1), "post_match_sequences"],
  ] as const)("%s ⇒ refus %s, rien n'est touché", async (_l, arrange, code) => {
    arrange();
    await expectCode(
      deleteLeagueSeason({ seasonId: "s-1", actor: COMMISSIONER }),
      code,
    );
    expect(revoke).not.toHaveBeenCalled();
    expect(db.leagueSeason.delete).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it("compte les effets sur les bons périmètres", async () => {
    await deleteLeagueSeason({ seasonId: "s-1", actor: COMMISSIONER });
    expect(db.leagueMatchSheet.count).toHaveBeenCalledWith({
      where: {
        pairing: { round: { seasonId: "s-1" } },
        status: { in: ["validated", "invalidated"] },
      },
    });
    expect(db.match.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { leagueSeasonId: "s-1" },
          { leaguePairing: { round: { seasonId: "s-1" } } },
        ],
        leagueScoredAt: { not: null },
      },
    });
    expect(db.leaguePairing.count).toHaveBeenCalledWith({
      where: {
        round: { seasonId: "s-1" },
        status: { in: ["played", "forfeit_home", "forfeit_away"] },
      },
    });
    expect(db.leaguePostMatchSequence.count).toHaveBeenCalledWith({
      where: { seasonId: "s-1" },
    });
  });

  it("échec de la suppression : aucune notification", async () => {
    db.leagueSeason.delete.mockRejectedValue(new Error("db down"));
    await expect(
      deleteLeagueSeason({ seasonId: "s-1", actor: COMMISSIONER }),
    ).rejects.toThrow("db down");
    expect(notify).not.toHaveBeenCalled();
  });
});
