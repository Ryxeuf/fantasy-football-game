import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyEntry: { findUnique: vi.fn() },
    nflFantasyReroll: {
      count: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    nflFantasyInducement: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";
import {
  consumeInducement,
  consumeReroll,
  countAvailableRerolls,
  countRemainingInducementSlots,
  grantReroll,
  INDUCEMENT_SLOTS_PER_MATCHUP,
  listInducements,
  listRerolls,
  NflFantasyMercatoError,
  seedStartingRerolls,
  STARTING_REROLLS,
} from "./nfl-fantasy-mercato";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("constants V1", () => {
  it("STARTING_REROLLS = 8 (vision V1)", () => {
    expect(STARTING_REROLLS).toBe(8);
  });
  it("INDUCEMENT_SLOTS_PER_MATCHUP = 3 (vision V1)", () => {
    expect(INDUCEMENT_SLOTS_PER_MATCHUP).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// seedStartingRerolls
// ────────────────────────────────────────────────────────────────────

describe("seedStartingRerolls", () => {
  it("cree 8 rerolls source=starter (count default)", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflFantasyReroll.count).mockResolvedValue(0);
    vi.mocked(prisma.nflFantasyReroll.createMany).mockResolvedValue({ count: 8 } as never);

    const out = await seedStartingRerolls({ entryId: "e1" });

    expect(out.rerollsSeeded).toBe(8);
    const arg = vi.mocked(prisma.nflFantasyReroll.createMany).mock.calls[0]?.[0];
    expect((arg?.data as unknown[]).length).toBe(8);
  });

  it("idempotent : skip si starters existent deja", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflFantasyReroll.count).mockResolvedValue(8);

    const out = await seedStartingRerolls({ entryId: "e1" });

    expect(out.rerollsSeeded).toBe(0);
    expect(prisma.nflFantasyReroll.createMany).not.toHaveBeenCalled();
  });

  it("override count", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflFantasyReroll.count).mockResolvedValue(0);
    vi.mocked(prisma.nflFantasyReroll.createMany).mockResolvedValue({} as never);

    const out = await seedStartingRerolls({ entryId: "e1", count: 12 });

    expect(out.rerollsSeeded).toBe(12);
  });

  it("ENTRY_NOT_FOUND", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);

    await expect(seedStartingRerolls({ entryId: "missing" })).rejects.toThrow(
      /Entry missing introuvable/,
    );
  });
});

// ────────────────────────────────────────────────────────────────────
// grantReroll
// ────────────────────────────────────────────────────────────────────

describe("grantReroll", () => {
  it("cree un reroll avec source != starter", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflFantasyReroll.create).mockResolvedValue({
      id: "r1",
      entryId: "e1",
      source: "achievement",
      type: "team_reroll",
    } as never);

    const r = await grantReroll({ entryId: "e1", source: "achievement" });
    expect(r.id).toBe("r1");
  });

  it("INVALID_TYPE pour un type inconnu", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);

    await expect(
      grantReroll({ entryId: "e1", source: "purchased", type: "bogus" }),
    ).rejects.toThrow(/Type reroll inconnu/);
  });

  it("INVALID_TYPE pour une source inconnue", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);

    await expect(
      grantReroll({ entryId: "e1", source: "magic" }),
    ).rejects.toThrow(/Source reroll inconnue/);
  });
});

// ────────────────────────────────────────────────────────────────────
// consumeReroll
// ────────────────────────────────────────────────────────────────────

describe("consumeReroll", () => {
  it("marque used=true + usedAt + contexte", async () => {
    vi.mocked(prisma.nflFantasyReroll.findUnique).mockResolvedValue({
      id: "r1",
      entryId: "e1",
      used: false,
    } as never);
    vi.mocked(prisma.nflFantasyReroll.update).mockResolvedValue({ id: "r1" } as never);

    await consumeReroll({
      rerollId: "r1",
      entryId: "e1",
      weekId: "2025:W10",
      matchupId: "m1",
      appliedTo: "p42",
    });

    const arg = vi.mocked(prisma.nflFantasyReroll.update).mock.calls[0]?.[0];
    expect(arg?.data).toMatchObject({
      used: true,
      weekId: "2025:W10",
      matchupId: "m1",
      appliedTo: "p42",
    });
  });

  it("REROLL_NOT_FOUND", async () => {
    vi.mocked(prisma.nflFantasyReroll.findUnique).mockResolvedValue(null);

    await expect(
      consumeReroll({ rerollId: "missing", entryId: "e1", weekId: "w", matchupId: "m" }),
    ).rejects.toThrow(/Reroll missing introuvable/);
  });

  it("REROLL_NOT_OWNED si entryId mismatch", async () => {
    vi.mocked(prisma.nflFantasyReroll.findUnique).mockResolvedValue({
      id: "r1",
      entryId: "eX",
      used: false,
    } as never);

    await expect(
      consumeReroll({ rerollId: "r1", entryId: "e1", weekId: "w", matchupId: "m" }),
    ).rejects.toThrow(/appartient a une autre entry/);
  });

  it("REROLL_ALREADY_USED", async () => {
    vi.mocked(prisma.nflFantasyReroll.findUnique).mockResolvedValue({
      id: "r1",
      entryId: "e1",
      used: true,
    } as never);

    await expect(
      consumeReroll({ rerollId: "r1", entryId: "e1", weekId: "w", matchupId: "m" }),
    ).rejects.toThrow(/deja consomme/);
  });
});

// ────────────────────────────────────────────────────────────────────
// listRerolls + count
// ────────────────────────────────────────────────────────────────────

describe("listRerolls", () => {
  it("filtre used=true / used=false / undefined", async () => {
    vi.mocked(prisma.nflFantasyReroll.findMany).mockResolvedValue([] as never);

    await listRerolls({ entryId: "e1", used: false });
    expect(prisma.nflFantasyReroll.findMany).toHaveBeenCalledWith({
      where: { entryId: "e1", used: false },
      orderBy: { createdAt: "asc" },
    });

    vi.mocked(prisma.nflFantasyReroll.findMany).mockClear();
    await listRerolls({ entryId: "e1" });
    expect(prisma.nflFantasyReroll.findMany).toHaveBeenCalledWith({
      where: { entryId: "e1" },
      orderBy: { createdAt: "asc" },
    });
  });
});

describe("countAvailableRerolls", () => {
  it("compte les non-used", async () => {
    vi.mocked(prisma.nflFantasyReroll.count).mockResolvedValue(5);
    expect(await countAvailableRerolls("e1")).toBe(5);
    expect(prisma.nflFantasyReroll.count).toHaveBeenCalledWith({
      where: { entryId: "e1", used: false },
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// consumeInducement
// ────────────────────────────────────────────────────────────────────

describe("consumeInducement", () => {
  it("cree un inducement si limite pas atteinte", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflFantasyInducement.count).mockResolvedValue(1);
    vi.mocked(prisma.nflFantasyInducement.create).mockResolvedValue({ id: "i1" } as never);

    const i = await consumeInducement({
      entryId: "e1",
      weekId: "2025:W10",
      matchupId: "m1",
      type: "wizard",
      slot: "wildcard",
    });
    expect(i.id).toBe("i1");
  });

  it("INDUCEMENT_LIMIT_REACHED si 3 deja utilises", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflFantasyInducement.count).mockResolvedValue(3);

    await expect(
      consumeInducement({
        entryId: "e1",
        weekId: "2025:W10",
        matchupId: "m1",
        type: "wizard",
      }),
    ).rejects.toThrow(/3 inducements deja utilises/);
  });

  it("INVALID_SLOT", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);

    await expect(
      consumeInducement({
        entryId: "e1",
        weekId: "w",
        matchupId: "m",
        type: "wizard",
        slot: "bogus",
      }),
    ).rejects.toThrow(/Slot inducement inconnu/);
  });

  it("INVALID_TYPE si type vide", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);

    await expect(
      consumeInducement({
        entryId: "e1",
        weekId: "w",
        matchupId: "m",
        type: "",
      }),
    ).rejects.toThrow(/type inducement requis/);
  });

  it("default slot=wildcard, source=purchased", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflFantasyInducement.count).mockResolvedValue(0);
    vi.mocked(prisma.nflFantasyInducement.create).mockResolvedValue({} as never);

    await consumeInducement({
      entryId: "e1",
      weekId: "w",
      matchupId: "m",
      type: "wizard",
    });

    const arg = vi.mocked(prisma.nflFantasyInducement.create).mock.calls[0]?.[0];
    expect(arg?.data).toMatchObject({ slot: "wildcard", source: "purchased" });
  });
});

describe("listInducements + countRemainingInducementSlots", () => {
  it("listInducements filtre week+matchup", async () => {
    vi.mocked(prisma.nflFantasyInducement.findMany).mockResolvedValue([] as never);

    await listInducements({ entryId: "e1", weekId: "2025:W10", matchupId: "m1" });

    expect(prisma.nflFantasyInducement.findMany).toHaveBeenCalledWith({
      where: { entryId: "e1", weekId: "2025:W10", matchupId: "m1" },
      orderBy: { createdAt: "asc" },
    });
  });

  it("countRemaining = 3 - count utilises (>=0)", async () => {
    vi.mocked(prisma.nflFantasyInducement.count).mockResolvedValue(2);

    const remaining = await countRemainingInducementSlots({
      entryId: "e1",
      weekId: "2025:W10",
      matchupId: "m1",
    });
    expect(remaining).toBe(1);
  });

  it("countRemaining clampe a 0 si overflow", async () => {
    vi.mocked(prisma.nflFantasyInducement.count).mockResolvedValue(5);
    expect(
      await countRemainingInducementSlots({
        entryId: "e1",
        weekId: "w",
        matchupId: "m",
      }),
    ).toBe(0);
  });
});

describe("NflFantasyMercatoError", () => {
  it("preserve code + name", () => {
    const err = new NflFantasyMercatoError("REROLL_NOT_OWNED", "boom");
    expect(err.code).toBe("REROLL_NOT_OWNED");
    expect(err.name).toBe("NflFantasyMercatoError");
  });
});
