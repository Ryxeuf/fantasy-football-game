/**
 * Sprint Pro League lot 1.B.1 — Tests du match broadcaster.
 *
 * Couvre :
 *  - subscribeToMatch : match introuvable, status non broadcastable,
 *    replay manquant, fan-out vers N subscribers, catch-up, tick.
 *  - preloadMatch : pré-charge sans subscriber.
 *  - getBroadcasterStats : compteurs activeSessions / totalSubscribers.
 *  - unsubscribe : retire le listener + auto-reap.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compressEvents, type MatchEvent } from "@bb/sim-engine";

vi.mock("../prisma", () => ({
  prisma: {
    proLeagueMatch: {
      findUnique: vi.fn(),
    },
    replay: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "../prisma";

import {
  __resetBroadcasterForTesting,
  getBroadcasterStats,
  preloadMatch,
  subscribeToMatch,
} from "./pro-league-match-broadcaster";

interface MockedPrisma {
  proLeagueMatch: { findUnique: ReturnType<typeof vi.fn> };
  replay: { findUnique: ReturnType<typeof vi.fn> };
}

const mocked = prisma as unknown as MockedPrisma;

const MATCH_ID = "match_xyz";

function makeEvents(): MatchEvent[] {
  return [
    {
      type: "KICKOFF",
      displayAtMs: 0,
      engineVer: "0.13.0",
      seed: 1,
      meta: { home: "h", away: "a" },
    },
    {
      type: "TURN_START",
      displayAtMs: 30_000,
      engineVer: "0.13.0",
      meta: { half: 1, turn: 1, drivingTeam: "home", ballYardline: 4 },
    },
    {
      type: "TD",
      displayAtMs: 60_000,
      engineVer: "0.13.0",
      meta: { team: "home", half: 1, turn: 2 },
    },
  ];
}

async function mockReplay(events: MatchEvent[]): Promise<void> {
  const compressed = await compressEvents(events);
  mocked.replay.findUnique.mockResolvedValue({ payload: compressed });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  __resetBroadcasterForTesting();
});

afterEach(() => {
  __resetBroadcasterForTesting();
});

describe("subscribeToMatch — sprint 1.B.1", () => {
  it("erreur si le match n'existe pas", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue(null);
    await expect(
      subscribeToMatch(MATCH_ID, () => undefined),
    ).rejects.toThrow(/introuvable/);
  });

  it("erreur si status='scheduled' (pas encore simulé)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "scheduled" });
    await expect(
      subscribeToMatch(MATCH_ID, () => undefined),
    ).rejects.toThrow(/scheduled/);
  });

  it("erreur si status='failed'", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "failed" });
    await expect(
      subscribeToMatch(MATCH_ID, () => undefined),
    ).rejects.toThrow(/failed/);
  });

  it("erreur si Replay introuvable", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    mocked.replay.findUnique.mockResolvedValue(null);
    await expect(
      subscribeToMatch(MATCH_ID, () => undefined),
    ).rejects.toThrow(/Replay/);
  });

  it("dispatch immédiat de l'event KICKOFF (displayAtMs=0)", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    await mockReplay(makeEvents());

    vi.useFakeTimers({ now: 1_000_000_000 });
    const received: MatchEvent[] = [];
    const unsubscribe = await subscribeToMatch(MATCH_ID, (ev) =>
      received.push(ev),
    );

    // Premier tick (100ms après création).
    await vi.advanceTimersByTimeAsync(150);

    // KICKOFF (displayAtMs=0) doit être dispatched.
    expect(received).toHaveLength(1);
    expect(received[0].type).toBe("KICKOFF");

    unsubscribe();
  });

  it("dispatch progressif selon displayAtMs", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    await mockReplay(makeEvents());

    vi.useFakeTimers({ now: 1_000_000_000 });
    const received: MatchEvent[] = [];
    const unsubscribe = await subscribeToMatch(MATCH_ID, (ev) =>
      received.push(ev),
    );

    // T+100ms → KICKOFF (displayAtMs=0)
    await vi.advanceTimersByTimeAsync(150);
    expect(received.map((e) => e.type)).toEqual(["KICKOFF"]);

    // T+30s → KICKOFF + TURN_START
    await vi.advanceTimersByTimeAsync(30_000);
    expect(received.map((e) => e.type)).toEqual(["KICKOFF", "TURN_START"]);

    // T+60s → tous
    await vi.advanceTimersByTimeAsync(30_000);
    expect(received.map((e) => e.type)).toEqual([
      "KICKOFF",
      "TURN_START",
      "TD",
    ]);

    unsubscribe();
  });

  it("catch-up : un subscriber qui rejoint après reçoit les events passés en bulk", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    await mockReplay(makeEvents());

    vi.useFakeTimers({ now: 1_000_000_000 });
    const a: MatchEvent[] = [];
    const unsubA = await subscribeToMatch(MATCH_ID, (ev) => a.push(ev));

    // Avance jusqu'à T+30s — A reçoit KICKOFF + TURN_START
    await vi.advanceTimersByTimeAsync(30_500);
    expect(a.map((e) => e.type)).toEqual(["KICKOFF", "TURN_START"]);

    // Subscriber B rejoint maintenant — doit recevoir le catch-up.
    const b: MatchEvent[] = [];
    const unsubB = await subscribeToMatch(MATCH_ID, (ev) => b.push(ev));

    // B reçoit immédiatement les 2 events dispatchés.
    expect(b.map((e) => e.type)).toEqual(["KICKOFF", "TURN_START"]);

    // Avance encore — A et B reçoivent TD.
    await vi.advanceTimersByTimeAsync(30_000);
    expect(a.map((e) => e.type)).toEqual(["KICKOFF", "TURN_START", "TD"]);
    expect(b.map((e) => e.type)).toEqual(["KICKOFF", "TURN_START", "TD"]);

    unsubA();
    unsubB();
  });

  it("fan-out : 3 subscribers reçoivent les mêmes events", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    await mockReplay(makeEvents());

    vi.useFakeTimers({ now: 1_000_000_000 });
    const a: MatchEvent[] = [];
    const b: MatchEvent[] = [];
    const c: MatchEvent[] = [];
    const unA = await subscribeToMatch(MATCH_ID, (ev) => a.push(ev));
    const unB = await subscribeToMatch(MATCH_ID, (ev) => b.push(ev));
    const unC = await subscribeToMatch(MATCH_ID, (ev) => c.push(ev));

    await vi.advanceTimersByTimeAsync(60_500);

    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(c).toHaveLength(3);
    expect(a.map((e) => e.type)).toEqual(b.map((e) => e.type));
    expect(a.map((e) => e.type)).toEqual(c.map((e) => e.type));

    unA();
    unB();
    unC();
  });

  it("unsubscribe coupe les events futurs", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    await mockReplay(makeEvents());

    vi.useFakeTimers({ now: 1_000_000_000 });
    const received: MatchEvent[] = [];
    const unsubscribe = await subscribeToMatch(MATCH_ID, (ev) =>
      received.push(ev),
    );

    await vi.advanceTimersByTimeAsync(150);
    expect(received).toHaveLength(1); // KICKOFF

    unsubscribe();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(received).toHaveLength(1); // pas de nouveaux events
  });
});

describe("preloadMatch — sprint 1.B.1", () => {
  it("crée la session sans subscriber", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    await mockReplay(makeEvents());

    expect(getBroadcasterStats().activeSessions).toBe(0);
    await preloadMatch(MATCH_ID);
    expect(getBroadcasterStats().activeSessions).toBe(1);
    expect(getBroadcasterStats().totalSubscribers).toBe(0);
  });
});

describe("getBroadcasterStats — sprint 1.B.1", () => {
  it("compte sessions et subscribers", async () => {
    mocked.proLeagueMatch.findUnique.mockResolvedValue({ status: "ready" });
    await mockReplay(makeEvents());

    expect(getBroadcasterStats()).toEqual({
      activeSessions: 0,
      totalSubscribers: 0,
    });

    const un1 = await subscribeToMatch(MATCH_ID, () => undefined);
    const un2 = await subscribeToMatch(MATCH_ID, () => undefined);
    expect(getBroadcasterStats()).toEqual({
      activeSessions: 1,
      totalSubscribers: 2,
    });

    un1();
    expect(getBroadcasterStats().totalSubscribers).toBe(1);
    un2();
    expect(getBroadcasterStats().totalSubscribers).toBe(0);
  });
});
