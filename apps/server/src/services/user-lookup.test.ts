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
    },
  },
}));

import { prisma } from "../prisma";
import { findUserByCoachName } from "./user-lookup";

const mockPrisma = prisma as unknown as {
  user: {
    findFirst: ReturnType<typeof vi.fn>;
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
