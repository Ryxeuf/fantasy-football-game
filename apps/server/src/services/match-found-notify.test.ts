import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock socket.io namespace
vi.mock("../socket", () => ({
  getGameNamespace: vi.fn(),
}));

// Mock push notifications
vi.mock("./push-notifications", () => ({
  sendMatchFoundPush: vi.fn(),
}));

import { getGameNamespace } from "../socket";
import { sendMatchFoundPush } from "./push-notifications";
import { notifyMatchFound } from "./match-found-notify";

describe("Rule: Smart match-found push delivery (G.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends WebSocket event when user is connected, skips push", () => {
    const mockEmit = vi.fn();
    const mockSockets = new Map([
      [
        "socket-1",
        { data: { user: { id: "user-opp" } }, emit: mockEmit },
      ],
    ]);
    vi.mocked(getGameNamespace).mockReturnValue({
      sockets: mockSockets,
    } as any);

    const result = notifyMatchFound("user-opp", "match-123");

    expect(result).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith("matchmaking:found", {
      matchId: "match-123",
    });
    expect(sendMatchFoundPush).not.toHaveBeenCalled();
  });

  it("sends push notification when user is NOT connected via WebSocket", () => {
    const mockSockets = new Map();
    vi.mocked(getGameNamespace).mockReturnValue({
      sockets: mockSockets,
    } as any);

    const result = notifyMatchFound("user-opp", "match-123");

    expect(result).toBe(false);
    expect(sendMatchFoundPush).toHaveBeenCalledWith("user-opp", "match-123");
  });

  it("sends push when socket.io is not initialized", () => {
    vi.mocked(getGameNamespace).mockImplementation(() => {
      throw new Error("not initialized");
    });

    const result = notifyMatchFound("user-opp", "match-123");

    expect(result).toBe(false);
    expect(sendMatchFoundPush).toHaveBeenCalledWith("user-opp", "match-123");
  });

  it("emits to ALL sockets of the user (multi-tab)", () => {
    const emit1 = vi.fn();
    const emit2 = vi.fn();
    const emitOther = vi.fn();
    const mockSockets = new Map([
      [
        "socket-1",
        { data: { user: { id: "user-opp" } }, emit: emit1 },
      ],
      [
        "socket-2",
        { data: { user: { id: "user-opp" } }, emit: emit2 },
      ],
      [
        "socket-3",
        { data: { user: { id: "other-user" } }, emit: emitOther },
      ],
    ]);
    vi.mocked(getGameNamespace).mockReturnValue({
      sockets: mockSockets,
    } as any);

    const result = notifyMatchFound("user-opp", "match-123");

    expect(result).toBe(true);
    expect(emit1).toHaveBeenCalledWith("matchmaking:found", {
      matchId: "match-123",
    });
    expect(emit2).toHaveBeenCalledWith("matchmaking:found", {
      matchId: "match-123",
    });
    expect(emitOther).not.toHaveBeenCalled();
    expect(sendMatchFoundPush).not.toHaveBeenCalled();
  });

  it("does not emit to sockets of other users, sends push instead", () => {
    const emitOther = vi.fn();
    const mockSockets = new Map([
      [
        "socket-1",
        { data: { user: { id: "other-user" } }, emit: emitOther },
      ],
    ]);
    vi.mocked(getGameNamespace).mockReturnValue({
      sockets: mockSockets,
    } as any);

    const result = notifyMatchFound("user-opp", "match-123");

    expect(result).toBe(false);
    expect(emitOther).not.toHaveBeenCalled();
    expect(sendMatchFoundPush).toHaveBeenCalledWith("user-opp", "match-123");
  });
});
