/**
 * N.4 — Tests du service de creation de match pratique contre IA.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../utils/roster-helpers", () => ({
  getRosterFromDb: vi.fn(),
}));

import { getRosterFromDb } from "../utils/roster-helpers";
import {
  createPracticeMatch,
  ensureAISystemUser,
  spawnAITeam,
} from "./ai-practice";

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
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teamPlayer: {
      createMany: vi.fn().mockResolvedValue({ count: 11 }),
    },
    localMatch: {
      create: vi.fn(),
    },
  };
}

describe("ensureAISystemUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reuse l'utilisateur IA existant", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({ id: "ai-user-1", email: "ai-opponent@system.bloobowl.local" });
    const result = await ensureAISystemUser(prisma as any);
    expect(result.id).toBe("ai-user-1");
    expect(prisma.user.upsert).not.toHaveBeenCalled();
  });

  it("cree l'utilisateur IA s'il n'existe pas", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: "ai-new", email: "ai-opponent@system.bloobowl.local" });
    const result = await ensureAISystemUser(prisma as any);
    expect(result.id).toBe("ai-new");
    expect(prisma.user.upsert).toHaveBeenCalledOnce();
  });

  it("passe le champ roles sous forme de tableau (String[] Prisma)", async () => {
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

  it("cree une equipe IA avec >=11 joueurs derives du roster", async () => {
    (getRosterFromDb as any).mockResolvedValue(makeRosterFixture());
    const prisma = makePrismaMock();
    prisma.team.create.mockResolvedValue({ id: "team-ai-1", name: "Skavens (IA)" });

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

  it("leve une erreur si le roster n'existe pas en base", async () => {
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

describe("createPracticeMatch", () => {
  beforeEach(() => vi.clearAllMocks());

  it("refuse un roster IA hors whitelist", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "user-team", ownerId: "user-1", roster: "skaven" });
    await expect(
      createPracticeMatch(prisma as any, {
        creatorId: "user-1",
        userTeamId: "user-team",
        difficulty: "medium",
        aiRosterSlug: "orc", // pas dans la whitelist
      }),
    ).rejects.toThrow(/non autorise/i);
  });

  it("refuse si l'utilisateur n'est pas proprietaire de son equipe", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "user-team", ownerId: "someone-else", roster: "skaven" });
    await expect(
      createPracticeMatch(prisma as any, {
        creatorId: "user-1",
        userTeamId: "user-team",
        difficulty: "medium",
      }),
    ).rejects.toThrow(/proprietaire/i);
  });

  it("refuse si l'equipe utilisateur est introuvable", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue(null);
    await expect(
      createPracticeMatch(prisma as any, {
        creatorId: "user-1",
        userTeamId: "missing-team",
        difficulty: "medium",
      }),
    ).rejects.toThrow(/introuvable/i);
  });

  it("cree un LocalMatch avec aiOpponent=true et les bons cotes", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "user-team", ownerId: "user-1", roster: "skaven" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: "ai-system" });
    prisma.team.create.mockResolvedValue({ id: "ai-team-1" });
    (getRosterFromDb as any).mockResolvedValue(makeRosterFixture());
    prisma.localMatch.create.mockImplementation(async ({ data }: any) => ({
      id: "lm-1",
      ...data,
    }));

    const result = await createPracticeMatch(prisma as any, {
      creatorId: "user-1",
      userTeamId: "user-team",
      difficulty: "medium",
      aiRosterSlug: "lizardmen",
      userSide: "A",
    });

    expect(result.localMatchId).toBe("lm-1");
    expect(result.aiRoster).toBe("lizardmen");
    expect(result.aiTeamSide).toBe("B");
    expect(result.aiTeamId).toBe("ai-team-1");

    const localMatchArgs = prisma.localMatch.create.mock.calls[0][0];
    expect(localMatchArgs.data.aiOpponent).toBe(true);
    expect(localMatchArgs.data.aiDifficulty).toBe("medium");
    expect(localMatchArgs.data.aiTeamSide).toBe("B");
    expect(localMatchArgs.data.teamAId).toBe("user-team");
    expect(localMatchArgs.data.teamBId).toBe("ai-team-1");
    expect(localMatchArgs.data.isPublic).toBe(false);
  });

  it("permet userSide='B' et inverse les cotes", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: "user-team", ownerId: "user-1", roster: "skaven" });
    prisma.user.findUnique.mockResolvedValue({ id: "ai-system" });
    prisma.team.create.mockResolvedValue({ id: "ai-team-1" });
    (getRosterFromDb as any).mockResolvedValue(makeRosterFixture());
    prisma.localMatch.create.mockImplementation(async ({ data }: any) => ({
      id: "lm-2",
      ...data,
    }));

    const result = await createPracticeMatch(prisma as any, {
      creatorId: "user-1",
      userTeamId: "user-team",
      difficulty: "hard",
      aiRosterSlug: "dwarf",
      userSide: "B",
    });

    expect(result.aiTeamSide).toBe("A");
    const localMatchArgs = prisma.localMatch.create.mock.calls[0][0];
    expect(localMatchArgs.data.teamAId).toBe("ai-team-1");
    expect(localMatchArgs.data.teamBId).toBe("user-team");
  });
});
