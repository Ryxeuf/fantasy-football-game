/**
 * Renommer / supprimer une journée : Prisma et la visibilité des ligues sont
 * mockés ; la décision de suppression est la règle pure réelle.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  leagueRound: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  leaguePairing: { findMany: vi.fn() },
  match: { count: vi.fn() },
}));

vi.mock("../prisma", () => ({ prisma: db }));

vi.mock("./league-access", () => ({
  LEAGUE_VISIBILITY_SELECT: { id: true, creatorId: true, isPublic: true },
  canViewLeagueRow: vi.fn(),
}));

import { canViewLeagueRow } from "./league-access";
import {
  deleteLeagueRound,
  updateLeagueRound,
  LeagueRoundAdminError,
} from "./league-round-admin";

const canView = vi.mocked(canViewLeagueRow);
const COMMISSIONER = { userId: "u-comm", isAdmin: false };

function round(over: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    seasonId: "s-1",
    roundNumber: 3,
    name: "Journee 3",
    kind: "regular",
    bracketSlot: null,
    startDate: null,
    endDate: null,
    season: {
      status: "in_progress",
      league: { id: "lg-1", creatorId: "u-comm", isPublic: true },
    },
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  canView.mockResolvedValue(true);
  db.leagueRound.findUnique.mockResolvedValue(round());
  db.leagueRound.update.mockImplementation(async (args: { data: object }) => ({
    ...round(),
    ...args.data,
  }));
  db.leagueRound.delete.mockResolvedValue({});
  db.leaguePairing.findMany.mockResolvedValue([]);
  db.match.count.mockResolvedValue(0);
});

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toBeInstanceOf(LeagueRoundAdminError);
  await expect(p).rejects.toMatchObject({ code });
}

describe("updateLeagueRound", () => {
  it("renomme la journée (nom rogné)", async () => {
    const out = await updateLeagueRound({
      roundId: "r-1",
      actor: COMMISSIONER,
      name: "  Derby  ",
    });
    expect(db.leagueRound.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { name: "Derby" },
    });
    expect(out.round.name).toBe("Derby");
    expect(out.before.name).toBe("Journee 3");
  });

  it("nom vide ⇒ null (nom par défaut « Journée N »)", async () => {
    await updateLeagueRound({ roundId: "r-1", actor: COMMISSIONER, name: "" });
    expect(db.leagueRound.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { name: null },
    });
  });

  it("change les dates sans toucher au nom", async () => {
    const start = new Date("2026-11-10T00:00:00.000Z");
    const end = new Date("2026-11-17T00:00:00.000Z");
    await updateLeagueRound({
      roundId: "r-1",
      actor: COMMISSIONER,
      startDate: start,
      endDate: end,
    });
    expect(db.leagueRound.update).toHaveBeenCalledWith({
      where: { id: "r-1" },
      data: { startDate: start, endDate: end },
    });
  });

  it("refuse une fin avant le début (date stockée comprise)", async () => {
    db.leagueRound.findUnique.mockResolvedValue(
      round({ startDate: new Date("2026-11-10T00:00:00.000Z") }),
    );
    await expectCode(
      updateLeagueRound({
        roundId: "r-1",
        actor: COMMISSIONER,
        endDate: new Date("2026-11-01T00:00:00.000Z"),
      }),
      "invalid_dates",
    );
    expect(db.leagueRound.update).not.toHaveBeenCalled();
  });

  it("renommer reste ouvert sur une saison clôturée", async () => {
    db.leagueRound.findUnique.mockResolvedValue(
      round({
        season: {
          status: "completed",
          league: { id: "lg-1", creatorId: "u-comm", isPublic: true },
        },
      }),
    );
    await updateLeagueRound({ roundId: "r-1", actor: COMMISSIONER, name: "X" });
    expect(db.leagueRound.update).toHaveBeenCalled();
  });

  it("journée inconnue ⇒ round_not_found", async () => {
    db.leagueRound.findUnique.mockResolvedValue(null);
    await expectCode(
      updateLeagueRound({ roundId: "r-x", actor: COMMISSIONER, name: "X" }),
      "round_not_found",
    );
  });

  it("ligue privée invisible ⇒ round_not_found (pas forbidden)", async () => {
    canView.mockResolvedValue(false);
    await expectCode(
      updateLeagueRound({
        roundId: "r-1",
        actor: { userId: "u-other", isAdmin: false },
        name: "X",
      }),
      "round_not_found",
    );
  });

  it("autre coach (ligue visible) ⇒ forbidden", async () => {
    await expectCode(
      updateLeagueRound({
        roundId: "r-1",
        actor: { userId: "u-other", isAdmin: false },
        name: "X",
      }),
      "forbidden",
    );
  });
});

describe("deleteLeagueRound", () => {
  it("supprime une journée à jouer et dénombre la cascade", async () => {
    db.leaguePairing.findMany.mockResolvedValue([
      {
        status: "scheduled",
        match: null,
        matchSheet: { status: "draft" },
        _count: { predictions: 2 },
      },
      { status: "scheduled", match: null, matchSheet: null, _count: { predictions: 0 } },
    ]);
    const out = await deleteLeagueRound({ roundId: "r-1", actor: COMMISSIONER });
    expect(db.leagueRound.delete).toHaveBeenCalledWith({ where: { id: "r-1" } });
    expect(out).toMatchObject({
      deleted: true,
      roundId: "r-1",
      seasonId: "s-1",
      roundNumber: 3,
      pairingsRemoved: 2,
      draftSheetsRemoved: 1,
      predictionsRemoved: 2,
    });
  });

  it("cherche les matchs reportés par la journée ET par ses rencontres", async () => {
    await deleteLeagueRound({ roundId: "r-1", actor: COMMISSIONER });
    expect(db.match.count).toHaveBeenCalledWith({
      where: {
        OR: [{ leagueRoundId: "r-1" }, { leaguePairing: { roundId: "r-1" } }],
        leagueScoredAt: { not: null },
      },
    });
  });

  it("rencontre jouée ⇒ refus, rien n'est supprimé", async () => {
    db.leaguePairing.findMany.mockResolvedValue([
      { status: "played", match: null, matchSheet: null, _count: { predictions: 0 } },
    ]);
    await expectCode(
      deleteLeagueRound({ roundId: "r-1", actor: COMMISSIONER }),
      "pairing_engaged",
    );
    expect(db.leagueRound.delete).not.toHaveBeenCalled();
  });

  it("feuille soumise ⇒ refus", async () => {
    db.leaguePairing.findMany.mockResolvedValue([
      {
        status: "scheduled",
        match: null,
        matchSheet: { status: "submitted_home" },
        _count: { predictions: 0 },
      },
    ]);
    await expectCode(
      deleteLeagueRound({ roundId: "r-1", actor: COMMISSIONER }),
      "sheet_submitted",
    );
  });

  it("match reporté au classement ⇒ refus", async () => {
    db.match.count.mockResolvedValue(1);
    await expectCode(
      deleteLeagueRound({ roundId: "r-1", actor: COMMISSIONER }),
      "match_scored",
    );
  });

  it("journée de play-off (slot) ⇒ refus", async () => {
    db.leagueRound.findUnique.mockResolvedValue(round({ bracketSlot: "final" }));
    await expectCode(
      deleteLeagueRound({ roundId: "r-1", actor: COMMISSIONER }),
      "playoff_round",
    );
  });

  it("un admin non commissaire ne supprime pas (posture des routes voisines)", async () => {
    await expectCode(
      deleteLeagueRound({
        roundId: "r-1",
        actor: { userId: "u-admin", isAdmin: true },
      }),
      "forbidden",
    );
    expect(db.leagueRound.delete).not.toHaveBeenCalled();
  });
});
