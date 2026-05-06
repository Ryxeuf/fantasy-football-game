/**
 * Sprint Pro League lot 1.B.4 — Tests du hook
 * `useProLeagueMatchStream`.
 *
 * Mocke `EventSource` globalement pour pouvoir simuler les events
 * SSE dans jsdom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import type { MatchEvent } from "@bb/shared-types";

import { useProLeagueMatchStream } from "./use-pro-league-match-stream";

interface MockEventSourceInstance {
  url: string;
  readyState: number;
  close: ReturnType<typeof vi.fn>;
  onopen: ((ev: Event) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  listeners: Map<string, EventListener[]>;
  emitTyped(type: string, data: unknown): void;
  triggerOpen(): void;
  triggerError(): void;
}

function makeMockEventSource(): {
  ctor: new (url: string) => MockEventSourceInstance;
  instances: MockEventSourceInstance[];
} {
  const instances: MockEventSourceInstance[] = [];
  const ctor = function (this: MockEventSourceInstance, url: string) {
    this.url = url;
    this.readyState = 0;
    this.close = vi.fn();
    this.onopen = null;
    this.onerror = null;
    this.onmessage = null;
    this.listeners = new Map();
    this.emitTyped = (type: string, data: unknown): void => {
      const ev = {
        data: typeof data === "string" ? data : JSON.stringify(data),
      } as MessageEvent;
      const ls = this.listeners.get(type) ?? [];
      for (const l of ls) l(ev);
    };
    this.triggerOpen = (): void => {
      if (this.onopen) this.onopen({} as Event);
    };
    this.triggerError = (): void => {
      if (this.onerror) this.onerror({} as Event);
    };
    instances.push(this);
  } as unknown as new (url: string) => MockEventSourceInstance;
  Object.defineProperty(ctor.prototype, "addEventListener", {
    value(this: MockEventSourceInstance, type: string, listener: EventListener) {
      const ls = this.listeners.get(type) ?? [];
      ls.push(listener);
      this.listeners.set(type, ls);
    },
  });
  return { ctor, instances };
}

let originalEventSource: typeof globalThis.EventSource | undefined;
let mock: ReturnType<typeof makeMockEventSource>;

beforeEach(() => {
  mock = makeMockEventSource();
  originalEventSource = (globalThis as { EventSource?: typeof EventSource })
    .EventSource;
  (globalThis as { EventSource?: unknown }).EventSource = mock.ctor;
});

afterEach(() => {
  (globalThis as { EventSource?: unknown }).EventSource = originalEventSource;
});

describe("useProLeagueMatchStream — sprint 1.B.4", () => {
  it("ne crée pas de connexion si matchId est null", () => {
    const { result } = renderHook(() => useProLeagueMatchStream(null));
    expect(mock.instances).toHaveLength(0);
    expect(result.current.connectionState).toBe("closed");
    expect(result.current.events).toEqual([]);
  });

  it("crée une EventSource avec l'URL attendue", () => {
    renderHook(() => useProLeagueMatchStream("match_abc"));
    expect(mock.instances).toHaveLength(1);
    expect(mock.instances[0].url).toContain(
      "/pro-league/matches/match_abc/stream",
    );
  });

  it("connectionState=open après onopen", () => {
    const { result } = renderHook(() =>
      useProLeagueMatchStream("match_abc"),
    );
    act(() => {
      mock.instances[0].triggerOpen();
    });
    expect(result.current.connectionState).toBe("open");
  });

  it("accumule les events typed received", () => {
    const { result } = renderHook(() =>
      useProLeagueMatchStream("match_abc"),
    );

    const e1: MatchEvent = {
      type: "KICKOFF",
      displayAtMs: 0,
      engineVer: "0.13.0",
      seed: 1,
      meta: { home: "h", away: "a" },
    };
    const e2: MatchEvent = {
      type: "TURN_START",
      displayAtMs: 30_000,
      engineVer: "0.13.0",
      meta: { half: 1, turn: 1, drivingTeam: "home", ballYardline: 4 },
    };

    act(() => {
      mock.instances[0].emitTyped("KICKOFF", e1);
      mock.instances[0].emitTyped("TURN_START", e2);
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0].type).toBe("KICKOFF");
    expect(result.current.events[1].type).toBe("TURN_START");
  });

  it("ferme la connexion quand un event END est reçu", () => {
    const { result } = renderHook(() =>
      useProLeagueMatchStream("match_abc"),
    );
    const endEv: MatchEvent = {
      type: "END",
      displayAtMs: 480_000,
      engineVer: "0.13.0",
      meta: { score: { home: 2, away: 1 } },
    };
    act(() => {
      mock.instances[0].emitTyped("END", endEv);
    });
    expect(result.current.connectionState).toBe("closed");
    expect(mock.instances[0].close).toHaveBeenCalled();
  });

  it("connectionState=error sur onerror", () => {
    const { result } = renderHook(() =>
      useProLeagueMatchStream("match_abc"),
    );
    act(() => {
      mock.instances[0].triggerError();
    });
    expect(result.current.connectionState).toBe("error");
  });

  it("expose error string si JSON.parse fail", () => {
    const { result } = renderHook(() =>
      useProLeagueMatchStream("match_abc"),
    );
    act(() => {
      mock.instances[0].emitTyped("KICKOFF", "not-valid-json{{{");
    });
    expect(result.current.error).toBeTruthy();
  });

  it("ferme la connexion à l'unmount", () => {
    const { unmount } = renderHook(() =>
      useProLeagueMatchStream("match_abc"),
    );
    expect(mock.instances[0].close).not.toHaveBeenCalled();
    unmount();
    expect(mock.instances[0].close).toHaveBeenCalled();
  });
});
