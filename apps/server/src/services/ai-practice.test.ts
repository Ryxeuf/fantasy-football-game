/**
 * Tests for the AI practice helpers (ensureAISystemUser, spawnAITeam).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(),
}));

import { getRosterFromDb } from "../utils/roster-helpers";
import { ensureAISystemUser, spawnAITeam } from "./ai-practice";

function makeRosterFixture() {
  return {
    name: "Skavens",
    budget: 1_000_000,
    tier: 1,
    naf: "skaven",
    positions: [
      {
        slug: "skaven_blitzer",
        displayName: "Skaven Blitzer",
        cost: 90000,
        min: 0,
        max: 4,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      {
        slug: "skaven_lineman",
        displayName: "Skaven Lineman",
        cost: 50000,
        min: 0,
        max: 16,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
      },
    ],
  };
}

function makePrismaMock() {
  return {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    team: {
      create: vi.fn(),
    },
    teamPlayer: {
      createMany: vi.fn().mockResolvedValue({ count: 11 }),
    },
  };
}

describe("ensureAISystemUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reuses the existing AI system user", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: "ai-user-1",
      email: "ai-opponent@system.bloobowl.local",
    });
    const result = await ensureAISystemUser(prisma as any);
    expect(result.id).toBe("ai-user-1");
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("creates the AI system user if it does not exist", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({
      id: "ai-new",
      email: "ai-opponent@system.bloobowl.local",
    });
    const result = await ensureAISystemUser(prisma as any);
    expect(result.id).toBe("ai-new");
    expect(prisma.user.upsert).toHaveBeenCalledOnce();
  });

  it("passes roles as a String[] array for Prisma", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: "ai-new" });
    await ensureAISystemUser(prisma as any);
    const upsertArgs = prisma.user.upsert.mock.calls[0][0];
    expect(Array.isArray(upsertArgs.create.roles)).toBe(true);
    expect(upsertArgs.create.roles).toEqual(["ai"]);
  });
});

describe("spawnAITeam", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates an AI team with >= 11 players derived from the roster", async () => {
    (getRosterFromDb as any).mockResolvedValue(makeRosterFixture());
    const prisma = makePrismaMock();
    prisma.team.create.mockResolvedValue({
      id: "team-ai-1",
      name: "Skavens (IA)",
    });

    const result = await spawnAITeam({
      prisma: prisma as any,
      ownerId: "ai-user",
      rosterSlug: "skaven",
    });

    expect(result.id).toBe("team-ai-1");
    expect(prisma.team.create).toHaveBeenCalledOnce();
    const createManyArgs = prisma.teamPlayer.createMany.mock.calls[0][0];
    expect(createManyArgs.data.length).toBeGreaterThanOrEqual(11);
    for (const p of createManyArgs.data) {
      expect(p.teamId).toBe("team-ai-1");
      expect(p.number).toBeGreaterThan(0);
    }
  });

  it("throws if the roster is not found in DB", async () => {
    (getRosterFromDb as any).mockResolvedValue(null);
    const prisma = makePrismaMock();
    await expect(
      spawnAITeam({
        prisma: prisma as any,
        ownerId: "ai-user",
        rosterSlug: "skaven",
      }),
    ).rejects.toThrow(/introuvable/i);
  });
});
