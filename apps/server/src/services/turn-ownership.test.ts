import { describe, it, expect, vi } from "vitest";
import { getUserTeamSide } from "./turn-ownership";

function createMockPrisma(selections: Array<{ userId: string }>) {
  return {
    teamSelection: {
      findMany: vi.fn().mockResolvedValue(selections),
    },
  } as any;
}

describe("getUserTeamSide", () => {
  it("returns 'A' for the first player (by createdAt)", async () => {
    const prisma = createMockPrisma([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    const side = await getUserTeamSide(prisma, "match-1", "user-1");
    expect(side).toBe("A");
  });

  it("returns 'B' for the second player (by createdAt)", async () => {
    const prisma = createMockPrisma([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    const side = await getUserTeamSide(prisma, "match-1", "user-2");
    expect(side).toBe("B");
  });

  it("returns null when the user is not a participant", async () => {
    const prisma = createMockPrisma([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    const side = await getUserTeamSide(prisma, "match-1", "user-3");
    expect(side).toBeNull();
  });

  it("returns null when fewer than 2 selections exist", async () => {
    const prisma = createMockPrisma([{ userId: "user-1" }]);
    const side = await getUserTeamSide(prisma, "match-1", "user-1");
    expect(side).toBeNull();
  });

  it("returns null for empty selections", async () => {
    const prisma = createMockPrisma([]);
    const side = await getUserTeamSide(prisma, "match-1", "user-1");
    expect(side).toBeNull();
  });

  it("passes correct query parameters", async () => {
    const prisma = createMockPrisma([
      { userId: "user-1" },
      { userId: "user-2" },
    ]);
    await getUserTeamSide(prisma, "match-xyz", "user-1");
    expect(prisma.teamSelection.findMany).toHaveBeenCalledWith({
      where: { matchId: "match-xyz" },
      orderBy: { createdAt: "asc" },
      select: { userId: true },
    });
  });
});
