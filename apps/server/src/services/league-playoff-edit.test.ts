import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    leagueSeason: { findUnique: vi.fn(), update: vi.fn() },
    leagueRound: { findMany: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import { resetPlayoffBracket } from "./league-playoff-edit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const COMMISSIONER = { userId: "u-com", isAdmin: false };

function season(over: Record<string, unknown> = {}) {
  return {
    id: "s1",
    status: "in_progress",
    league: { id: "l1", creatorId: "u-com" },
    ...over,
  };
}

function pairingRow(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    status: "scheduled",
    homeParticipantId: "a",
    awayParticipantId: "b",
    match: null,
    matchSheet: null,
    ...over,
  };
}

describe("resetPlayoffBracket", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockResolvedValue([]);
    db.leagueRound.deleteMany.mockReturnValue("deleteMany-op");
    db.leagueSeason.update.mockReturnValue("season-update-op");
  });

  it("404 quand la saison n'existe pas", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(null);
    await expect(resetPlayoffBracket("s1", COMMISSIONER)).rejects.toMatchObject(
      { code: "season_not_found" },
    );
  });

  it("refuse un coach qui n'est pas commissaire", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(season());
    await expect(
      resetPlayoffBracket("s1", { userId: "u-coach", isAdmin: false }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(db.leagueRound.findMany).not.toHaveBeenCalled();
  });

  it("supprime tous les tours de bracket (kind OU bracketSlot) et remet la publication à null", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(season());
    db.leagueRound.findMany.mockResolvedValue([
      { id: "r1", pairings: [pairingRow()] },
      {
        id: "r2",
        pairings: [
          pairingRow({ id: "p2", matchSheet: { status: "draft", _count: { events: 0 } } }),
        ],
      },
    ]);

    const out = await resetPlayoffBracket("s1", COMMISSIONER);

    expect(out).toEqual({ seasonId: "s1", roundsDeleted: 2 });
    const expectedWhere = {
      seasonId: "s1",
      OR: [{ kind: "playoff" }, { bracketSlot: { not: null } }],
    };
    expect(db.leagueRound.findMany.mock.calls[0][0].where).toEqual(
      expectedWhere,
    );
    expect(db.leagueRound.deleteMany).toHaveBeenCalledWith({
      where: expectedWhere,
    });
    expect(db.leagueSeason.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { playoffsPublished: null },
    });
    expect(db.$transaction).toHaveBeenCalledWith([
      "deleteMany-op",
      "season-update-op",
    ]);
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "league.playoff:reset" }),
      }),
    );
  });

  it("un admin non commissaire peut réinitialiser", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(season());
    db.leagueRound.findMany.mockResolvedValue([
      { id: "r1", pairings: [pairingRow()] },
    ]);
    await expect(
      resetPlayoffBracket("s1", { userId: "u-admin", isAdmin: true }),
    ).resolves.toMatchObject({ roundsDeleted: 1 });
  });

  it("refuse si une rencontre du bracket a une feuille soumise", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(season());
    db.leagueRound.findMany.mockResolvedValue([
      {
        id: "r1",
        pairings: [
          pairingRow({
            matchSheet: { status: "submitted_home", _count: { events: 3 } },
          }),
        ],
      },
    ]);
    await expect(resetPlayoffBracket("s1", COMMISSIONER)).rejects.toMatchObject(
      { code: "bracket_engaged" },
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuse une saison clôturée", async () => {
    db.leagueSeason.findUnique.mockResolvedValue(
      season({ status: "completed" }),
    );
    db.leagueRound.findMany.mockResolvedValue([
      { id: "r1", pairings: [pairingRow()] },
    ]);
    await expect(resetPlayoffBracket("s1", COMMISSIONER)).rejects.toMatchObject(
      { code: "season_completed" },
    );
  });
});
