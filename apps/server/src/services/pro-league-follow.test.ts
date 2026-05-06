import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proTeam: { findUnique: vi.fn() },
    proSpectatorFollow: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    proLeagueMatch: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  ProTeamFollowError,
  followProTeam,
  getMyFeed,
  isFollowing,
  listMyFollows,
  unfollowProTeam,
} from "./pro-league-follow";

interface MockedPrisma {
  proTeam: { findUnique: ReturnType<typeof vi.fn> };
  proSpectatorFollow: {
    upsert: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  proLeagueMatch: { findMany: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

const USER = "user_1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("followProTeam — sprint 1.C.4", () => {
  it("404 si la team n'existe pas", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(null);
    await expect(followProTeam(USER, "unknown")).rejects.toThrow(
      ProTeamFollowError,
    );
  });

  it("upsert + renvoie le summary + since ISO", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "team_1",
      slug: "buf-snow-ogres",
      name: "Snow Ogres",
      city: "Buffalo",
      race: "Ogre",
      primaryColor: "#00338D",
      secondaryColor: "#C60C30",
    });
    mocked.proSpectatorFollow.upsert.mockResolvedValue({
      since: new Date("2026-09-01T12:00:00Z"),
    });

    const out = await followProTeam(USER, "buf-snow-ogres");
    expect(out.proTeamId).toBe("team_1");
    expect(out.slug).toBe("buf-snow-ogres");
    expect(out.since).toBe("2026-09-01T12:00:00.000Z");
  });

  it("idempotent : 2 appels successifs upsertent (no-op le 2e)", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({
      id: "team_1",
      slug: "x",
      name: "X",
      city: "X",
      race: "X",
      primaryColor: null,
      secondaryColor: null,
    });
    mocked.proSpectatorFollow.upsert.mockResolvedValue({
      since: new Date(),
    });
    await followProTeam(USER, "x");
    await followProTeam(USER, "x");
    expect(mocked.proSpectatorFollow.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("unfollowProTeam — sprint 1.C.4", () => {
  it("404 si la team n'existe pas", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(null);
    await expect(unfollowProTeam(USER, "x")).rejects.toThrow(
      ProTeamFollowError,
    );
  });

  it("renvoie true si suppression effective", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({ id: "t1" });
    mocked.proSpectatorFollow.deleteMany.mockResolvedValue({ count: 1 });
    expect(await unfollowProTeam(USER, "t1")).toBe(true);
  });

  it("renvoie false si rien à supprimer (idempotent)", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({ id: "t1" });
    mocked.proSpectatorFollow.deleteMany.mockResolvedValue({ count: 0 });
    expect(await unfollowProTeam(USER, "t1")).toBe(false);
  });
});

describe("isFollowing — sprint 1.C.4", () => {
  it("false si team inconnue", async () => {
    mocked.proTeam.findUnique.mockResolvedValue(null);
    expect(await isFollowing(USER, "x")).toBe(false);
  });

  it("true si row existe", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({ id: "t1" });
    mocked.proSpectatorFollow.findUnique.mockResolvedValue({ id: "f1" });
    expect(await isFollowing(USER, "t1")).toBe(true);
  });

  it("false si row absente", async () => {
    mocked.proTeam.findUnique.mockResolvedValue({ id: "t1" });
    mocked.proSpectatorFollow.findUnique.mockResolvedValue(null);
    expect(await isFollowing(USER, "t1")).toBe(false);
  });
});

describe("listMyFollows — sprint 1.C.4", () => {
  it("renvoie [] si aucun follow", async () => {
    mocked.proSpectatorFollow.findMany.mockResolvedValue([]);
    const out = await listMyFollows(USER);
    expect(out).toEqual([]);
  });

  it("formate les rows en summary", async () => {
    mocked.proSpectatorFollow.findMany.mockResolvedValue([
      {
        since: new Date("2026-09-01T00:00:00Z"),
        team: {
          id: "t1",
          slug: "buf-snow-ogres",
          name: "Snow Ogres",
          city: "Buffalo",
          race: "Ogre",
          primaryColor: "#00338D",
          secondaryColor: "#C60C30",
        },
      },
    ]);
    const out = await listMyFollows(USER);
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("buf-snow-ogres");
    expect(out[0].since).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("getMyFeed — sprint 1.C.4", () => {
  it("renvoie [] si aucun follow", async () => {
    mocked.proSpectatorFollow.findMany.mockResolvedValue([]);
    expect(await getMyFeed(USER)).toEqual([]);
  });

  it("agrège upcoming + recent avec catégorie + isHome", async () => {
    mocked.proSpectatorFollow.findMany.mockResolvedValue([
      { proTeamId: "t1" },
    ]);

    const upcomingMatch = {
      id: "m_up",
      status: "scheduled",
      scheduledAt: new Date("2026-09-15T21:00:00Z"),
      scoreHome: null,
      scoreAway: null,
      outcome: null,
      homeTeamId: "t1",
      awayTeamId: "t2",
      round: { roundNumber: 5 },
      season: { year: 2026 },
      homeTeam: {
        slug: "buf-snow-ogres",
        name: "Snow Ogres",
        city: "Buffalo",
        primaryColor: "#00338D",
      },
      awayTeam: {
        slug: "gb-cheese-halflings",
        name: "Cheese Halflings",
        city: "Green Bay",
        primaryColor: "#203731",
      },
    };
    const recentMatch = {
      id: "m_done",
      status: "completed",
      scheduledAt: new Date("2026-09-08T21:00:00Z"),
      scoreHome: 1,
      scoreAway: 3,
      outcome: "away",
      homeTeamId: "t3",
      awayTeamId: "t1",
      round: { roundNumber: 4 },
      season: { year: 2026 },
      homeTeam: {
        slug: "kc-soaring-hawks",
        name: "Soaring Hawks",
        city: "Kansas City",
        primaryColor: "#E31837",
      },
      awayTeam: {
        slug: "buf-snow-ogres",
        name: "Snow Ogres",
        city: "Buffalo",
        primaryColor: "#00338D",
      },
    };
    // 1er appel : upcoming pour t1 → 1 row
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([upcomingMatch]);
    // 2e appel : recent pour t1 → 1 row
    mocked.proLeagueMatch.findMany.mockResolvedValueOnce([recentMatch]);

    const out = await getMyFeed(USER);
    expect(out).toHaveLength(2);
    // recent en premier (catégorie recent en haut), puis upcoming
    expect(out[0].category).toBe("recent");
    expect(out[0].matchId).toBe("m_done");
    expect(out[0].isHome).toBe(false);
    expect(out[0].followedTeam.slug).toBe("buf-snow-ogres");
    expect(out[0].opponent.slug).toBe("kc-soaring-hawks");
    expect(out[1].category).toBe("upcoming");
    expect(out[1].isHome).toBe(true);
  });

  it("limite à 30 entrées max", async () => {
    const teamIds = Array.from({ length: 16 }, (_, i) => ({
      proTeamId: `t${i}`,
    }));
    mocked.proSpectatorFollow.findMany.mockResolvedValue(teamIds);
    // Pour chaque team, on retourne 1 upcoming + 1 recent (32 total)
    mocked.proLeagueMatch.findMany.mockImplementation(
      async ({ where }: { where: { status?: unknown } }) => {
        const isUpcoming =
          typeof where.status === "object" && where.status !== null;
        return [
          {
            id: `m_${Math.random()}`,
            status: isUpcoming ? "scheduled" : "completed",
            scheduledAt: new Date(),
            scoreHome: null,
            scoreAway: null,
            outcome: null,
            homeTeamId: "tX",
            awayTeamId: "tY",
            round: { roundNumber: 1 },
            season: { year: 2026 },
            homeTeam: {
              slug: "x",
              name: "X",
              city: "X",
              primaryColor: null,
            },
            awayTeam: {
              slug: "y",
              name: "Y",
              city: "Y",
              primaryColor: null,
            },
          },
        ];
      },
    );

    const out = await getMyFeed(USER);
    expect(out.length).toBeLessThanOrEqual(30);
  });
});
