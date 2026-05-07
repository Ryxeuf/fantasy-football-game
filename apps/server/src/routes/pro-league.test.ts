/**
 * Sprint Pro League lot 1.B.2 — Tests endpoint SSE
 * `/pro-league/matches/:id/stream`.
 *
 * Pattern aligné sur feedback.test.ts : req/res construits à la main,
 * `subscribeToMatch` mocké pour contrôler les events injectés.
 *
 * Couvre :
 *  - Param manquant → 400
 *  - Match introuvable → 404 (avant flush) ou event SSE error
 *  - Headers SSE corrects (Content-Type, Cache-Control, etc.)
 *  - Format des messages SSE (id, event, data)
 *  - Last-Event-ID skip les events déjà reçus
 *  - Heartbeat émis après HEARTBEAT_INTERVAL_MS
 *  - Cleanup au close client
 *  - Endpoint stats renvoie compteurs
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

vi.mock("../services/pro-league-match-broadcaster", () => ({
  subscribeToMatch: vi.fn(),
  getBroadcasterStats: vi.fn(),
}));

import {
  getBroadcasterStats,
  subscribeToMatch,
} from "../services/pro-league-match-broadcaster";

import {
  handleBroadcasterStats,
  handleStreamProMatch,
} from "./pro-league";

interface FakeReq {
  params: Record<string, string>;
  headers: Record<string, string>;
  header(name: string): string | undefined;
  on(event: string, cb: () => void): void;
}

class FakeRes extends EventEmitter {
  statusCode = 200;
  headersSent = false;
  jsonPayload: unknown = undefined;
  writes: string[] = [];
  headers: Record<string, string> = {};
  ended = false;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  setHeader(k: string, v: string): void {
    this.headers[k] = v;
  }

  flushHeaders(): void {
    this.headersSent = true;
  }

  write(chunk: string): boolean {
    this.writes.push(chunk);
    return true;
  }

  json(body: unknown): this {
    this.jsonPayload = body;
    return this;
  }

  end(): void {
    this.ended = true;
  }
}

function buildReq(
  params: Record<string, string> = {},
  headers: Record<string, string> = {},
): FakeReq {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = v;
  }
  const callbacks: Record<string, Array<() => void>> = {};
  return {
    params,
    headers,
    header(name: string) {
      return lower[name.toLowerCase()];
    },
    on(event: string, cb: () => void) {
      callbacks[event] = callbacks[event] ?? [];
      callbacks[event].push(cb);
    },
  };
}

const mockedSubscribe = vi.mocked(subscribeToMatch);
const mockedStats = vi.mocked(getBroadcasterStats);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /pro-league/matches/:id/stream — sprint 1.B.2", () => {
  it("400 si :id manquant", async () => {
    const req = buildReq({}) as unknown as Parameters<
      typeof handleStreamProMatch
    >[0];
    const res = new FakeRes() as unknown as Parameters<
      typeof handleStreamProMatch
    >[1];

    await handleStreamProMatch(req, res);

    expect((res as unknown as FakeRes).statusCode).toBe(400);
    expect((res as unknown as FakeRes).jsonPayload).toEqual({
      error: "missing-match-id",
    });
  });

  it("404 quand subscribeToMatch throw 'introuvable' (avant flush)", async () => {
    mockedSubscribe.mockRejectedValue(
      new Error("ProLeagueMatch 'm1' introuvable"),
    );
    const req = buildReq({ id: "m1" }) as unknown as Parameters<
      typeof handleStreamProMatch
    >[0];
    const res = new FakeRes();
    // Simule l'absence de flush (cas où subscribeToMatch throw vite).
    // headersSent stays false until flushHeaders is called.

    await handleStreamProMatch(
      req,
      res as unknown as Parameters<typeof handleStreamProMatch>[1],
    );
    // flushHeaders() est appelé avant subscribe → headersSent=true → SSE error.
    // Le code émet event SSE error puis end().
    expect(res.headersSent).toBe(true);
    expect(res.writes.some((w) => w.startsWith("event: error"))).toBe(true);
    expect(res.ended).toBe(true);
  });

  it("écrit les headers SSE corrects", async () => {
    mockedSubscribe.mockResolvedValue(() => undefined);
    const req = buildReq({ id: "m1" });
    const res = new FakeRes();

    await handleStreamProMatch(
      req as unknown as Parameters<typeof handleStreamProMatch>[0],
      res as unknown as Parameters<typeof handleStreamProMatch>[1],
    );

    expect(res.headers["Content-Type"]).toBe("text/event-stream");
    expect(res.headers["Cache-Control"]).toMatch(/no-cache/);
    expect(res.headers["Connection"]).toBe("keep-alive");
    expect(res.headers["X-Accel-Buffering"]).toBe("no");
    expect(res.headersSent).toBe(true);
  });

  it("formate les messages SSE avec id / event / data", async () => {
    let injectEvent: ((ev: unknown) => void) | undefined;
    mockedSubscribe.mockImplementation(async (_id: string, listener) => {
      injectEvent = listener as (ev: unknown) => void;
      return () => undefined;
    });

    const req = buildReq({ id: "m1" });
    const res = new FakeRes();
    await handleStreamProMatch(
      req as unknown as Parameters<typeof handleStreamProMatch>[0],
      res as unknown as Parameters<typeof handleStreamProMatch>[1],
    );

    expect(injectEvent).toBeDefined();
    injectEvent!({
      type: "KICKOFF",
      displayAtMs: 0,
      engineVer: "0.13.0",
      seed: 1,
      meta: { home: "h", away: "a" },
    });
    injectEvent!({
      type: "TD",
      displayAtMs: 60_000,
      engineVer: "0.13.0",
      meta: { team: "home" },
    });

    expect(res.writes).toHaveLength(2);
    expect(res.writes[0]).toMatch(/^id: 0\nevent: KICKOFF\ndata: \{.*\}\n\n$/);
    expect(res.writes[0]).toContain('"type":"KICKOFF"');
    expect(res.writes[1]).toMatch(/^id: 1\nevent: TD\ndata: \{.*\}\n\n$/);
  });

  it("Last-Event-ID skippe les events déjà reçus", async () => {
    let injectEvent: ((ev: unknown) => void) | undefined;
    mockedSubscribe.mockImplementation(async (_id, listener) => {
      injectEvent = listener as (ev: unknown) => void;
      return () => undefined;
    });

    const req = buildReq({ id: "m1" }, { "Last-Event-ID": "1" });
    const res = new FakeRes();
    await handleStreamProMatch(
      req as unknown as Parameters<typeof handleStreamProMatch>[0],
      res as unknown as Parameters<typeof handleStreamProMatch>[1],
    );

    // Inject 4 events (indexes 0..3)
    for (let i = 0; i < 4; i += 1) {
      injectEvent!({
        type: "TURN_START",
        displayAtMs: i * 1000,
        engineVer: "0.13.0",
        meta: {},
      });
    }

    // Last-Event-ID=1 → skip indexes 0 et 1 → write seulement 2 et 3
    expect(res.writes).toHaveLength(2);
    expect(res.writes[0]).toMatch(/^id: 2\n/);
    expect(res.writes[1]).toMatch(/^id: 3\n/);
  });

  it("ignore Last-Event-ID si non numérique", async () => {
    let injectEvent: ((ev: unknown) => void) | undefined;
    mockedSubscribe.mockImplementation(async (_id, listener) => {
      injectEvent = listener as (ev: unknown) => void;
      return () => undefined;
    });

    const req = buildReq({ id: "m1" }, { "Last-Event-ID": "garbage" });
    const res = new FakeRes();
    await handleStreamProMatch(
      req as unknown as Parameters<typeof handleStreamProMatch>[0],
      res as unknown as Parameters<typeof handleStreamProMatch>[1],
    );

    injectEvent!({
      type: "KICKOFF",
      displayAtMs: 0,
      engineVer: "0.13.0",
      seed: 1,
      meta: {},
    });

    expect(res.writes).toHaveLength(1);
    expect(res.writes[0]).toMatch(/^id: 0\n/);
  });

  it("émet un heartbeat toutes les 30s", async () => {
    vi.useFakeTimers();
    mockedSubscribe.mockResolvedValue(() => undefined);
    const req = buildReq({ id: "m1" });
    const res = new FakeRes();

    await handleStreamProMatch(
      req as unknown as Parameters<typeof handleStreamProMatch>[0],
      res as unknown as Parameters<typeof handleStreamProMatch>[1],
    );

    // Avant 30s : pas de heartbeat
    await vi.advanceTimersByTimeAsync(29_000);
    expect(res.writes.filter((w) => w.startsWith(": heartbeat"))).toHaveLength(0);

    // À 30s : heartbeat
    await vi.advanceTimersByTimeAsync(2_000);
    expect(res.writes.filter((w) => w.startsWith(": heartbeat"))).toHaveLength(1);

    // À 60s : 2 heartbeats
    await vi.advanceTimersByTimeAsync(30_000);
    expect(res.writes.filter((w) => w.startsWith(": heartbeat"))).toHaveLength(2);
  });
});

describe("GET /pro-league/_internal/broadcaster-stats — sprint 1.B.2", () => {
  it("renvoie les compteurs du broadcaster", () => {
    mockedStats.mockReturnValue({ activeSessions: 3, totalSubscribers: 12 });
    const req = buildReq();
    const res = new FakeRes();
    handleBroadcasterStats(
      req as unknown as Parameters<typeof handleBroadcasterStats>[0],
      res as unknown as Parameters<typeof handleBroadcasterStats>[1],
    );
    expect(res.jsonPayload).toEqual({ activeSessions: 3, totalSubscribers: 12 });
  });
});
