/**
 * Sprint Pro League lot 1.A.3 — Tests du Pro League scheduler.
 *
 * Couvre :
 *  - buildProLeagueSchedule : status invalides, < 2 équipes,
 *    persistance rounds + matchs, basculement `in_progress`,
 *    idempotence (no-op si déjà créé), respect de la cadence.
 *  - regenerateProLeagueSchedule : refus si match déjà simulé,
 *    suppression + reconstruction sinon.
 *  - nextTuesdayKickoff : prochain mardi 21h00 UTC.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueSeason: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    proLeagueRound: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    proLeagueMatch: {
      count: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    proTeam: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  buildProLeagueSchedule,
  nextTuesdayKickoff,
  regenerateProLeagueSchedule,
} from "./pro-league-scheduler";

interface MockedPrisma {
  proLeagueSeason: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  proLeagueRound: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: {
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  proTeam: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
}

const mocked = prisma as unknown as MockedPrisma;

const SEASON_ID = "season_1";
const LEAGUE_ID = "league_1";

function makeTeams(count: number): Array<{ id: string; slug: string }> {
  return Array.from({ length: count }, (_, i) => ({
    id: `team_${i + 1}`,
    slug: `team-${i + 1}`,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default : transaction passes the same mocked tx (= prisma).
  mocked.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    return fn(prisma);
  });
});

describe("buildProLeagueSchedule — sprint 1.A.3", () => {
  it("erreur si la saison n'existe pas", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValue(null);
    await expect(buildProLeagueSchedule({ seasonId: SEASON_ID })).rejects.toThrow(
      /introuvable/,
    );
  });

  it("idempotent : ne touche à rien si rounds déjà créés", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValue({
      id: SEASON_ID,
      leagueId: LEAGUE_ID,
      status: "in_progress",
    });
    mocked.proLeagueRound.count.mockResolvedValue(15);
    mocked.proLeagueMatch.count.mockResolvedValue(120);

    const out = await buildProLeagueSchedule({ seasonId: SEASON_ID });
    expect(out).toEqual({
      seasonId: SEASON_ID,
      roundsCreated: 15,
      matchesCreated: 120,
      idempotentSkip: true,
    });
    expect(mocked.proLeagueRound.create).not.toHaveBeenCalled();
    expect(mocked.proLeagueMatch.create).not.toHaveBeenCalled();
  });

  it("erreur si status saison != 'scheduled' et aucun round existant", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValue({
      id: SEASON_ID,
      leagueId: LEAGUE_ID,
      status: "completed",
    });
    mocked.proLeagueRound.count.mockResolvedValue(0);

    await expect(buildProLeagueSchedule({ seasonId: SEASON_ID })).rejects.toThrow(
      /scheduled/,
    );
  });

  it("erreur si moins de 2 équipes", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValue({
      id: SEASON_ID,
      leagueId: LEAGUE_ID,
      status: "scheduled",
    });
    mocked.proLeagueRound.count.mockResolvedValue(0);
    mocked.proTeam.findMany.mockResolvedValue(makeTeams(1));

    await expect(buildProLeagueSchedule({ seasonId: SEASON_ID })).rejects.toThrow(
      /Au moins 2/,
    );
  });

  it("crée 15 rounds + 120 matchs pour 16 équipes (round-robin classique)", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValue({
      id: SEASON_ID,
      leagueId: LEAGUE_ID,
      status: "scheduled",
    });
    mocked.proLeagueRound.count.mockResolvedValue(0);
    mocked.proTeam.findMany.mockResolvedValue(makeTeams(16));
    mocked.proLeagueRound.create.mockImplementation(async ({ data }) => ({
      id: `round_${data.roundNumber}`,
    }));
    mocked.proLeagueMatch.create.mockResolvedValue({});
    mocked.proLeagueSeason.update.mockResolvedValue({});

    const out = await buildProLeagueSchedule({
      seasonId: SEASON_ID,
      firstRoundAt: new Date("2026-09-01T21:00:00Z"),
    });

    expect(out).toEqual({
      seasonId: SEASON_ID,
      roundsCreated: 15,
      matchesCreated: 120,
      idempotentSkip: false,
    });
    expect(mocked.proLeagueRound.create).toHaveBeenCalledTimes(15);
    expect(mocked.proLeagueMatch.create).toHaveBeenCalledTimes(120);
    // Saison passe à 'in_progress'.
    expect(mocked.proLeagueSeason.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SEASON_ID },
        data: expect.objectContaining({ status: "in_progress" }),
      }),
    );
  });

  it("respecte la cadence : round N à firstRoundAt + (N-1)*cadence jours", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValue({
      id: SEASON_ID,
      leagueId: LEAGUE_ID,
      status: "scheduled",
    });
    mocked.proLeagueRound.count.mockResolvedValue(0);
    mocked.proTeam.findMany.mockResolvedValue(makeTeams(4));
    mocked.proLeagueRound.create.mockImplementation(async ({ data }) => ({
      id: `round_${data.roundNumber}`,
    }));
    mocked.proLeagueMatch.create.mockResolvedValue({});
    mocked.proLeagueSeason.update.mockResolvedValue({});

    const baseDate = new Date("2026-09-01T21:00:00Z");
    await buildProLeagueSchedule({
      seasonId: SEASON_ID,
      firstRoundAt: baseDate,
      roundCadenceDays: 3,
    });

    const calls = mocked.proLeagueRound.create.mock.calls;
    expect(calls).toHaveLength(3); // 4 équipes → 3 rounds
    const round1Date = calls[0][0].data.scheduledAt as Date;
    const round2Date = calls[1][0].data.scheduledAt as Date;
    const round3Date = calls[2][0].data.scheduledAt as Date;
    expect(round1Date.toISOString()).toBe("2026-09-01T21:00:00.000Z");
    expect(round2Date.toISOString()).toBe("2026-09-04T21:00:00.000Z");
    expect(round3Date.toISOString()).toBe("2026-09-07T21:00:00.000Z");
  });

  it("rejette une cadence négative ou nulle", async () => {
    mocked.proLeagueSeason.findUnique.mockResolvedValue({
      id: SEASON_ID,
      leagueId: LEAGUE_ID,
      status: "scheduled",
    });
    mocked.proLeagueRound.count.mockResolvedValue(0);
    mocked.proTeam.findMany.mockResolvedValue(makeTeams(4));

    await expect(
      buildProLeagueSchedule({ seasonId: SEASON_ID, roundCadenceDays: 0 }),
    ).rejects.toThrow(/roundCadenceDays/);
  });
});

describe("regenerateProLeagueSchedule — sprint 1.A.3", () => {
  it("refuse si un match a déjà été simulé", async () => {
    mocked.proLeagueMatch.count.mockResolvedValue(3);

    await expect(
      regenerateProLeagueSchedule({ seasonId: SEASON_ID }),
    ).rejects.toThrow(/déjà simulé/);
  });

  it("supprime + reconstruit si aucun match joué", async () => {
    mocked.proLeagueMatch.count
      .mockResolvedValueOnce(0) // gating regen
      .mockResolvedValue(0); // post-build idempotency check (avant rebuild)
    mocked.proLeagueMatch.deleteMany.mockResolvedValue({ count: 0 });
    mocked.proLeagueRound.deleteMany.mockResolvedValue({ count: 0 });
    mocked.proLeagueSeason.update.mockResolvedValue({});
    // Stub buildProLeagueSchedule path
    mocked.proLeagueSeason.findUnique.mockResolvedValue({
      id: SEASON_ID,
      leagueId: LEAGUE_ID,
      status: "scheduled",
    });
    mocked.proLeagueRound.count.mockResolvedValue(0);
    mocked.proTeam.findMany.mockResolvedValue(makeTeams(4));
    mocked.proLeagueRound.create.mockImplementation(async ({ data }) => ({
      id: `round_${data.roundNumber}`,
    }));
    mocked.proLeagueMatch.create.mockResolvedValue({});

    const out = await regenerateProLeagueSchedule({
      seasonId: SEASON_ID,
      firstRoundAt: new Date("2026-09-01T21:00:00Z"),
    });

    expect(out.idempotentSkip).toBe(false);
    expect(mocked.proLeagueMatch.deleteMany).toHaveBeenCalled();
    expect(mocked.proLeagueRound.deleteMany).toHaveBeenCalled();
    // 4 équipes → 3 rounds, 6 matchs.
    expect(out.roundsCreated).toBe(3);
    expect(out.matchesCreated).toBe(6);
  });
});

describe("nextTuesdayKickoff — sprint 1.A.3", () => {
  it("renvoie le mardi 21h UTC strictement après une date donnée", () => {
    // Lundi 2026-05-04 12:00:00 UTC → mardi 2026-05-05 21:00:00 UTC
    const out = nextTuesdayKickoff(new Date("2026-05-04T12:00:00Z"));
    expect(out.toISOString()).toBe("2026-05-05T21:00:00.000Z");
  });

  it("si on est mardi 21h pile, renvoie le mardi suivant", () => {
    const out = nextTuesdayKickoff(new Date("2026-05-05T21:00:00Z"));
    expect(out.toISOString()).toBe("2026-05-12T21:00:00.000Z");
  });

  it("si on est mardi mais avant 21h, renvoie le même mardi 21h", () => {
    const out = nextTuesdayKickoff(new Date("2026-05-05T08:00:00Z"));
    expect(out.toISOString()).toBe("2026-05-05T21:00:00.000Z");
  });
});
