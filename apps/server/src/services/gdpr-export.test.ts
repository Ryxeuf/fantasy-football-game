/**
 * Tests pour `exportUserData` (Sprint P — Lot P.A.3).
 *
 * Couvre :
 *   - User introuvable → throw.
 *   - Snapshot complet : account + 9 collections (teams, matches,
 *     bets, transactions, badges, achievements, follows, tutorial,
 *     elo).
 *   - schemaVersion=1, generatedAt ISO.
 *   - passwordHash JAMAIS expose.
 *   - Collections vides → arrays vides (pas null).
 *   - Dates serialisees en ISO 8601 systematiquement.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    team: { findMany: vi.fn() },
    match: { findMany: vi.fn() },
    proBet: { findMany: vi.fn() },
    proTransaction: { findMany: vi.fn() },
    proUserBadge: { findMany: vi.fn() },
    userAchievement: { findMany: vi.fn() },
    proSpectatorFollow: { findMany: vi.fn() },
    tutorialCompletion: { findMany: vi.fn() },
    eloSnapshot: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import { exportUserData } from "./gdpr-export";

interface MockedPrisma {
  user: { findUnique: ReturnType<typeof vi.fn> };
  team: { findMany: ReturnType<typeof vi.fn> };
  match: { findMany: ReturnType<typeof vi.fn> };
  proBet: { findMany: ReturnType<typeof vi.fn> };
  proTransaction: { findMany: ReturnType<typeof vi.fn> };
  proUserBadge: { findMany: ReturnType<typeof vi.fn> };
  userAchievement: { findMany: ReturnType<typeof vi.fn> };
  proSpectatorFollow: { findMany: ReturnType<typeof vi.fn> };
  tutorialCompletion: { findMany: ReturnType<typeof vi.fn> };
  eloSnapshot: { findMany: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

const FAKE_USER = {
  id: "u1",
  email: "alice@example.test",
  coachName: "alice",
  firstName: "Alice",
  lastName: "Smith",
  dateOfBirth: new Date("1990-01-01T00:00:00Z"),
  role: "user",
  eloRating: 1234,
  patreon: false,
  supporterTier: null,
  supporterActiveUntil: null,
  privateProfile: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  lastLoginAt: new Date("2026-05-11T00:00:00Z"),
};

function setEmptyCollections() {
  mocked.team.findMany.mockResolvedValue([]);
  mocked.match.findMany.mockResolvedValue([]);
  mocked.proBet.findMany.mockResolvedValue([]);
  mocked.proTransaction.findMany.mockResolvedValue([]);
  mocked.proUserBadge.findMany.mockResolvedValue([]);
  mocked.userAchievement.findMany.mockResolvedValue([]);
  mocked.proSpectatorFollow.findMany.mockResolvedValue([]);
  mocked.tutorialCompletion.findMany.mockResolvedValue([]);
  mocked.eloSnapshot.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("exportUserData — Lot P.A.3", () => {
  it("throw si l'user n'existe pas", async () => {
    mocked.user.findUnique.mockResolvedValueOnce(null);
    await expect(exportUserData("missing")).rejects.toThrow();
  });

  it("happy path : snapshot complet avec 9 collections", async () => {
    mocked.user.findUnique.mockResolvedValueOnce(FAKE_USER);
    mocked.team.findMany.mockResolvedValueOnce([
      {
        id: "t1",
        name: "Snow Ogres",
        roster: "ogre",
        ruleset: "season_3",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      },
    ]);
    mocked.match.findMany.mockResolvedValueOnce([
      {
        id: "m1",
        status: "completed",
        createdAt: new Date("2026-03-01T00:00:00Z"),
        lastMoveAt: new Date("2026-03-01T01:30:00Z"),
      },
    ]);
    mocked.proBet.findMany.mockResolvedValueOnce([
      {
        id: "b1",
        matchId: "pm1",
        selection: "home",
        stake: 100,
        oddsAtPlace: 2.5,
        status: "won",
        payoutAmount: 250,
        createdAt: new Date("2026-04-01T00:00:00Z"),
      },
    ]);
    mocked.proTransaction.findMany.mockResolvedValueOnce([
      {
        id: "tx1",
        type: "DAILY",
        amount: 50,
        ref: null,
        createdAt: new Date("2026-05-01T00:00:00Z"),
      },
    ]);
    mocked.proUserBadge.findMany.mockResolvedValueOnce([
      { badgeCode: "first_kickoff", earnedAt: new Date("2026-04-15T00:00:00Z") },
    ]);
    mocked.userAchievement.findMany.mockResolvedValueOnce([
      { slug: "first_match", unlockedAt: new Date("2026-02-15T00:00:00Z") },
    ]);
    mocked.proSpectatorFollow.findMany.mockResolvedValueOnce([
      { proTeamId: "buf-snow-ogres", since: new Date("2026-03-15T00:00:00Z") },
    ]);
    mocked.tutorialCompletion.findMany.mockResolvedValueOnce([
      { lessonSlug: "intro", completedAt: new Date("2026-01-02T00:00:00Z") },
    ]);
    mocked.eloSnapshot.findMany.mockResolvedValueOnce([
      {
        rating: 1234,
        delta: 25,
        matchId: "m1",
        recordedAt: new Date("2026-03-01T02:00:00Z"),
      },
    ]);

    const out = await exportUserData("u1");
    expect(out.schemaVersion).toBe(1);
    expect(out.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(out.account.id).toBe("u1");
    expect(out.account.email).toBe("alice@example.test");
    expect(out.account.coachName).toBe("alice");
    expect(out.account.dateOfBirth).toBe("1990-01-01T00:00:00.000Z");
    expect(out.account.createdAt).toBe("2026-01-01T00:00:00.000Z");

    expect(out.teams).toHaveLength(1);
    expect(out.teams[0]!.id).toBe("t1");
    expect(out.teams[0]!.createdAt).toBe("2026-02-01T00:00:00.000Z");

    expect(out.matches[0]!.id).toBe("m1");
    expect(out.matches[0]!.lastMoveAt).toBe("2026-03-01T01:30:00.000Z");

    expect(out.bets[0]!.stake).toBe(100);
    expect(out.bets[0]!.payoutAmount).toBe(250);

    expect(out.transactions[0]!.type).toBe("DAILY");
    expect(out.transactions[0]!.amount).toBe(50);

    expect(out.badges[0]!.badgeCode).toBe("first_kickoff");
    expect(out.achievements[0]!.slug).toBe("first_match");
    expect(out.follows[0]!.proTeamSlug).toBe("buf-snow-ogres");
    expect(out.tutorialCompletions[0]!.lessonSlug).toBe("intro");
    expect(out.eloSnapshots[0]!.rating).toBe(1234);
  });

  it("ne JAMAIS expose passwordHash", async () => {
    mocked.user.findUnique.mockResolvedValueOnce(FAKE_USER);
    setEmptyCollections();
    const out = await exportUserData("u1");

    // L'object account ne doit pas contenir passwordHash
    const flat = JSON.stringify(out);
    expect(flat.toLowerCase()).not.toContain("passwordhash");

    // Le select user.findUnique ne demande pas passwordHash
    const selectArg = mocked.user.findUnique.mock.calls[0]![0];
    expect(selectArg.select.passwordHash).toBeUndefined();
  });

  it("collections vides → arrays vides (pas null/undefined)", async () => {
    mocked.user.findUnique.mockResolvedValueOnce(FAKE_USER);
    setEmptyCollections();
    const out = await exportUserData("u1");
    expect(out.teams).toEqual([]);
    expect(out.matches).toEqual([]);
    expect(out.bets).toEqual([]);
    expect(out.transactions).toEqual([]);
    expect(out.badges).toEqual([]);
    expect(out.achievements).toEqual([]);
    expect(out.follows).toEqual([]);
    expect(out.tutorialCompletions).toEqual([]);
    expect(out.eloSnapshots).toEqual([]);
  });

  it("dateOfBirth=null si user n'a pas renseigne", async () => {
    mocked.user.findUnique.mockResolvedValueOnce({
      ...FAKE_USER,
      dateOfBirth: null,
      lastLoginAt: null,
    });
    setEmptyCollections();
    const out = await exportUserData("u1");
    expect(out.account.dateOfBirth).toBeNull();
    expect(out.account.lastLoginAt).toBeNull();
  });

  it("calculer isSupporter via Patreon flag ou supporter actif", async () => {
    mocked.user.findUnique.mockResolvedValueOnce({
      ...FAKE_USER,
      patreon: true,
    });
    setEmptyCollections();
    const out = await exportUserData("u1");
    expect(out.account.isSupporter).toBe(true);
  });
});
