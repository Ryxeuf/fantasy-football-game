/**
 * Tests pour `findUserByCoachName` (S26.4a).
 *
 * Verifie le resolveur `@username -> userId` utilise par
 * `sendFriendRequest` pour accepter un nom de coach a la place d'un
 * userId interne (S26.4 — invitation amis par @username).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import { findUserByCoachName, searchUsersByCoachName } from "./user-lookup";

const mockPrisma = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe("findUserByCoachName (S26.4a)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null (no DB call) for empty / whitespace input", async () => {
    expect(await findUserByCoachName("")).toBeNull();
    expect(await findUserByCoachName("   ")).toBeNull();
    expect(await findUserByCoachName("@")).toBeNull();
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });

  it("strips a leading @ before querying", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u-1",
      coachName: "Alice",
    });
    await findUserByCoachName("@Alice");
    const arg = mockPrisma.user.findFirst.mock.calls[0][0] as {
      where: { coachName: { equals: string; mode?: string } };
    };
    expect(arg.where.coachName.equals).toBe("Alice");
  });

  it("trims surrounding whitespace before querying", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u-1",
      coachName: "Alice",
    });
    await findUserByCoachName("   Alice  ");
    const arg = mockPrisma.user.findFirst.mock.calls[0][0] as {
      where: { coachName: { equals: string } };
    };
    expect(arg.where.coachName.equals).toBe("Alice");
  });

  it("queries case-insensitively (mode: insensitive)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await findUserByCoachName("alice");
    const arg = mockPrisma.user.findFirst.mock.calls[0][0] as {
      where: { coachName: { mode: string } };
    };
    expect(arg.where.coachName.mode).toBe("insensitive");
  });

  it("only matches valid + non-private users", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await findUserByCoachName("alice");
    const arg = mockPrisma.user.findFirst.mock.calls[0][0] as {
      where: { valid: boolean; privateProfile: boolean };
    };
    expect(arg.where.valid).toBe(true);
    expect(arg.where.privateProfile).toBe(false);
  });

  it("returns the user id when found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      id: "u-42",
      coachName: "Alice",
    });
    expect(await findUserByCoachName("Alice")).toEqual({
      id: "u-42",
      coachName: "Alice",
    });
  });

  it("returns null when no match", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    expect(await findUserByCoachName("Ghost")).toBeNull();
  });
});

describe("searchUsersByCoachName (S26.4c)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty array (no DB call) for empty / whitespace queries", async () => {
    expect(await searchUsersByCoachName("")).toEqual([]);
    expect(await searchUsersByCoachName("  ")).toEqual([]);
    expect(await searchUsersByCoachName("@")).toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("strips a leading @ and trims whitespace before querying", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await searchUsersByCoachName("  @ali  ");
    const arg = mockPrisma.user.findMany.mock.calls[0][0] as {
      where: {
        coachName: { contains: string; mode?: string };
      };
    };
    expect(arg.where.coachName.contains).toBe("ali");
  });

  it("queries with `contains` + `mode: insensitive` and filters valid + non-private", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await searchUsersByCoachName("ali");
    const arg = mockPrisma.user.findMany.mock.calls[0][0] as {
      where: {
        valid: boolean;
        privateProfile: boolean;
        coachName: { contains: string; mode: string };
      };
      take: number;
    };
    expect(arg.where.valid).toBe(true);
    expect(arg.where.privateProfile).toBe(false);
    expect(arg.where.coachName.contains).toBe("ali");
    expect(arg.where.coachName.mode).toBe("insensitive");
    expect(arg.take).toBe(10);
  });

  it("respects a custom limit (capped at 50)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    await searchUsersByCoachName("ali", 25);
    const arg = mockPrisma.user.findMany.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(25);
    await searchUsersByCoachName("ali", 999);
    const arg2 = mockPrisma.user.findMany.mock.calls[1][0] as { take: number };
    expect(arg2.take).toBe(50);
  });

  it("returns an array of compact user DTOs", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "u-1", coachName: "Alice" },
      { id: "u-2", coachName: "Aline" },
    ]);
    expect(await searchUsersByCoachName("ali")).toEqual([
      { id: "u-1", coachName: "Alice" },
      { id: "u-2", coachName: "Aline" },
    ]);
  });
});
