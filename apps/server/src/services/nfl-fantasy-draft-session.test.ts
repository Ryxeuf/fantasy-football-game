import { describe, expect, it } from "vitest";

import {
  computeBasePrice,
  resolveSessionBids,
  type BidInput,
  type EntryInput,
} from "./nfl-fantasy-draft-session";

describe("computeBasePrice", () => {
  it("plafonne a 50 TV pour un joueur sans stats", () => {
    expect(computeBasePrice(0)).toBe(50);
    expect(computeBasePrice(-5)).toBe(50);
  });

  it("linearise sur la plage SPP 10-300", () => {
    expect(computeBasePrice(10)).toBe(50); // 50, clamp plancher
    expect(computeBasePrice(20)).toBe(100);
    expect(computeBasePrice(100)).toBe(500);
    expect(computeBasePrice(200)).toBe(1000);
  });

  it("plafonne a 1500 TV au-dela de 300 SPP", () => {
    expect(computeBasePrice(300)).toBe(1500);
    expect(computeBasePrice(500)).toBe(1500);
    expect(computeBasePrice(9999)).toBe(1500);
  });

  it("arrondit les valeurs fractionnaires", () => {
    expect(computeBasePrice(20.4)).toBe(102);
    expect(computeBasePrice(20.6)).toBe(103);
  });
});

describe("resolveSessionBids", () => {
  function bid(
    bidId: string,
    entryId: string,
    playerId: string,
    amount: number,
  ): BidInput {
    return { bidId, entryId, playerId, amount };
  }

  function entry(
    entryId: string,
    rosterSize: number,
    budgetRemaining: number,
  ): EntryInput {
    return { entryId, rosterSize, budgetRemaining };
  }

  it("retourne tableau vide si aucun bid", () => {
    const out = resolveSessionBids({ bids: [], entries: [] });
    expect(out).toEqual([]);
  });

  it("bid solo : winner = unique bidder, pas de losers", () => {
    const out = resolveSessionBids({
      bids: [bid("b1", "A", "P1", 100)],
      entries: [entry("A", 0, 5000)],
    });
    expect(out).toEqual([
      {
        playerId: "P1",
        winnerBidId: "b1",
        winnerEntryId: "A",
        winnerAmount: 100,
        loserBidIds: [],
      },
    ]);
  });

  it("le plus haut bid l'emporte sur le meme player", () => {
    const out = resolveSessionBids({
      bids: [
        bid("b1", "A", "P1", 100),
        bid("b2", "B", "P1", 250),
        bid("b3", "C", "P1", 150),
      ],
      entries: [entry("A", 0, 5000), entry("B", 0, 5000), entry("C", 0, 5000)],
    });
    expect(out[0].winnerBidId).toBe("b2");
    expect(out[0].winnerEntryId).toBe("B");
    expect(out[0].loserBidIds).toEqual(expect.arrayContaining(["b1", "b3"]));
    expect(out[0].loserBidIds).toHaveLength(2);
  });

  it("tiebreaker amount egal : roster le plus petit gagne", () => {
    const out = resolveSessionBids({
      bids: [bid("b1", "A", "P1", 200), bid("b2", "B", "P1", 200)],
      entries: [entry("A", 5, 5000), entry("B", 2, 5000)],
    });
    expect(out[0].winnerEntryId).toBe("B"); // plus petit roster
  });

  it("tiebreaker amount + roster egaux : budget plus petit gagne", () => {
    const out = resolveSessionBids({
      bids: [bid("b1", "A", "P1", 200), bid("b2", "B", "P1", 200)],
      entries: [entry("A", 3, 4500), entry("B", 3, 3000)],
    });
    expect(out[0].winnerEntryId).toBe("B"); // plus petit budget
  });

  it("tiebreaker complet egal : entryId asc deterministe", () => {
    const out = resolveSessionBids({
      bids: [bid("b1", "Z", "P1", 200), bid("b2", "A", "P1", 200)],
      entries: [entry("Z", 3, 5000), entry("A", 3, 5000)],
    });
    expect(out[0].winnerEntryId).toBe("A"); // entryId asc
  });

  it("plusieurs players resolus independamment", () => {
    const out = resolveSessionBids({
      bids: [
        bid("b1", "A", "P1", 100),
        bid("b2", "B", "P1", 200),
        bid("b3", "A", "P2", 500),
      ],
      entries: [entry("A", 0, 5000), entry("B", 0, 5000)],
    });
    expect(out).toHaveLength(2);
    const p1 = out.find((o) => o.playerId === "P1")!;
    const p2 = out.find((o) => o.playerId === "P2")!;
    expect(p1.winnerEntryId).toBe("B");
    expect(p2.winnerEntryId).toBe("A");
  });

  it("output trie deterministe par playerId asc", () => {
    const out = resolveSessionBids({
      bids: [
        bid("b1", "A", "Z9", 100),
        bid("b2", "A", "A1", 100),
        bid("b3", "A", "M5", 100),
      ],
      entries: [entry("A", 0, 5000)],
    });
    expect(out.map((o) => o.playerId)).toEqual(["A1", "M5", "Z9"]);
  });
});
