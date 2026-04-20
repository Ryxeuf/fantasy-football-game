/**
 * Tests for the online practice vs AI match creation service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(),
}));

import { getRosterFromDb } from "../utils/roster-helpers";
import { createOnlinePracticeMatch } from "./practice-match";

function makeRosterFixture() {
  return {
    name: "Skavens",
    budget: 1_000_000,
    tier: 1,
    naf: "skaven",
    positions: [
      {
        slug: "skaven_lineman",
        displayName: "Skaven Lineman",
        cost: 50_000,
        min: 11,
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
  const created = {
    match: null as any,
    teamSelections: null as any,
    turns: [] as any[],
    aiTeam: null as any,
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: "ai-user", email: "ai@x" }),
    },
    team: {
      findUnique: vi.fn(),
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        created.aiTeam = { id: "ai-team-1", ...data };
        return created.aiTeam;
      }),
    },
    teamPlayer: {
      createMany: vi.fn().mockResolvedValue({ count: 11 }),
    },
    match: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        created.match = { id: "match-1", ...data };
        return created.match;
      }),
      update: vi.fn(),
    },
    teamSelection: {
      createMany: vi.fn().mockImplementation(async ({ data }: any) => {
        created.teamSelections = data;
        return { count: data.length };
      }),
    },
    turn: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        created.turns.push(data);
        return data;
      }),
      count: vi.fn().mockResolvedValue(0),
    },
  };
  return { prisma, created };
}

describe("createOnlinePracticeMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getRosterFromDb as any).mockResolvedValue(makeRosterFixture());
  });

  it("rejects an unknown user team", async () => {
    const { prisma } = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue(null);
    await expect(
      createOnlinePracticeMatch(prisma as any, {
        creatorId: "user-1",
        userTeamId: "missing",
        difficulty: "medium",
      }),
    ).rejects.toThrow(/introuvable/i);
  });

  it("rejects a team owned by someone else", async () => {
    const { prisma } = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({
      id: "t1",
      ownerId: "other",
      roster: "skaven",
    });
    await expect(
      createOnlinePracticeMatch(prisma as any, {
        creatorId: "user-1",
        userTeamId: "t1",
        difficulty: "medium",
      }),
    ).rejects.toThrow(/proprietaire/i);
  });

  it("rejects an AI roster outside the whitelist", async () => {
    const { prisma } = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({
      id: "t1",
      ownerId: "user-1",
      roster: "skaven",
    });
    await expect(
      createOnlinePracticeMatch(prisma as any, {
        creatorId: "user-1",
        userTeamId: "t1",
        difficulty: "medium",
        aiRosterSlug: "orc",
      }),
    ).rejects.toThrow(/non autorise/i);
  });

  it("creates a Match with aiOpponent=true and both team selections", async () => {
    const { prisma, created } = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({
      id: "user-team",
      ownerId: "user-1",
      roster: "skaven",
    });

    const result = await createOnlinePracticeMatch(prisma as any, {
      creatorId: "user-1",
      userTeamId: "user-team",
      difficulty: "medium",
      aiRosterSlug: "lizardmen",
      userSide: "A",
      seed: "deterministic",
    });

    expect(result.matchId).toBe("match-1");
    expect(result.aiRoster).toBe("lizardmen");
    expect(result.aiTeamSide).toBe("B");
    expect(result.aiTeamId).toBe("ai-team-1");

    expect(created.match.aiOpponent).toBe(true);
    expect(created.match.aiDifficulty).toBe("medium");
    expect(created.match.aiTeamSide).toBe("B");
    expect(created.match.aiUserId).toBe("ai-user");
    expect(created.teamSelections).toHaveLength(2);
    expect(created.teamSelections[0].userId).toBe("user-1");
    expect(created.teamSelections[1].userId).toBe("ai-user");
  });

  it("inverts sides when userSide='B'", async () => {
    const { prisma, created } = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({
      id: "user-team",
      ownerId: "user-1",
      roster: "skaven",
    });

    const result = await createOnlinePracticeMatch(prisma as any, {
      creatorId: "user-1",
      userTeamId: "user-team",
      difficulty: "hard",
      aiRosterSlug: "dwarf",
      userSide: "B",
    });

    expect(result.aiTeamSide).toBe("A");
    expect(created.teamSelections[0].userId).toBe("ai-user");
    expect(created.teamSelections[1].userId).toBe("user-1");
  });

  it("auto-accepts the AI side via an `accept` turn", async () => {
    const { prisma, created } = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({
      id: "user-team",
      ownerId: "user-1",
      roster: "skaven",
    });

    await createOnlinePracticeMatch(prisma as any, {
      creatorId: "user-1",
      userTeamId: "user-team",
      difficulty: "easy",
      aiRosterSlug: "gnome",
    });

    const acceptTurns = created.turns.filter(
      (t) => t.payload?.type === "accept",
    );
    expect(acceptTurns).toHaveLength(1);
    expect(acceptTurns[0].payload.userId).toBe("ai-user");
  });
});
