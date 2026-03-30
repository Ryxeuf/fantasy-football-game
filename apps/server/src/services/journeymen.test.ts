import { describe, it, expect, vi } from "vitest";
import { getLinemanStats } from "./journeymen";

describe("getLinemanStats", () => {
  function createMockPrisma(rosterResult: any) {
    return {
      roster: {
        findFirst: vi.fn().mockResolvedValue(rosterResult),
      },
    } as any;
  }

  it("returns lineman stats from roster (highest max position)", async () => {
    const prisma = createMockPrisma({
      slug: "skaven",
      positions: [
        {
          displayName: "Clanrat",
          ma: 7,
          st: 3,
          ag: 3,
          pa: 4,
          av: 8,
          max: 12,
        },
      ],
    });

    const result = await getLinemanStats(prisma, "skaven");

    expect(result).toEqual({
      position: "Clanrat",
      ma: 7,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
    });
    expect(prisma.roster.findFirst).toHaveBeenCalledWith({
      where: { slug: "skaven" },
      include: {
        positions: {
          orderBy: { max: "desc" },
          take: 1,
        },
      },
    });
  });

  it("returns undefined when roster not found", async () => {
    const prisma = createMockPrisma(null);

    const result = await getLinemanStats(prisma, "unknown_roster");

    expect(result).toBeUndefined();
  });

  it("returns undefined when roster has no positions", async () => {
    const prisma = createMockPrisma({
      slug: "empty",
      positions: [],
    });

    const result = await getLinemanStats(prisma, "empty");

    expect(result).toBeUndefined();
  });
});
