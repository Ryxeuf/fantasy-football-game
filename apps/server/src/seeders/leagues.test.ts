/**
 * L.2 — Tests du seeder de ligues par defaut.
 *
 * Sprint 17 : apres la migration Prisma des modeles League/LeagueSeason/
 * LeagueParticipant/LeagueRound, on amorce la base avec :
 *   - La ligue "Open 5 Teams" (L.9) restreinte aux 5 rosters prioritaires.
 *   - Une saison 1 en status "draft".
 *   - Des journees (rounds) vides pour amorcer le calendrier.
 *
 * Le seeder doit etre idempotent : relancer `pnpm db:seed` ne doit pas
 * creer de doublons.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    league: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    leagueSeason: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    leagueRound: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    leagueParticipant: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    team: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  DEFAULT_LEAGUE_NAME,
  PRIORITY_ROSTERS,
  seedDefaultLeagues,
} from "./leagues";

const mockPrisma = prisma as unknown as {
  league: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  leagueSeason: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  leagueRound: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  leagueParticipant: {
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  team: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const CREATOR_ID = "admin-user-id";

describe("Rule: Default league seeder (L.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.leagueRound.findMany.mockResolvedValue([]);
    mockPrisma.leagueParticipant.findUnique.mockResolvedValue(null);
    mockPrisma.leagueParticipant.count.mockResolvedValue(0);
    mockPrisma.team.findFirst.mockResolvedValue(null);
  });

  it("exposes the 5 priority rosters in a stable order", () => {
    expect(PRIORITY_ROSTERS).toEqual([
      "skaven",
      "gnome",
      "lizardmen",
      "dwarf",
      "imperial_nobility",
    ]);
  });

  it("creates the 'Open 5 Teams' league when none exists", async () => {
    mockPrisma.league.findFirst.mockResolvedValue(null);
    mockPrisma.league.create.mockResolvedValue({
      id: "league-1",
      name: DEFAULT_LEAGUE_NAME,
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);
    mockPrisma.leagueSeason.create.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      status: "draft",
    });

    await seedDefaultLeagues({ creatorId: CREATOR_ID });

    expect(mockPrisma.league.create).toHaveBeenCalledTimes(1);
    const data = mockPrisma.league.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: DEFAULT_LEAGUE_NAME,
      creatorId: CREATOR_ID,
      isPublic: true,
      ruleset: "season_3",
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    expect(data.maxParticipants).toBeGreaterThanOrEqual(PRIORITY_ROSTERS.length);
  });

  it("is idempotent: does not recreate the league when it already exists", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-existing",
      name: DEFAULT_LEAGUE_NAME,
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue({
      id: "season-existing",
      leagueId: "league-existing",
      seasonNumber: 1,
      status: "draft",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue([
      { seasonId: "season-existing", roundNumber: 1 },
      { seasonId: "season-existing", roundNumber: 2 },
      { seasonId: "season-existing", roundNumber: 3 },
      { seasonId: "season-existing", roundNumber: 4 },
      { seasonId: "season-existing", roundNumber: 5 },
    ]);

    await seedDefaultLeagues({ creatorId: CREATOR_ID });

    expect(mockPrisma.league.create).not.toHaveBeenCalled();
    expect(mockPrisma.leagueSeason.create).not.toHaveBeenCalled();
    expect(mockPrisma.leagueRound.createMany).not.toHaveBeenCalled();
  });

  it("creates an initial season 1 in draft status when absent", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-1",
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue(null);
    mockPrisma.leagueSeason.create.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      status: "draft",
    });

    await seedDefaultLeagues({ creatorId: CREATOR_ID });

    expect(mockPrisma.leagueSeason.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leagueId: "league-1",
        seasonNumber: 1,
        status: "draft",
      }),
    });
  });

  it("creates exactly (N-1) rounds for a round-robin with N priority teams", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-1",
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      status: "draft",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue([]);
    mockPrisma.leagueRound.createMany.mockResolvedValue({ count: 5 });

    await seedDefaultLeagues({ creatorId: CREATOR_ID });

    const expectedRoundCount = PRIORITY_ROSTERS.length;
    expect(mockPrisma.leagueRound.createMany).toHaveBeenCalledTimes(1);
    const payload = mockPrisma.leagueRound.createMany.mock.calls[0][0].data;
    expect(payload).toHaveLength(expectedRoundCount);
    const numbers = payload.map((r: { roundNumber: number }) => r.roundNumber);
    expect(numbers).toEqual([1, 2, 3, 4, 5]);
    expect(
      payload.every((r: { status: string }) => r.status === "pending"),
    ).toBe(true);
  });

  it("subscribes the priority team of each roster when available", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-1",
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      status: "draft",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue(
      Array.from({ length: PRIORITY_ROSTERS.length }, (_, i) => ({
        seasonId: "season-1",
        roundNumber: i + 1,
      })),
    );
    mockPrisma.team.findFirst.mockImplementation(
      async ({ where }: { where: { roster: string } }) => ({
        id: `team-${where.roster}`,
        roster: where.roster,
      }),
    );

    await seedDefaultLeagues({ creatorId: CREATOR_ID });

    expect(mockPrisma.leagueParticipant.create).toHaveBeenCalledTimes(
      PRIORITY_ROSTERS.length,
    );
    const teamIds = mockPrisma.leagueParticipant.create.mock.calls.map(
      (c: [{ data: { teamId: string } }]) => c[0].data.teamId,
    );
    expect(teamIds).toEqual(
      PRIORITY_ROSTERS.map((slug) => `team-${slug}`),
    );
  });

  it("skips roster enrollment when no team exists for it", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-1",
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      status: "draft",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue([
      { seasonId: "season-1", roundNumber: 1 },
    ]);
    mockPrisma.team.findFirst.mockResolvedValue(null);

    await seedDefaultLeagues({ creatorId: CREATOR_ID });

    expect(mockPrisma.leagueParticipant.create).not.toHaveBeenCalled();
  });

  it("does not re-enroll a team that is already a participant", async () => {
    mockPrisma.league.findFirst.mockResolvedValue({
      id: "league-1",
      allowedRosters: JSON.stringify(PRIORITY_ROSTERS),
    });
    mockPrisma.leagueSeason.findFirst.mockResolvedValue({
      id: "season-1",
      leagueId: "league-1",
      seasonNumber: 1,
      status: "draft",
    });
    mockPrisma.leagueRound.findMany.mockResolvedValue(
      Array.from({ length: PRIORITY_ROSTERS.length }, (_, i) => ({
        seasonId: "season-1",
        roundNumber: i + 1,
      })),
    );
    mockPrisma.team.findFirst.mockImplementation(
      async ({ where }: { where: { roster: string } }) => ({
        id: `team-${where.roster}`,
        roster: where.roster,
      }),
    );
    mockPrisma.leagueParticipant.findUnique.mockResolvedValue({
      id: "existing-participant",
    });

    await seedDefaultLeagues({ creatorId: CREATOR_ID });

    expect(mockPrisma.leagueParticipant.create).not.toHaveBeenCalled();
  });
});
