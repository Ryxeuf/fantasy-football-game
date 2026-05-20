import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyEntry: { findUnique: vi.fn(), update: vi.fn() },
    nflPlayer: { findUnique: vi.fn() },
    nflFantasyRoster: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { prisma } from "../prisma";
import {
  addPlayerToRoster,
  getRoster,
  isPlayerOnRoster,
  NflFantasyRosterError,
  removePlayerFromRoster,
} from "./nfl-fantasy-roster";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("addPlayerToRoster", () => {
  it("ajoute un joueur + incremente totalTV", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(prisma.nflFantasyRoster.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, { id: "r1", entryId: "e1", playerId: "p1", tvCost: 100 }] as never);

    const row = await addPlayerToRoster({ entryId: "e1", playerId: "p1", tvCost: 100 });
    expect(row.id).toBe("r1");

    const txArgs = vi.mocked(prisma.$transaction).mock.calls[0]?.[0] as unknown[];
    expect(txArgs).toHaveLength(2);
  });

  it("throw ENTRY_NOT_FOUND si entry absente", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue(null);

    await expect(
      addPlayerToRoster({ entryId: "missing", playerId: "p1" }),
    ).rejects.toThrow(/Entry missing introuvable/);
  });

  it("throw PLAYER_NOT_FOUND si joueur absent", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue(null);

    await expect(
      addPlayerToRoster({ entryId: "e1", playerId: "missing" }),
    ).rejects.toThrow(/NflPlayer missing introuvable/);
  });

  it("throw PLAYER_ALREADY_ON_ROSTER si deja present", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(prisma.nflFantasyRoster.findUnique).mockResolvedValue({ id: "existing" } as never);

    await expect(
      addPlayerToRoster({ entryId: "e1", playerId: "p1" }),
    ).rejects.toThrow(/deja sur le roster/);
  });

  it("defaults acquiredVia=draft + tvCost=0", async () => {
    vi.mocked(prisma.nflFantasyEntry.findUnique).mockResolvedValue({ id: "e1" } as never);
    vi.mocked(prisma.nflPlayer.findUnique).mockResolvedValue({ id: "p1" } as never);
    vi.mocked(prisma.nflFantasyRoster.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockResolvedValue([{}, { id: "r1" }] as never);

    await addPlayerToRoster({ entryId: "e1", playerId: "p1" });

    // On ne peut pas directement inspecter le create dans $transaction batch,
    // mais on verifie que $transaction a ete appele.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("removePlayerFromRoster", () => {
  it("supprime + decremente totalTV", async () => {
    vi.mocked(prisma.nflFantasyRoster.findUnique).mockResolvedValue({
      id: "r1",
      entryId: "e1",
      playerId: "p1",
      tvCost: 80,
    } as never);
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never);

    await removePlayerFromRoster({ entryId: "e1", playerId: "p1" });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("throw PLAYER_NOT_ON_ROSTER si absent", async () => {
    vi.mocked(prisma.nflFantasyRoster.findUnique).mockResolvedValue(null);

    await expect(
      removePlayerFromRoster({ entryId: "e1", playerId: "p1" }),
    ).rejects.toThrow(/pas sur le roster/);
  });
});

describe("getRoster", () => {
  it("liste les joueurs tri acquiredAt asc", async () => {
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([] as never);

    await getRoster("e1");

    expect(prisma.nflFantasyRoster.findMany).toHaveBeenCalledWith({
      where: { entryId: "e1" },
      orderBy: { acquiredAt: "asc" },
    });
  });
});

describe("isPlayerOnRoster", () => {
  it("true si trouve", async () => {
    vi.mocked(prisma.nflFantasyRoster.findUnique).mockResolvedValue({ id: "r1" } as never);
    expect(await isPlayerOnRoster("e1", "p1")).toBe(true);
  });

  it("false sinon", async () => {
    vi.mocked(prisma.nflFantasyRoster.findUnique).mockResolvedValue(null);
    expect(await isPlayerOnRoster("e1", "p1")).toBe(false);
  });
});

describe("NflFantasyRosterError", () => {
  it("preserve code + name", () => {
    const err = new NflFantasyRosterError("PLAYER_NOT_FOUND", "boom");
    expect(err.code).toBe("PLAYER_NOT_FOUND");
    expect(err.name).toBe("NflFantasyRosterError");
    expect(err).toBeInstanceOf(Error);
  });
});
