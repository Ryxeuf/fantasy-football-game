/**
 * Lot P.B.3 — Tests du service pro-season-factory.
 *
 * Couvre :
 *  - resetStandings : success, season not found, season archived
 *  - cancelSeason : success, idempotent (deja cancelled), archived refus
 *  - forceForfeit : home/away, already completed (409), invalid input,
 *    match not found
 *  - cloneSeason : success (teams + standings), duplicate year, from
 *    not found
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueSeason: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    proLeagueStandings: { updateMany: vi.fn(), createMany: vi.fn() },
    proLeagueMatch: { findUnique: vi.fn(), update: vi.fn() },
    proTeam: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  resetStandings,
  cancelSeason,
  forceForfeit,
  cloneSeason,
  SeasonFactoryError,
} from "./pro-season-factory";

interface MockedPrisma {
  proLeagueSeason: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  proLeagueStandings: {
    updateMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  proTeam: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resetStandings", () => {
  it("zero out tous les standings de la saison", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      status: "in_progress",
    });
    mocked.proLeagueStandings.updateMany.mockResolvedValueOnce({ count: 16 });

    const result = await resetStandings("s1");

    expect(result).toEqual({ seasonId: "s1", resetCount: 16 });
    const call = mocked.proLeagueStandings.updateMany.mock.calls[0]![0];
    expect(call.where).toEqual({ seasonId: "s1" });
    expect(call.data.played).toBe(0);
    expect(call.data.points).toBe(0);
    expect(call.data.form).toEqual([]);
  });

  it("SEASON_NOT_FOUND si saison inexistante", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce(null);
    await expect(resetStandings("ghost")).rejects.toMatchObject({
      code: "SEASON_NOT_FOUND",
    });
    expect(mocked.proLeagueStandings.updateMany).not.toHaveBeenCalled();
  });

  it("SEASON_HAS_RESULTS si archived", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      status: "archived",
    });
    await expect(resetStandings("s1")).rejects.toMatchObject({
      code: "SEASON_HAS_RESULTS",
    });
  });
});

describe("cancelSeason", () => {
  it("passe la saison a 'cancelled'", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      status: "in_progress",
    });
    mocked.proLeagueSeason.update.mockResolvedValueOnce({});

    const result = await cancelSeason("s1");

    expect(result).toEqual({ seasonId: "s1", previousStatus: "in_progress" });
    expect(mocked.proLeagueSeason.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "cancelled" },
    });
  });

  it("idempotent si deja cancelled (no update call)", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      status: "cancelled",
    });
    const result = await cancelSeason("s1");
    expect(result.previousStatus).toBe("cancelled");
    expect(mocked.proLeagueSeason.update).not.toHaveBeenCalled();
  });

  it("refuse si archived", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce({
      id: "s1",
      status: "archived",
    });
    await expect(cancelSeason("s1")).rejects.toMatchObject({
      code: "SEASON_HAS_RESULTS",
    });
  });

  it("SEASON_NOT_FOUND si inexistante", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce(null);
    await expect(cancelSeason("ghost")).rejects.toMatchObject({
      code: "SEASON_NOT_FOUND",
    });
  });
});

describe("forceForfeit", () => {
  it("home winner : status=completed, outcome=home, scores 1-0", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "scheduled",
    });
    mocked.proLeagueMatch.update.mockResolvedValueOnce({});

    const result = await forceForfeit({ matchId: "m1", winnerSide: "home" });

    expect(result.previousStatus).toBe("scheduled");
    const call = mocked.proLeagueMatch.update.mock.calls[0]![0];
    expect(call.data.status).toBe("completed");
    expect(call.data.outcome).toBe("home");
    expect(call.data.scoreHome).toBe(1);
    expect(call.data.scoreAway).toBe(0);
    expect(call.data.completedAt).toBeInstanceOf(Date);
  });

  it("away winner : scores 0-1", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "ready",
    });
    mocked.proLeagueMatch.update.mockResolvedValueOnce({});
    await forceForfeit({ matchId: "m1", winnerSide: "away" });
    const call = mocked.proLeagueMatch.update.mock.calls[0]![0];
    expect(call.data.scoreHome).toBe(0);
    expect(call.data.scoreAway).toBe(1);
    expect(call.data.outcome).toBe("away");
  });

  it("refuse si match deja completed", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValueOnce({
      id: "m1",
      status: "completed",
    });
    await expect(
      forceForfeit({ matchId: "m1", winnerSide: "home" }),
    ).rejects.toMatchObject({ code: "MATCH_ALREADY_COMPLETED" });
    expect(mocked.proLeagueMatch.update).not.toHaveBeenCalled();
  });

  it("MATCH_NOT_FOUND si inexistant", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValueOnce(null);
    await expect(
      forceForfeit({ matchId: "ghost", winnerSide: "home" }),
    ).rejects.toMatchObject({ code: "MATCH_NOT_FOUND" });
  });

  it("INVALID_INPUT si winnerSide invalide", async () => {
    await expect(
      forceForfeit({
        matchId: "m1",
        // @ts-expect-error test runtime validation
        winnerSide: "neutral",
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(mocked.proLeagueMatch.findUnique).not.toHaveBeenCalled();
  });
});

describe("cloneSeason", () => {
  it("clone : new season + standings init pour toutes les teams", async () => {
    mocked.proLeagueSeason.findUnique
      .mockResolvedValueOnce({
        id: "s1",
        leagueId: "league-1",
        engineVer: "0.16.0",
        driverKind: "hybrid",
      })
      // duplicate check
      .mockResolvedValueOnce(null);
    mocked.proTeam.findMany.mockResolvedValueOnce([
      { id: "t1" },
      { id: "t2" },
      { id: "t3" },
    ]);
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        proLeagueSeason: {
          create: vi.fn().mockResolvedValueOnce({ id: "new-s" }),
        },
        proLeagueStandings: {
          createMany: vi.fn().mockResolvedValueOnce({ count: 3 }),
        },
      }),
    );

    const result = await cloneSeason({
      fromSeasonId: "s1",
      year: 2027,
    });

    expect(result).toEqual({
      newSeasonId: "new-s",
      fromSeasonId: "s1",
      year: 2027,
    });
  });

  it("DUPLICATE_YEAR si une saison existe deja avec ce year", async () => {
    mocked.proLeagueSeason.findUnique
      .mockResolvedValueOnce({
        id: "s1",
        leagueId: "league-1",
        engineVer: "0.16.0",
        driverKind: "hybrid",
      })
      .mockResolvedValueOnce({ id: "duplicate" });

    await expect(
      cloneSeason({ fromSeasonId: "s1", year: 2026 }),
    ).rejects.toMatchObject({ code: "DUPLICATE_YEAR" });
    expect(mocked.$transaction).not.toHaveBeenCalled();
  });

  it("SEASON_NOT_FOUND si la saison source n'existe pas", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValueOnce(null);

    await expect(
      cloneSeason({ fromSeasonId: "ghost", year: 2027 }),
    ).rejects.toMatchObject({ code: "SEASON_NOT_FOUND" });
  });

  it("override driverKind si fourni", async () => {
    mocked.proLeagueSeason.findUnique
      .mockResolvedValueOnce({
        id: "s1",
        leagueId: "league-1",
        engineVer: "0.16.0",
        driverKind: "hybrid",
      })
      .mockResolvedValueOnce(null);
    mocked.proTeam.findMany.mockResolvedValueOnce([]);
    const seasonCreate = vi.fn().mockResolvedValueOnce({ id: "new-s" });
    mocked.$transaction.mockImplementationOnce(async (fn: any) =>
      fn({
        proLeagueSeason: { create: seasonCreate },
        proLeagueStandings: { createMany: vi.fn() },
      }),
    );

    await cloneSeason({
      fromSeasonId: "s1",
      year: 2027,
      driverKind: "full",
    });

    const call = seasonCreate.mock.calls[0][0];
    expect(call.data.driverKind).toBe("full");
  });

  it("expose SeasonFactoryError class", () => {
    const e = new SeasonFactoryError("INVALID_INPUT", "test");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("INVALID_INPUT");
    expect(e.name).toBe("SeasonFactoryError");
  });
});
