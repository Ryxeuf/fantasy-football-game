import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock socket.io-client before any import that uses it
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  io: {
    on: vi.fn(),
    off: vi.fn(),
  },
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

import { renderHook, act } from "@testing-library/react";
import { useSpectatorSocket } from "./useSpectatorSocket";

describe("useSpectatorSocket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("test-auth-token");
    mockSocket.connected = false;
  });

  it("returns initial disconnected state", () => {
    const { result } = renderHook(() => useSpectatorSocket("match-123"));

    expect(result.current.connected).toBe(false);
    expect(result.current.joined).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.spectatorCount).toBe(0);
  });

  it("sets error when no auth token found", () => {
    localStorageMock.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useSpectatorSocket("match-123"));

    expect(result.current.error).toBe("No auth token found");
    expect(result.current.connected).toBe(false);
  });

  it("emits game:spectate-match on connect", () => {
    renderHook(() => useSpectatorSocket("match-123"));

    // Extract the connect handler
    const connectCall = mockSocket.on.mock.calls.find(
      (args: unknown[]) => args[0] === "connect",
    );
    expect(connectCall).toBeDefined();

    // Simulate connect
    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (connectCall as any)[1]();
    });

    // Should emit spectate-match
    const emitCall = mockSocket.emit.mock.calls.find(
      (args: unknown[]) => args[0] === "game:spectate-match",
    );
    expect(emitCall).toBeDefined();
    expect((emitCall as unknown[])[1]).toEqual({ matchId: "match-123" });
  });

  it("emits game:leave-spectate on unmount", () => {
    const { unmount } = renderHook(() => useSpectatorSocket("match-123"));

    unmount();

    const leaveCall = mockSocket.emit.mock.calls.find(
      (args: unknown[]) => args[0] === "game:leave-spectate",
    );
    expect(leaveCall).toBeDefined();
    expect((leaveCall as unknown[])[1]).toEqual({ matchId: "match-123" });
  });

  it("does not expose submitMove", () => {
    const { result } = renderHook(() => useSpectatorSocket("match-123"));

    // Spectator hook should NOT have submitMove
    expect((result.current as any).submitMove).toBeUndefined();
  });
});
