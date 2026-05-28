import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../prisma", () => ({
  prisma: {
    nflFantasyDraftSession: { findUnique: vi.fn() },
    nflFantasyEntry: { findMany: vi.fn() },
    nflFantasyRoster: { findMany: vi.fn() },
    nflPlayer: { findMany: vi.fn() },
    nflFantasyDraftBid: { upsert: vi.fn() },
  },
}));

import type { BbPosition } from "@bb/nfl-mapper";
import { prisma } from "../prisma";
import {
  BotDraftError,
  pickBotBids,
  placeBotBidsForSession,
  type BotCandidate,
  type BotEntry,
} from "./nfl-fantasy-bot-draft";

function cand(
  playerId: string,
  bbPosition: BbPosition,
  currentValue: number,
  basePrice = 50,
): BotCandidate {
  return { playerId, bbPosition, currentValue, basePrice };
}

function entry(entryId: string, budgetRemaining = 5000): BotEntry {
  return { entryId, budgetRemaining };
}

describe("pickBotBids", () => {
  it("respecte les quotas par bucket (Thrower / Catcher-Runner / Lineman / Blitzer / Big Guy)", () => {
    const candidates: BotCandidate[] = [
      cand("th1", "Thrower", 300),
      cand("th2", "Thrower", 280),
      cand("ca1", "Catcher", 250),
      cand("ca2", "Catcher", 240),
      cand("ru1", "Runner", 230),
      cand("ru2", "Runner", 220),
      cand("li1", "Lineman", 100),
      cand("li2", "Lineman", 95),
      cand("li3", "Lineman", 90),
      cand("li4", "Lineman", 85),
      cand("li5", "Lineman", 80),
      cand("bl1", "Blitzer", 200),
      cand("bl2", "Blitzer", 195),
      cand("bl3", "Blitzer", 190),
      cand("bg1", "Ogre", 400),
      cand("bg2", "Ogre", 380),
    ];
    const out = pickBotBids({ entries: [entry("e1")], candidates, bidsPerEntry: 12 });
    expect(out).toHaveLength(12);
    const slugs = out.map((b) => b.playerId);
    // 1 Thrower, 3 Catcher/Runner, 4 Lineman, 3 Blitzer, 1 Big Guy
    expect(slugs.filter((s) => s.startsWith("th"))).toHaveLength(1);
    expect(slugs.filter((s) => s.startsWith("ca") || s.startsWith("ru"))).toHaveLength(3);
    expect(slugs.filter((s) => s.startsWith("li"))).toHaveLength(4);
    expect(slugs.filter((s) => s.startsWith("bl"))).toHaveLength(3);
    expect(slugs.filter((s) => s.startsWith("bg"))).toHaveLength(1);
  });

  it("calcule un bid centre sur 110% de currentValue avec jitter ±10%", () => {
    const candidates: BotCandidate[] = [
      cand("p1", "Thrower", 100),
      cand("p2", "Lineman", 100),
      cand("p3", "Catcher", 100),
      cand("p4", "Blitzer", 100),
    ];
    const out = pickBotBids({
      entries: [entry("e1")],
      candidates,
      bidsPerEntry: 4,
    });
    expect(out).toHaveLength(4);
    for (const b of out) {
      // 110% ± 10% → entre 100% (100) et 120% (120) de currentValue.
      expect(b.amount).toBeGreaterThanOrEqual(100);
      expect(b.amount).toBeLessThanOrEqual(120);
    }
  });

  it("respecte le basePrice plancher", () => {
    const candidates: BotCandidate[] = [
      cand("p1", "Lineman", 50, 80), // currentValue < basePrice
    ];
    const out = pickBotBids({
      entries: [entry("e1")],
      candidates,
      bidsPerEntry: 1,
    });
    expect(out[0]?.amount).toBeGreaterThanOrEqual(80);
  });

  it("respecte le budget remaining comme cap (overbooking-safe)", () => {
    const candidates: BotCandidate[] = [
      cand("p1", "Thrower", 10000), // currentValue tres au-dessus du budget
    ];
    const out = pickBotBids({
      entries: [entry("e1", 500)],
      candidates,
      bidsPerEntry: 1,
    });
    expect(out[0]?.amount).toBeLessThanOrEqual(500);
  });

  it("exclut les joueurs deja sur roster de l'entry", () => {
    const candidates: BotCandidate[] = [
      cand("p1", "Thrower", 300),
      cand("p2", "Catcher", 250),
    ];
    const out = pickBotBids({
      entries: [entry("e1")],
      candidates,
      bidsPerEntry: 5,
      excludedByEntry: { e1: new Set(["p1"]) },
    });
    const ids = out.map((b) => b.playerId);
    expect(ids).not.toContain("p1");
    expect(ids).toContain("p2");
  });

  it("deterministe : meme input → meme output", () => {
    const candidates: BotCandidate[] = [
      cand("th1", "Thrower", 300),
      cand("th2", "Thrower", 250),
      cand("li1", "Lineman", 100),
      cand("li2", "Lineman", 90),
    ];
    const a = pickBotBids({ entries: [entry("e1")], candidates, bidsPerEntry: 3 });
    const b = pickBotBids({ entries: [entry("e1")], candidates, bidsPerEntry: 3 });
    expect(a).toEqual(b);
  });

  it("bots distincts (entryId different) ont des bids differents", () => {
    const candidates: BotCandidate[] = [
      cand("th1", "Thrower", 300),
      cand("th2", "Thrower", 250),
      cand("th3", "Thrower", 200),
    ];
    const aBids = pickBotBids({ entries: [entry("e1")], candidates, bidsPerEntry: 1 });
    const bBids = pickBotBids({ entries: [entry("e2")], candidates, bidsPerEntry: 1 });
    // Au moins le shuffle / jitter divergent — soit playerId different, soit
    // amount different.
    const aKey = `${aBids[0]?.playerId}:${aBids[0]?.amount}`;
    const bKey = `${bBids[0]?.playerId}:${bBids[0]?.amount}`;
    expect(aKey).not.toBe(bKey);
  });

  it("plusieurs entries : chacune a ses bids distincts", () => {
    const candidates: BotCandidate[] = [
      cand("th1", "Thrower", 300),
      cand("ca1", "Catcher", 250),
      cand("li1", "Lineman", 100),
    ];
    const out = pickBotBids({
      entries: [entry("e1"), entry("e2")],
      candidates,
      bidsPerEntry: 3,
    });
    const eachEntry = new Set(out.map((b) => b.entryId));
    expect(eachEntry).toEqual(new Set(["e1", "e2"]));
    expect(out.length).toBeGreaterThanOrEqual(4); // au moins 2 par entry
  });

  it("bidsPerEntry cap a 15", () => {
    const candidates: BotCandidate[] = Array.from({ length: 25 }, (_, i) =>
      cand(`p${i}`, "Lineman", 50),
    );
    const out = pickBotBids({
      entries: [entry("e1")],
      candidates,
      bidsPerEntry: 100,
    });
    expect(out.length).toBeLessThanOrEqual(15);
  });

  it("remplissage si quotas non saturees (que des Linemen disponibles)", () => {
    const candidates: BotCandidate[] = Array.from({ length: 10 }, (_, i) =>
      cand(`li${i}`, "Lineman", 50),
    );
    const out = pickBotBids({
      entries: [entry("e1")],
      candidates,
      bidsPerEntry: 8,
    });
    expect(out).toHaveLength(8);
    expect(out.every((b) => b.playerId.startsWith("li"))).toBe(true);
  });

  it("0 candidats : 0 bids", () => {
    expect(
      pickBotBids({ entries: [entry("e1")], candidates: [], bidsPerEntry: 5 }),
    ).toEqual([]);
  });

  it("0 entries : 0 bids", () => {
    expect(
      pickBotBids({
        entries: [],
        candidates: [cand("p1", "Thrower", 300)],
        bidsPerEntry: 5,
      }),
    ).toEqual([]);
  });
});

describe("placeBotBidsForSession", () => {
  beforeEach(() => vi.resetAllMocks());

  function mockSessionOpen() {
    vi.mocked(prisma.nflFantasyDraftSession.findUnique).mockResolvedValue({
      id: "s1",
      leagueId: "lg1",
      status: "open",
    } as never);
  }

  it("SESSION_NOT_FOUND si la session n'existe pas", async () => {
    vi.mocked(prisma.nflFantasyDraftSession.findUnique).mockResolvedValue(null);
    await expect(
      placeBotBidsForSession({ sessionId: "missing" }),
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });

  it("SESSION_NOT_OPEN si statut != open", async () => {
    vi.mocked(prisma.nflFantasyDraftSession.findUnique).mockResolvedValue({
      id: "s1",
      leagueId: "lg1",
      status: "resolved",
    } as never);
    await expect(
      placeBotBidsForSession({ sessionId: "s1" }),
    ).rejects.toBeInstanceOf(BotDraftError);
  });

  it("default : ne vise que les entries SANS bid sur la session", async () => {
    mockSessionOpen();
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "eHuman", budgetRemaining: 5000, bids: [], roster: [] },
      { id: "eBot1", budgetRemaining: 5000, bids: [{ id: "b-existing" }], roster: [] },
      { id: "eBot2", budgetRemaining: 5000, bids: [], roster: [] },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "p1", bbPosition: "Thrower", currentValue: 300 },
      { id: "p2", bbPosition: "Lineman", currentValue: 50 },
    ] as never);
    vi.mocked(prisma.nflFantasyDraftBid.upsert).mockImplementation(
      (async () =>
        ({
          createdAt: new Date(0),
          updatedAt: new Date(0),
        }) as never) as never,
    );

    const out = await placeBotBidsForSession({ sessionId: "s1" });
    expect(out.entriesProcessed).toBe(2); // eHuman + eBot2, mais pas eBot1
    // Verifie qu'aucun upsert ne touche eBot1
    const calls = vi.mocked(prisma.nflFantasyDraftBid.upsert).mock.calls;
    const targetedEntries = new Set(
      calls.map((c) => {
        const arg = c[0] as { where: { sessionId_entryId_playerId: { entryId: string } } };
        return arg.where.sessionId_entryId_playerId.entryId;
      }),
    );
    expect(targetedEntries.has("eBot1")).toBe(false);
    expect(targetedEntries.has("eHuman")).toBe(true);
    expect(targetedEntries.has("eBot2")).toBe(true);
  });

  it("entryIds explicite : vise exactement ces entries (meme si elles ont deja bidde)", async () => {
    mockSessionOpen();
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "eA", budgetRemaining: 5000, bids: [{ id: "x" }], roster: [] },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "p1", bbPosition: "Lineman", currentValue: 50 },
    ] as never);
    vi.mocked(prisma.nflFantasyDraftBid.upsert).mockResolvedValue({
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as never);

    const out = await placeBotBidsForSession({
      sessionId: "s1",
      entryIds: ["eA"],
    });
    expect(out.entriesProcessed).toBe(1);
  });

  it("exclut les joueurs deja sur le roster de la league", async () => {
    mockSessionOpen();
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      {
        id: "eA",
        budgetRemaining: 5000,
        bids: [],
        roster: [{ playerId: "pOwned" }],
      },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([
      { playerId: "pOwned" },
    ] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "p1", bbPosition: "Thrower", currentValue: 300 },
    ] as never);
    vi.mocked(prisma.nflFantasyDraftBid.upsert).mockResolvedValue({
      createdAt: new Date(0),
      updatedAt: new Date(0),
    } as never);

    await placeBotBidsForSession({ sessionId: "s1" });
    // pOwned filtre cote query (notIn), et exclusions par roster
    const playerCall = vi.mocked(prisma.nflPlayer.findMany).mock.calls[0]?.[0] as {
      where: { id: { notIn: string[] } };
    };
    expect(playerCall.where.id.notIn).toContain("pOwned");
  });

  it("0 entries cibles : early return sans toucher prisma.upsert", async () => {
    mockSessionOpen();
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "eA", budgetRemaining: 5000, bids: [{ id: "x" }], roster: [] },
    ] as never);
    const out = await placeBotBidsForSession({ sessionId: "s1" });
    expect(out.entriesProcessed).toBe(0);
    expect(out.bidsCreated).toBe(0);
    expect(prisma.nflFantasyDraftBid.upsert).not.toHaveBeenCalled();
  });

  it("compte les bids crees vs mis a jour selon createdAt == updatedAt", async () => {
    mockSessionOpen();
    vi.mocked(prisma.nflFantasyEntry.findMany).mockResolvedValue([
      { id: "eA", budgetRemaining: 5000, bids: [], roster: [] },
    ] as never);
    vi.mocked(prisma.nflFantasyRoster.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.nflPlayer.findMany).mockResolvedValue([
      { id: "p1", bbPosition: "Thrower", currentValue: 300 },
      { id: "p2", bbPosition: "Lineman", currentValue: 50 },
    ] as never);
    vi.mocked(prisma.nflFantasyDraftBid.upsert)
      .mockResolvedValueOnce({
        createdAt: new Date(1000),
        updatedAt: new Date(1000), // created
      } as never)
      .mockResolvedValue({
        createdAt: new Date(1000),
        updatedAt: new Date(2000), // updated (later)
      } as never);

    const out = await placeBotBidsForSession({ sessionId: "s1" });
    expect(out.bidsCreated).toBe(1);
    expect(out.bidsUpdated).toBe(1);
  });
});
