import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    proUserBadge: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
    proBet: { findMany: vi.fn() },
    proSpectatorFollow: { findFirst: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  BADGE_CATALOGUE,
  evaluateBadgesForUser,
  getCatalogueWithStatus,
  listUserBadges,
} from "./pro-badges";

interface MockedPrisma {
  proUserBadge: {
    findMany: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
  };
  proBet: { findMany: ReturnType<typeof vi.fn> };
  proSpectatorFollow: { findFirst: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

const USER = "user_1";

function bet(
  status: "won" | "lost" | "pending",
  oddsAtPlace: number,
  marketType: string,
  i: number,
) {
  return {
    id: `b${i}`,
    stake: 100,
    payoutAmount: status === "won" ? 200 : status === "lost" ? 0 : null,
    oddsAtPlace,
    status,
    createdAt: new Date(2026, 0, i + 1),
    market: { type: marketType },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocked.proUserBadge.findMany.mockResolvedValue([]);
  mocked.proUserBadge.createMany.mockResolvedValue({ count: 0 });
  mocked.proBet.findMany.mockResolvedValue([]);
  mocked.proSpectatorFollow.findFirst.mockResolvedValue(null);
});

describe("evaluateBadgesForUser — sprint 1.D.9", () => {
  it("[] si rien n'est gagné", async () => {
    const out = await evaluateBadgesForUser(USER);
    expect(out).toEqual([]);
  });

  it("first_kickoff sur 1er pari", async () => {
    mocked.proBet.findMany.mockResolvedValue([
      bet("pending", 2.0, "ONE_X_TWO", 0),
    ]);
    const out = await evaluateBadgesForUser(USER);
    expect(out).toContain("first_kickoff");
  });

  it("oracle_of_nuffle après 10 wins consécutifs", async () => {
    const bets = Array.from({ length: 10 }, (_, i) =>
      bet("won", 2.0, "ONE_X_TWO", i),
    );
    mocked.proBet.findMany.mockResolvedValue(bets);
    const out = await evaluateBadgesForUser(USER);
    expect(out).toContain("oracle_of_nuffle");
  });

  it("ne donne pas oracle si streak cassé", async () => {
    const bets = [
      ...Array.from({ length: 5 }, (_, i) =>
        bet("won", 2.0, "ONE_X_TWO", i),
      ),
      bet("lost", 2.0, "ONE_X_TWO", 5),
      ...Array.from({ length: 5 }, (_, i) =>
        bet("won", 2.0, "ONE_X_TWO", i + 6),
      ),
    ];
    mocked.proBet.findMany.mockResolvedValue(bets);
    const out = await evaluateBadgesForUser(USER);
    expect(out).not.toContain("oracle_of_nuffle");
  });

  it("blood_reader si ≥10 CAS_COUNT settled et accuracy ≥ 90%", async () => {
    const bets = [
      ...Array.from({ length: 9 }, (_, i) =>
        bet("won", 1.7, "CAS_COUNT", i),
      ),
      bet("lost", 1.7, "CAS_COUNT", 9),
      // 9/10 = 90% ✓
    ];
    mocked.proBet.findMany.mockResolvedValue(bets);
    const out = await evaluateBadgesForUser(USER);
    expect(out).toContain("blood_reader");
  });

  it("ne donne pas blood_reader si < 10 bets violents", async () => {
    const bets = Array.from({ length: 9 }, (_, i) =>
      bet("won", 1.7, "CAS_COUNT", i),
    );
    mocked.proBet.findMany.mockResolvedValue(bets);
    const out = await evaluateBadgesForUser(USER);
    expect(out).not.toContain("blood_reader");
  });

  it("underdog_whisperer si 5 wins à cote ≥ 5", async () => {
    const bets = Array.from({ length: 5 }, (_, i) =>
      bet("won", 6.0, "ONE_X_TWO", i),
    );
    mocked.proBet.findMany.mockResolvedValue(bets);
    const out = await evaluateBadgesForUser(USER);
    expect(out).toContain("underdog_whisperer");
  });

  it("ne donne pas underdog si cotes < 5", async () => {
    const bets = Array.from({ length: 5 }, (_, i) =>
      bet("won", 4.99, "ONE_X_TWO", i),
    );
    mocked.proBet.findMany.mockResolvedValue(bets);
    const out = await evaluateBadgesForUser(USER);
    expect(out).not.toContain("underdog_whisperer");
  });

  it("loyal_fan si follow depuis ≥ 30j", async () => {
    const now = new Date("2026-09-30T00:00:00Z");
    const oldFollow = new Date("2026-08-29T00:00:00Z"); // 32j
    mocked.proSpectatorFollow.findFirst.mockResolvedValue({
      since: oldFollow,
    });
    const out = await evaluateBadgesForUser(USER, now);
    expect(out).toContain("loyal_fan");
  });

  it("ne donne pas loyal_fan si follow < 30j", async () => {
    const now = new Date("2026-09-30T00:00:00Z");
    mocked.proSpectatorFollow.findFirst.mockResolvedValue({
      since: new Date("2026-09-15T00:00:00Z"), // 15j
    });
    const out = await evaluateBadgesForUser(USER, now);
    expect(out).not.toContain("loyal_fan");
  });

  it("idempotent : ne re-grant pas les badges déjà earned", async () => {
    mocked.proUserBadge.findMany.mockResolvedValue([
      { badgeCode: "first_kickoff" },
    ]);
    mocked.proBet.findMany.mockResolvedValue([
      bet("pending", 2.0, "ONE_X_TWO", 0),
    ]);
    const out = await evaluateBadgesForUser(USER);
    expect(out).not.toContain("first_kickoff");
  });

  it("createMany appelé avec skipDuplicates=true", async () => {
    mocked.proBet.findMany.mockResolvedValue([
      bet("pending", 2.0, "ONE_X_TWO", 0),
    ]);
    await evaluateBadgesForUser(USER);
    expect(mocked.proUserBadge.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ userId: USER, badgeCode: "first_kickoff" }],
        skipDuplicates: true,
      }),
    );
  });
});

describe("listUserBadges — sprint 1.D.9", () => {
  it("formate les rows avec catalogue lookup", async () => {
    mocked.proUserBadge.findMany.mockResolvedValue([
      {
        badgeCode: "first_kickoff",
        earnedAt: new Date("2026-09-01T12:00:00Z"),
      },
      {
        badgeCode: "unknown_badge",
        earnedAt: new Date(),
      },
    ]);
    const out = await listUserBadges(USER);
    expect(out).toHaveLength(1); // unknown filtré
    expect(out[0].code).toBe("first_kickoff");
    expect(out[0].name).toBeTruthy();
    expect(out[0].emoji).toBeTruthy();
    expect(out[0].earnedAt).toBe("2026-09-01T12:00:00.000Z");
  });
});

describe("getCatalogueWithStatus — sprint 1.D.9", () => {
  it("renvoie tous les badges du catalogue avec earned status", async () => {
    mocked.proUserBadge.findMany.mockResolvedValue([
      { badgeCode: "first_kickoff", earnedAt: new Date() },
    ]);
    const out = await getCatalogueWithStatus(USER);
    expect(out).toHaveLength(BADGE_CATALOGUE.length);
    const fk = out.find((b) => b.code === "first_kickoff");
    expect(fk?.earned).toBe(true);
    const oracle = out.find((b) => b.code === "oracle_of_nuffle");
    expect(oracle?.earned).toBe(false);
  });
});
