import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma : we only need user.findUnique for coach names and
// listAcceptedFriendIds is mocked at the friendship layer.
vi.mock("../prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./friendship", () => ({
  listAcceptedFriendIds: vi.fn(),
}));

vi.mock("./push-notifications", () => ({
  sendFriendMatchStartedPush: vi.fn(),
}));

vi.mock("./connected-users", () => ({
  isUserConnectedToMatch: vi.fn(),
}));

vi.mock("../socket", () => ({
  getGameNamespace: vi.fn(),
}));

import { prisma } from "../prisma";
import { listAcceptedFriendIds } from "./friendship";
import { sendFriendMatchStartedPush } from "./push-notifications";
import { isUserConnectedToMatch } from "./connected-users";
import { getGameNamespace } from "../socket";
import { notifyFriendMatchStarted } from "./notify-friend-match-started";

const mockPrisma = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
};
const mockListFriends = listAcceptedFriendIds as unknown as ReturnType<typeof vi.fn>;
const mockSendPush = sendFriendMatchStartedPush as unknown as ReturnType<typeof vi.fn>;
const mockIsConnected = isUserConnectedToMatch as unknown as ReturnType<typeof vi.fn>;
const mockGetNamespace = getGameNamespace as unknown as ReturnType<typeof vi.fn>;

function makeNamespace() {
  const sockets = new Map<string, { data: { user?: { id: string } }; emit: ReturnType<typeof vi.fn> }>();
  return {
    sockets,
    addSocket: (id: string, userId: string) => {
      sockets.set(id, {
        data: { user: { id: userId } },
        emit: vi.fn(),
      });
    },
  };
}

describe("notify-friend-match-started", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends socket event to friends connected via WebSocket and skips push for them", async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "alice") return Promise.resolve({ id: "alice", coachName: "Alice" });
      if (id === "bob") return Promise.resolve({ id: "bob", coachName: "Bob" });
      return Promise.resolve(null);
    });
    mockListFriends.mockImplementation((userId: string) => {
      if (userId === "alice") return Promise.resolve(["carol"]);
      if (userId === "bob") return Promise.resolve([]);
      return Promise.resolve([]);
    });
    mockIsConnected.mockReturnValue(false);

    const ns = makeNamespace();
    ns.addSocket("sock-1", "carol");
    mockGetNamespace.mockReturnValue(ns);

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    expect(result.notifiedViaSocket).toBe(1);
    expect(result.notifiedViaPush).toBe(0);
    expect(ns.sockets.get("sock-1")!.emit).toHaveBeenCalledWith(
      "friend:match-started",
      {
        matchId: "match-1",
        friendCoachName: "Alice",
        opponentCoachName: "Bob",
      },
    );
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("sends push notification when friend is offline", async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "alice") return Promise.resolve({ id: "alice", coachName: "Alice" });
      if (id === "bob") return Promise.resolve({ id: "bob", coachName: "Bob" });
      return Promise.resolve(null);
    });
    mockListFriends.mockImplementation((userId: string) => {
      if (userId === "alice") return Promise.resolve(["carol"]);
      return Promise.resolve([]);
    });
    mockIsConnected.mockReturnValue(false);

    const ns = makeNamespace();
    // carol not connected
    mockGetNamespace.mockReturnValue(ns);

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    expect(result.notifiedViaSocket).toBe(0);
    expect(result.notifiedViaPush).toBe(1);
    expect(mockSendPush).toHaveBeenCalledWith("carol", "match-1", "Alice", "Bob");
  });

  it("skips friends that are already connected to the match (avoid duplicate)", async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "alice") return Promise.resolve({ id: "alice", coachName: "Alice" });
      if (id === "bob") return Promise.resolve({ id: "bob", coachName: "Bob" });
      return Promise.resolve(null);
    });
    mockListFriends.mockImplementation((userId: string) => {
      if (userId === "alice") return Promise.resolve(["carol"]);
      return Promise.resolve([]);
    });
    mockIsConnected.mockImplementation((matchId: string, userId: string) => userId === "carol");
    mockGetNamespace.mockReturnValue(makeNamespace());

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    expect(result.notifiedViaSocket).toBe(0);
    expect(result.notifiedViaPush).toBe(0);
    expect(result.skippedAlreadyInMatch).toBe(1);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("skips notifying the match players themselves even if they appear as friends", async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "alice") return Promise.resolve({ id: "alice", coachName: "Alice" });
      if (id === "bob") return Promise.resolve({ id: "bob", coachName: "Bob" });
      return Promise.resolve(null);
    });
    mockListFriends.mockImplementation((userId: string) => {
      if (userId === "alice") return Promise.resolve(["bob"]); // bob is opponent
      return Promise.resolve([]);
    });
    mockIsConnected.mockReturnValue(false);
    mockGetNamespace.mockReturnValue(makeNamespace());

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    expect(result.notifiedViaSocket).toBe(0);
    expect(result.notifiedViaPush).toBe(0);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("dedupes friends that are mutual to both players (only one notification)", async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "alice") return Promise.resolve({ id: "alice", coachName: "Alice" });
      if (id === "bob") return Promise.resolve({ id: "bob", coachName: "Bob" });
      return Promise.resolve(null);
    });
    mockListFriends.mockImplementation((userId: string) => {
      if (userId === "alice") return Promise.resolve(["dave"]);
      if (userId === "bob") return Promise.resolve(["dave"]);
      return Promise.resolve([]);
    });
    mockIsConnected.mockReturnValue(false);
    mockGetNamespace.mockReturnValue(makeNamespace());

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    expect(result.notifiedViaPush).toBe(1);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    // The body should still mention Alice vs Bob (using the first player as 'friend' is fine
    // since Dave knows both). For consistency, we expect Alice vs Bob.
    expect(mockSendPush).toHaveBeenCalledWith("dave", "match-1", "Alice", "Bob");
  });

  it("returns early with all zeros when no friends to notify", async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "alice") return Promise.resolve({ id: "alice", coachName: "Alice" });
      if (id === "bob") return Promise.resolve({ id: "bob", coachName: "Bob" });
      return Promise.resolve(null);
    });
    mockListFriends.mockResolvedValue([]);

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    expect(result).toEqual({
      notifiedViaSocket: 0,
      notifiedViaPush: 0,
      skippedAlreadyInMatch: 0,
    });
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("returns zeros and does not throw when one of the coach names is missing", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockListFriends.mockResolvedValue(["dave"]);

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    expect(result.notifiedViaSocket).toBe(0);
    expect(result.notifiedViaPush).toBe(0);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it("does not throw when the socket namespace is unavailable", async () => {
    mockPrisma.user.findUnique.mockImplementation(({ where: { id } }: { where: { id: string } }) => {
      if (id === "alice") return Promise.resolve({ id: "alice", coachName: "Alice" });
      if (id === "bob") return Promise.resolve({ id: "bob", coachName: "Bob" });
      return Promise.resolve(null);
    });
    mockListFriends.mockImplementation((userId: string) => {
      if (userId === "alice") return Promise.resolve(["carol"]);
      return Promise.resolve([]);
    });
    mockIsConnected.mockReturnValue(false);
    mockGetNamespace.mockImplementation(() => {
      throw new Error("socket.io not initialized");
    });

    const result = await notifyFriendMatchStarted("match-1", ["alice", "bob"]);

    // Falls back to push when no socket.io
    expect(result.notifiedViaPush).toBe(1);
    expect(mockSendPush).toHaveBeenCalledWith("carol", "match-1", "Alice", "Bob");
  });

  it("returns zeros immediately when fewer than 2 player ids are provided", async () => {
    const result = await notifyFriendMatchStarted("match-1", ["alice"]);
    expect(result).toEqual({
      notifiedViaSocket: 0,
      notifiedViaPush: 0,
      skippedAlreadyInMatch: 0,
    });
    expect(mockListFriends).not.toHaveBeenCalled();
  });
});
