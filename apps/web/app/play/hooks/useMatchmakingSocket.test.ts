import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// --- Mock socket.io-client ---
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: "test-socket-id",
  io: {
    on: vi.fn(),
    off: vi.fn(),
  },
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

import { io } from "socket.io-client";
import {
  useMatchmakingSocket,
  playMatchFoundSound,
} from "./useMatchmakingSocket";

describe("useMatchmakingSocket", () => {
  let originalNotification: typeof globalThis.Notification;
  let originalAudioContext: typeof globalThis.AudioContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.connect.mockReset();
    mockSocket.disconnect.mockReset();
    mockSocket.io.on.mockReset();
    mockSocket.io.off.mockReset();

    // Mock localStorage
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => {
        if (key === "auth_token") return "test-jwt-token";
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });

    // Mock Notification API
    originalNotification = globalThis.Notification;
    const MockNotification = vi.fn() as unknown as typeof Notification;
    Object.defineProperty(MockNotification, "permission", {
      get: () => "granted",
      configurable: true,
    });
    MockNotification.requestPermission = vi.fn().mockResolvedValue("granted");
    globalThis.Notification = MockNotification;

    // Mock AudioContext
    originalAudioContext = globalThis.AudioContext;
    const mockOscillator = {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      destination: {},
      currentTime: 0,
    })) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Notification = originalNotification;
    globalThis.AudioContext = originalAudioContext;
  });

  describe("connection lifecycle", () => {
    it("connects to /game namespace when searching is true", () => {
      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      expect(io).toHaveBeenCalledWith(
        expect.stringContaining("/game"),
        expect.objectContaining({
          auth: { token: "Bearer test-jwt-token" },
          transports: ["websocket", "polling"],
          autoConnect: false,
        }),
      );
      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it("does not connect when searching is false", () => {
      renderHook(() =>
        useMatchmakingSocket({ searching: false, onMatchFound: vi.fn() }),
      );

      expect(io).not.toHaveBeenCalled();
      expect(mockSocket.connect).not.toHaveBeenCalled();
    });

    it("disconnects when searching becomes false", () => {
      const { rerender } = renderHook(
        ({ searching }) =>
          useMatchmakingSocket({ searching, onMatchFound: vi.fn() }),
        { initialProps: { searching: true } },
      );

      rerender({ searching: false });

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("disconnects on unmount", () => {
      const { unmount } = renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it("does not connect when no auth token is available", () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);

      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      expect(io).not.toHaveBeenCalled();
    });
  });

  describe("matchmaking:found event", () => {
    it("listens for matchmaking:found event", () => {
      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      expect(mockSocket.on).toHaveBeenCalledWith(
        "matchmaking:found",
        expect.any(Function),
      );
    });

    it("calls onMatchFound callback when event is received", () => {
      const onMatchFound = vi.fn();
      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound }),
      );

      // Find the matchmaking:found handler and call it
      const foundCall = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === "matchmaking:found",
      );
      expect(foundCall).toBeDefined();

      const handler = foundCall![1] as (data: { matchId: string }) => void;
      act(() => {
        handler({ matchId: "match-abc-123" });
      });

      expect(onMatchFound).toHaveBeenCalledWith("match-abc-123");
    });

    it("calls onNotify callback when match is found", () => {
      const onNotify = vi.fn();
      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn(), onNotify }),
      );

      const foundCall = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === "matchmaking:found",
      );
      const handler = foundCall![1] as (data: { matchId: string }) => void;
      act(() => {
        handler({ matchId: "match-abc-123" });
      });

      expect(onNotify).toHaveBeenCalledWith(
        expect.stringContaining("Match"),
        expect.any(String),
      );
    });

    it("shows browser notification when match is found", () => {
      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      const foundCall = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === "matchmaking:found",
      );
      const handler = foundCall![1] as (data: { matchId: string }) => void;
      act(() => {
        handler({ matchId: "match-abc-123" });
      });

      expect(globalThis.Notification).toHaveBeenCalledWith(
        "Nuffle Arena",
        expect.objectContaining({
          body: expect.any(String),
        }),
      );
    });

    it("plays sound when match is found", () => {
      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      const foundCall = mockSocket.on.mock.calls.find(
        (call: unknown[]) => call[0] === "matchmaking:found",
      );
      const handler = foundCall![1] as (data: { matchId: string }) => void;
      act(() => {
        handler({ matchId: "match-abc-123" });
      });

      expect(globalThis.AudioContext).toHaveBeenCalled();
    });

    it("cleans up matchmaking:found listener on disconnect", () => {
      const { unmount } = renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      unmount();

      expect(mockSocket.off).toHaveBeenCalledWith("matchmaking:found");
    });
  });

  describe("request notification permission", () => {
    it("requests browser notification permission on mount when searching", () => {
      Object.defineProperty(globalThis.Notification, "permission", {
        get: () => "default",
        configurable: true,
      });

      renderHook(() =>
        useMatchmakingSocket({ searching: true, onMatchFound: vi.fn() }),
      );

      expect(Notification.requestPermission).toHaveBeenCalled();
    });
  });
});

describe("playMatchFoundSound", () => {
  let originalAudioContext: typeof globalThis.AudioContext;

  beforeEach(() => {
    originalAudioContext = globalThis.AudioContext;
    const mockOscillator = {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    globalThis.AudioContext = vi.fn().mockImplementation(() => ({
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      destination: {},
      currentTime: 0,
    })) as unknown as typeof AudioContext;
  });

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
  });

  it("creates an AudioContext and plays tones", () => {
    playMatchFoundSound();
    expect(globalThis.AudioContext).toHaveBeenCalled();
  });

  it("does not throw when AudioContext is unavailable", () => {
    globalThis.AudioContext = undefined as unknown as typeof AudioContext;
    expect(() => playMatchFoundSound()).not.toThrow();
  });
});
