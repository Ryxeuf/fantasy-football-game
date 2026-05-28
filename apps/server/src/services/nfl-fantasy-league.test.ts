/**
 * Tests unitaires de nfl-fantasy-league (Phase 2.C).
 *
 * Couvre :
 *   - Validation (name, teamName, size, season)
 *   - createLeague (defaults + invite code)
 *   - getLeague / listLeaguesForUser
 *   - joinLeague (par id / par invite / full / already / status)
 *   - leaveLeague (owner / not-member / status)
 *   - updateLeague (name / size / type pivot)
 *   - deleteLeague
 *   - NflFantasyLeagueError + codes
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflSeason: { findUnique: vi.fn() },
    nflFantasyLeague: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    nflFantasyEntry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
    // Cycles (V3) : createLeague delegate au service cycle qui
    // utilise findMany sur la table + nflWeek pour determiner le
    // cycle joignable. On les mock vides => snap-to-next throw
    // NO_JOINABLE_CYCLE. Les tests qui exercent createLeague avec
    // un cycle reel doivent re-mock ces appels.
    nflFantasySeasonCycle: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    nflWeek: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { prisma } from "../prisma";
import {
  createLeague,
  deleteLeague,
  generateInviteCode,
  getLeague,
  joinLeague,
  leaveLeague,
  listLeaguesForUser,
  NflFantasyLeagueError,
  populateLeagueWithTestCoaches,
  updateLeague,
  DEFAULT_LEAGUE_SIZE,
  LEAGUE_SIZE_MAX,
  LEAGUE_SIZE_MIN,
} from "./nfl-fantasy-league";

beforeEach(() => {
  vi.resetAllMocks();
  // Defaults pour le service cycle : un cycle joignable W1-W6 sur la
  // saison "2025" + 22 semaines spreaded. Les tests createLeague qui
  // ne touchent pas explicitement aux cycles peuvent reuser ce defaut.
  vi.mocked(prisma.nflFantasySeasonCycle.findMany).mockResolvedValue([
    {
      id: "cycle-1",
      seasonId: "2025",
      cycleNumber: 1,
      cycleType: "regular",
      label: "Conférence 1",
      startWeek: 1,
      endWeek: 6,
    },
    {
      id: "cycle-2",
      seasonId: "2025",
      cycleNumber: 2,
      cycleType: "regular",
      label: "Conférence 2",
      startWeek: 7,
      endWeek: 12,
    },
  ] as never);
  vi.mocked(prisma.nflWeek.findMany).mockResolvedValue([] as never);
});

// ────────────────────────────────────────────────────────────────────
// generateInviteCode
// ────────────────────────────────────────────────────────────────────

describe("generateInviteCode", () => {
  it("emet 8 caracteres en alphabet non-ambigu", () => {
    const code = generateInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("produit des codes differents (entropie ~5e11)", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) codes.add(generateInviteCode());
    expect(codes.size).toBeGreaterThan(95);
  });
});

// ────────────────────────────────────────────────────────────────────
// createLeague
// ────────────────────────────────────────────────────────────────────

describe("createLeague", () => {
  it("cree une league private avec inviteCode + entry owner", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({ id: "2025" } as never);
    vi.mocked(prisma.nflFantasyLeague.create).mockResolvedValue({
      id: "lg1",
      name: "Test League",
      ownerId: "u1",
      size: 10,
      type: "private",
      draftMode: "snake",
      status: "draft",
      seasonId: "2025",
      inviteCode: "ABC12XYZ",
      entries: [{ id: "e1", userId: "u1", teamName: "Krak Stompers" }],
    } as never);

    const league = await createLeague({
      ownerId: "u1",
      name: "Test League",
      teamName: "Krak Stompers",
      seasonId: "2025",
    });

    expect(league.id).toBe("lg1");
    expect(league.entries).toHaveLength(1);
    const createArg = vi.mocked(prisma.nflFantasyLeague.create).mock.calls[0]?.[0];
    expect(createArg?.data).toMatchObject({
      name: "Test League",
      ownerId: "u1",
      size: 10,
      type: "private",
      draftMode: "auction",
      seasonId: "2025",
    });
    expect(createArg?.data.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("public league : inviteCode null", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({ id: "2025" } as never);
    vi.mocked(prisma.nflFantasyLeague.create).mockResolvedValue({} as never);

    await createLeague({
      ownerId: "u1",
      name: "Open",
      teamName: "Team",
      seasonId: "2025",
      type: "public",
    });

    const createArg = vi.mocked(prisma.nflFantasyLeague.create).mock.calls[0]?.[0];
    expect(createArg?.data.inviteCode).toBeNull();
    expect(createArg?.data.type).toBe("public");
  });

  it("defaults aux valeurs V2 (size=10, auction, private, budget=5000)", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue({ id: "2025" } as never);
    vi.mocked(prisma.nflFantasyLeague.create).mockResolvedValue({} as never);

    await createLeague({
      ownerId: "u1",
      name: "League",
      teamName: "Team",
      seasonId: "2025",
    });

    const createArg = vi.mocked(prisma.nflFantasyLeague.create).mock.calls[0]?.[0];
    expect(createArg?.data.size).toBe(DEFAULT_LEAGUE_SIZE);
    expect(createArg?.data.type).toBe("private");
    expect(createArg?.data.draftMode).toBe("auction");
    expect(createArg?.data.draftBudget).toBe(5000);
  });

  it("throw SEASON_NOT_FOUND si saison absente", async () => {
    vi.mocked(prisma.nflSeason.findUnique).mockResolvedValue(null);

    await expect(
      createLeague({
        ownerId: "u1",
        name: "Real Name",
        teamName: "Real Team",
        seasonId: "2099",
      }),
    ).rejects.toThrow(/NflSeason 2099 introuvable/);
  });

  it("throw INVALID_NAME si nom trop court / trop long", async () => {
    await expect(
      createLeague({ ownerId: "u1", name: "ab", teamName: "T", seasonId: "2025" }),
    ).rejects.toThrow(/Nom de league/);
    await expect(
      createLeague({
        ownerId: "u1",
        name: "x".repeat(60),
        teamName: "T",
        seasonId: "2025",
      }),
    ).rejects.toThrow(/Nom de league/);
  });

  it("throw INVALID_TEAM_NAME si nom equipe vide", async () => {
    await expect(
      createLeague({ ownerId: "u1", name: "OK League", teamName: "ab", seasonId: "2025" }),
    ).rejects.toThrow(/Nom d'equipe/);
  });

  it("throw INVALID_SIZE hors borne 2-16", async () => {
    await expect(
      createLeague({
        ownerId: "u1",
        name: "OK League",
        teamName: "Team",
        seasonId: "2025",
        size: 1,
      }),
    ).rejects.toThrow(/Taille league/);
    await expect(
      createLeague({
        ownerId: "u1",
        name: "OK League",
        teamName: "Team",
        seasonId: "2025",
        size: 17,
      }),
    ).rejects.toThrow(/Taille league/);
  });
});

// ────────────────────────────────────────────────────────────────────
// getLeague
// ────────────────────────────────────────────────────────────────────

describe("getLeague", () => {
  it("retourne league + entries triees par joinedAt asc + rosterCount", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      entries: [
        { userId: "u1", _count: { roster: 5 } },
        { userId: "u2", _count: { roster: 0 } },
      ],
    } as never);

    const lg = await getLeague("lg1");
    expect(lg.id).toBe("lg1");
    expect(lg.entries[0].rosterCount).toBe(5);
    expect(lg.entries[1].rosterCount).toBe(0);
    expect(prisma.nflFantasyLeague.findUnique).toHaveBeenCalledWith({
      where: { id: "lg1" },
      include: {
        entries: {
          orderBy: { joinedAt: "asc" },
          include: { _count: { select: { roster: true } } },
        },
        cycle: true,
      },
    });
  });

  it("throw NOT_FOUND si absente", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue(null);

    await expect(getLeague("missing")).rejects.toThrow(/introuvable/);
  });
});

// ────────────────────────────────────────────────────────────────────
// listLeaguesForUser
// ────────────────────────────────────────────────────────────────────

describe("listLeaguesForUser", () => {
  it("filtre par user, tri createdAt desc", async () => {
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValue([] as never);

    await listLeaguesForUser("u1");

    expect(prisma.nflFantasyLeague.findMany).toHaveBeenCalledWith({
      where: { entries: { some: { userId: "u1" } } },
      orderBy: { createdAt: "desc" },
      include: {
        cycle: {
          select: {
            id: true,
            label: true,
            startWeek: true,
            endWeek: true,
            cycleType: true,
          },
        },
      },
    });
  });

  it("filtre par status si fourni", async () => {
    vi.mocked(prisma.nflFantasyLeague.findMany).mockResolvedValue([] as never);

    await listLeaguesForUser("u1", { status: "in_progress" });

    const arg = vi.mocked(prisma.nflFantasyLeague.findMany).mock.calls[0]?.[0];
    expect(arg?.where).toMatchObject({ status: "in_progress" });
  });
});

// ────────────────────────────────────────────────────────────────────
// joinLeague
// ────────────────────────────────────────────────────────────────────

describe("joinLeague", () => {
  function mockLeague(over: Partial<{ size: number; status: string }> = {}) {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      size: over.size ?? 10,
      status: over.status ?? "draft",
      type: "private",
      inviteCode: "ABCDEFGH",
    } as never);
  }

  it("rejoint via leagueId", async () => {
    mockLeague();
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflFantasyEntry.count).mockResolvedValue(3);
    vi.mocked(prisma.nflFantasyEntry.create).mockResolvedValue({
      id: "e2",
      leagueId: "lg1",
      userId: "u2",
      teamName: "Stompers",
    } as never);

    const entry = await joinLeague({
      userId: "u2",
      teamName: "Stompers",
      leagueId: "lg1",
    });
    expect(entry.id).toBe("e2");
  });

  it("rejoint via inviteCode", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg2",
      ownerId: "u1",
      size: 10,
      status: "draft",
      type: "private",
      inviteCode: "INVITE12",
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflFantasyEntry.count).mockResolvedValue(1);
    vi.mocked(prisma.nflFantasyEntry.create).mockResolvedValue({} as never);

    await joinLeague({
      userId: "u3",
      teamName: "Team Z",
      inviteCode: "INVITE12",
    });

    expect(prisma.nflFantasyLeague.findUnique).toHaveBeenCalledWith({
      where: { inviteCode: "INVITE12" },
    });
  });

  it("throw INVALID_INVITE si ni id ni code fourni", async () => {
    await expect(
      joinLeague({ userId: "u2", teamName: "Team" }),
    ).rejects.toThrow(/leagueId ou inviteCode/);
  });

  it("throw INVALID_INVITE si inviteCode inconnu", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue(null);

    await expect(
      joinLeague({ userId: "u2", teamName: "Team", inviteCode: "XXXXXXXX" }),
    ).rejects.toThrow(/Invite code XXXXXXXX invalide/);
  });

  it("throw INVALID_STATUS si pas en draft", async () => {
    mockLeague({ status: "in_progress" });

    await expect(
      joinLeague({ userId: "u2", teamName: "Team", leagueId: "lg1" }),
    ).rejects.toThrow(/Operation requise en status 'draft'/);
  });

  it("throw ALREADY_JOINED si user deja membre", async () => {
    mockLeague();
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "ex",
    } as never);

    await expect(
      joinLeague({ userId: "u2", teamName: "Team", leagueId: "lg1" }),
    ).rejects.toThrow(/deja membre/);
  });

  it("throw FULL si entries >= size", async () => {
    mockLeague({ size: 4 });
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflFantasyEntry.count).mockResolvedValue(4);

    await expect(
      joinLeague({ userId: "u2", teamName: "Team", leagueId: "lg1" }),
    ).rejects.toThrow(/pleine \(4\/4\)/);
  });

  it("convertit P2002 sur teamName en TEAM_NAME_TAKEN", async () => {
    mockLeague();
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.nflFantasyEntry.count).mockResolvedValue(2);
    vi.mocked(prisma.nflFantasyEntry.create).mockRejectedValue({
      code: "P2002",
      meta: { target: ["leagueId", "teamName"] },
    } as never);

    await expect(
      joinLeague({ userId: "u2", teamName: "Dup", leagueId: "lg1" }),
    ).rejects.toThrow(/TeamName "Dup" deja utilise/);
  });
});

// ────────────────────────────────────────────────────────────────────
// leaveLeague
// ────────────────────────────────────────────────────────────────────

describe("leaveLeague", () => {
  it("retire l'entry si user membre non-owner en draft", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "draft",
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({
      id: "e2",
    } as never);
    vi.mocked(prisma.nflFantasyEntry.delete).mockResolvedValue({} as never);

    await leaveLeague({ leagueId: "lg1", userId: "u2" });

    expect(prisma.nflFantasyEntry.delete).toHaveBeenCalledWith({
      where: { id: "e2" },
    });
  });

  it("throw OWNER_CANNOT_LEAVE si user est owner", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "draft",
    } as never);

    await expect(
      leaveLeague({ leagueId: "lg1", userId: "u1" }),
    ).rejects.toThrow(/Owner ne peut pas quitter/);
  });

  it("throw INVALID_STATUS si pas en draft", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "in_progress",
    } as never);

    await expect(
      leaveLeague({ leagueId: "lg1", userId: "u2" }),
    ).rejects.toThrow(/Operation requise en status 'draft'/);
  });

  it("throw NOT_FOUND si user pas membre", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "draft",
    } as never);
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);

    await expect(
      leaveLeague({ leagueId: "lg1", userId: "u2" }),
    ).rejects.toThrow(/n'est pas membre/);
  });
});

// ────────────────────────────────────────────────────────────────────
// updateLeague
// ────────────────────────────────────────────────────────────────────

describe("updateLeague", () => {
  function mockOwnedDraftLeague() {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      size: 10,
      type: "private",
      status: "draft",
    } as never);
  }

  it("update name (owner, draft)", async () => {
    mockOwnedDraftLeague();
    vi.mocked(prisma.nflFantasyLeague.update).mockResolvedValue({} as never);

    await updateLeague({ leagueId: "lg1", userId: "u1", name: "Renamed" });

    const arg = vi.mocked(prisma.nflFantasyLeague.update).mock.calls[0]?.[0];
    expect(arg?.data).toEqual({ name: "Renamed" });
  });

  it("pivot private -> public : efface l'inviteCode", async () => {
    mockOwnedDraftLeague();
    vi.mocked(prisma.nflFantasyLeague.update).mockResolvedValue({} as never);

    await updateLeague({ leagueId: "lg1", userId: "u1", type: "public" });

    const arg = vi.mocked(prisma.nflFantasyLeague.update).mock.calls[0]?.[0];
    expect(arg?.data).toMatchObject({ type: "public", inviteCode: null });
  });

  it("pivot public -> private : regenere un inviteCode", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      type: "public",
      status: "draft",
    } as never);
    vi.mocked(prisma.nflFantasyLeague.update).mockResolvedValue({} as never);

    await updateLeague({ leagueId: "lg1", userId: "u1", type: "private" });

    const arg = vi.mocked(prisma.nflFantasyLeague.update).mock.calls[0]?.[0];
    expect(arg?.data?.type).toBe("private");
    expect(arg?.data?.inviteCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("refuse size < nb entries actuelles", async () => {
    mockOwnedDraftLeague();
    vi.mocked(prisma.nflFantasyEntry.count).mockResolvedValue(5);

    await expect(
      updateLeague({ leagueId: "lg1", userId: "u1", size: 4 }),
    ).rejects.toThrow(/inferieure au nombre d'entries/);
  });

  it("throw NOT_OWNER si pas owner", async () => {
    mockOwnedDraftLeague();

    await expect(
      updateLeague({ leagueId: "lg1", userId: "u2", name: "X" }),
    ).rejects.toThrow(/n'est pas owner/);
  });

  it("throw INVALID_STATUS si pas en draft", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "in_progress",
    } as never);

    await expect(
      updateLeague({ leagueId: "lg1", userId: "u1", name: "X" }),
    ).rejects.toThrow(/Operation requise en status 'draft'/);
  });
});

// ────────────────────────────────────────────────────────────────────
// deleteLeague
// ────────────────────────────────────────────────────────────────────

describe("deleteLeague", () => {
  it("supprime si owner + draft", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "draft",
    } as never);
    vi.mocked(prisma.nflFantasyLeague.delete).mockResolvedValue({} as never);

    await deleteLeague({ leagueId: "lg1", userId: "u1" });

    expect(prisma.nflFantasyLeague.delete).toHaveBeenCalledWith({
      where: { id: "lg1" },
    });
  });

  it("throw NOT_OWNER si pas owner", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "draft",
    } as never);

    await expect(
      deleteLeague({ leagueId: "lg1", userId: "u2" }),
    ).rejects.toThrow(/n'est pas owner/);
  });

  it("throw INVALID_STATUS si in_progress", async () => {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "u1",
      status: "in_progress",
    } as never);

    await expect(
      deleteLeague({ leagueId: "lg1", userId: "u1" }),
    ).rejects.toThrow(/Operation requise en status 'draft'/);
  });
});

// ────────────────────────────────────────────────────────────────────
// NflFantasyLeagueError
// ────────────────────────────────────────────────────────────────────

describe("NflFantasyLeagueError", () => {
  it("preserve code et name", () => {
    const err = new NflFantasyLeagueError("NOT_FOUND", "boom");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.name).toBe("NflFantasyLeagueError");
    expect(err).toBeInstanceOf(Error);
  });

  it("supporte tous les codes documentes", () => {
    const codes = [
      "NOT_FOUND",
      "NOT_OWNER",
      "ALREADY_JOINED",
      "FULL",
      "INVALID_STATUS",
      "OWNER_CANNOT_LEAVE",
      "SEASON_NOT_FOUND",
      "INVALID_INVITE",
      "INVALID_NAME",
      "INVALID_TEAM_NAME",
      "INVALID_SIZE",
      "TEAM_NAME_TAKEN",
    ] as const;
    for (const c of codes) {
      expect(new NflFantasyLeagueError(c, "m").code).toBe(c);
    }
  });
});

describe("limites constants", () => {
  it("DEFAULT_LEAGUE_SIZE = 10 (Q2), range 2-16", () => {
    expect(DEFAULT_LEAGUE_SIZE).toBe(10);
    expect(LEAGUE_SIZE_MIN).toBe(2);
    expect(LEAGUE_SIZE_MAX).toBe(16);
  });
});

// ────────────────────────────────────────────────────────────────────
// populateLeagueWithTestCoaches (test mode helper)
// ────────────────────────────────────────────────────────────────────

describe("populateLeagueWithTestCoaches", () => {
  function mockLeague(overrides: Record<string, unknown> = {}) {
    vi.mocked(prisma.nflFantasyLeague.findUnique).mockResolvedValue({
      id: "lg1",
      ownerId: "owner-1",
      size: 10,
      status: "draft",
      draftBudget: 5000,
      ...overrides,
    } as never);
  }

  it("throw NOT_OWNER si caller != owner", async () => {
    mockLeague();
    await expect(
      populateLeagueWithTestCoaches({ leagueId: "lg1", userId: "intruder" }),
    ).rejects.toThrow(/n'est pas owner/);
  });

  it("throw INVALID_STATUS si league deja en cours", async () => {
    mockLeague({ status: "in_progress" });
    await expect(
      populateLeagueWithTestCoaches({ leagueId: "lg1", userId: "owner-1" }),
    ).rejects.toThrow(/status 'draft'/);
  });

  it("retourne added=0 quand le championnat est plein", async () => {
    mockLeague({ size: 2 });
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { userId: "owner-1", teamName: "Owner" },
      { userId: "u2", teamName: "Mate" },
    ] as never);
    const out = await populateLeagueWithTestCoaches({
      leagueId: "lg1",
      userId: "owner-1",
    });
    expect(out.added).toBe(0);
    expect(out.totalEntries).toBe(2);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("remplit les slots restants avec des users disponibles", async () => {
    mockLeague({ size: 4 });
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { userId: "owner-1", teamName: "Owner" },
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u2" },
      { id: "u3" },
      { id: "u4" },
    ] as never);
    vi.mocked(prisma.nflFantasyEntry.create).mockResolvedValue({} as never);

    const out = await populateLeagueWithTestCoaches({
      leagueId: "lg1",
      userId: "owner-1",
    });

    expect(out.added).toBe(3);
    expect(out.totalEntries).toBe(4);
    expect(prisma.nflFantasyEntry.create).toHaveBeenCalledTimes(3);
    // Verifie que l'owner et les users deja en entry sont exclus du
    // findMany candidats.
    const userArgs = vi.mocked(prisma.user.findMany).mock.calls[0]?.[0];
    expect((userArgs as { where: { id: { notIn: string[] } } }).where.id.notIn)
      .toContain("owner-1");
    expect((userArgs as { take: number }).take).toBe(3);
  });

  it("propage l'erreur create autre que P2002", async () => {
    mockLeague();
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u2" }] as never);
    vi.mocked(prisma.nflFantasyEntry.create).mockRejectedValue(
      new Error("DB down"),
    );
    await expect(
      populateLeagueWithTestCoaches({ leagueId: "lg1", userId: "owner-1" }),
    ).rejects.toThrow(/DB down/);
  });

  it("skip silencieusement les conflits P2002 (race avec un join manuel)", async () => {
    mockLeague();
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "u2" },
      { id: "u3" },
    ] as never);
    vi.mocked(prisma.nflFantasyEntry.create)
      .mockRejectedValueOnce(Object.assign(new Error("conflict"), { code: "P2002" }))
      .mockResolvedValueOnce({} as never);

    const out = await populateLeagueWithTestCoaches({
      leagueId: "lg1",
      userId: "owner-1",
    });
    expect(out.added).toBe(1);
  });
});
