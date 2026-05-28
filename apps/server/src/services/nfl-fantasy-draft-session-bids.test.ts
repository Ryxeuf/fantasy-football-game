import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyDraftBid: { findMany: vi.fn(), aggregate: vi.fn() },
    nflPlayer: { findMany: vi.fn() },
  },
}));

import { prisma } from "../prisma";
import {
  listBidsForEntry,
  sumPendingBidsForEntry,
} from "./nfl-fantasy-draft-session";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listBidsForEntry", () => {
  it("joint NflPlayer pour pseudo/position/teamCode/currentValue", async () => {
    vi.mocked(prisma.nflFantasyDraftBid.findMany).mockResolvedValue([
      { id: "b1", playerId: "p1", amount: 600, status: "pending" },
      { id: "b2", playerId: "p2", amount: 400, status: "pending" },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      {
        id: "p1",
        pseudonym: "Le Sidearm Wizard de Buffalo, #17",
        bbPosition: "Thrower",
        teamCode: "BUF",
        currentValue: 686,
      },
      {
        id: "p2",
        pseudonym: "Le Gutter Runner de Cincy, #22",
        bbPosition: "GutterRunner",
        teamCode: "CIN",
        currentValue: 420,
      },
    ] as never);

    const out = await listBidsForEntry({
      sessionId: "s1",
      entryId: "e1",
    });
    expect(out).toHaveLength(2);
    expect(out[0]?.pseudonym).toBe("Le Sidearm Wizard de Buffalo, #17");
    expect(out[0]?.bbPosition).toBe("Thrower");
    expect(out[0]?.teamCode).toBe("BUF");
    expect(out[0]?.currentValue).toBe(686);
  });

  it("retourne [] sans toucher NflPlayer si aucune bid", async () => {
    vi.mocked(prisma.nflFantasyDraftBid.findMany).mockResolvedValue([] as never);
    const out = await listBidsForEntry({ sessionId: "s1", entryId: "e1" });
    expect(out).toEqual([]);
    expect(prisma.nflPlayer.findMany).not.toHaveBeenCalled();
  });

  it("tolere un joueur absent (FA / supprime) : champs null", async () => {
    vi.mocked(prisma.nflFantasyDraftBid.findMany).mockResolvedValue([
      { id: "b1", playerId: "pGhost", amount: 100, status: "pending" },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([] as never);
    const out = await listBidsForEntry({ sessionId: "s1", entryId: "e1" });
    expect(out[0]?.pseudonym).toBeNull();
    expect(out[0]?.bbPosition).toBeNull();
    expect(out[0]?.teamCode).toBeNull();
    expect(out[0]?.currentValue).toBeNull();
  });
});

describe("sumPendingBidsForEntry", () => {
  it("retourne la somme des bids pending", async () => {
    vi.mocked(prisma.nflFantasyDraftBid.aggregate).mockResolvedValue({
      _sum: { amount: 1255 },
    } as never);
    const out = await sumPendingBidsForEntry({
      sessionId: "s1",
      entryId: "e1",
    });
    expect(out).toBe(1255);

    const call = vi.mocked(prisma.nflFantasyDraftBid.aggregate).mock.calls[0]![0];
    expect(call.where).toMatchObject({
      sessionId: "s1",
      entryId: "e1",
      status: "pending",
    });
  });

  it("0 si aucune bid pending", async () => {
    vi.mocked(prisma.nflFantasyDraftBid.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as never);
    const out = await sumPendingBidsForEntry({
      sessionId: "s1",
      entryId: "e1",
    });
    expect(out).toBe(0);
  });
});
