"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ExtendedGameState } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";

// --- Server event payload types ---

export interface StateUpdatedPayload {
  matchId: string;
  gameState: ExtendedGameState;
  move: unknown;
  userId: string;
  timestamp: string;
}

export interface PlayerConnectionPayload {
  matchId: string;
  userId: string;
  connectedSockets: number;
}

export interface MatchEndedPayload {
  matchId: string;
  gameState: ExtendedGameState;
  timestamp: string;
}

export type GameSocketEvents = {
  "game:state-updated": StateUpdatedPayload;
  "game:player-connected": PlayerConnectionPayload;
  "game:player-disconnected": PlayerConnectionPayload;
  "game:match-ended": MatchEndedPayload;
};

// --- Pure factory (testable without React) ---

/**
 * Create a socket.io client connected to the /game namespace.
 * Does NOT auto-connect — the caller must call .connect().
 */
export function createGameSocket(serverUrl: string, authToken: string): Socket {
  return io(`${serverUrl}/game`, {
    auth: { token: `Bearer ${authToken}` },
    transports: ["websocket", "polling"],
    autoConnect: false,
  });
}

/**
 * Typed helper functions around a raw socket for game events.
 */
export function createGameSocketHelpers(socket: Socket) {
  return {
    joinMatch(matchId: string): Promise<{ ok: boolean; error?: string }> {
      return new Promise((resolve) => {
        socket.emit(
          "game:join-match",
          { matchId },
          (response: { ok: boolean; error?: string }) => {
            resolve(response);
          },
        );
      });
    },

    leaveMatch(matchId: string): void {
      socket.emit("game:leave-match", { matchId }, () => {});
    },

    onStateUpdated(handler: (data: StateUpdatedPayload) => void): void {
      socket.on("game:state-updated", handler);
    },

    onPlayerConnected(handler: (data: PlayerConnectionPayload) => void): void {
      socket.on("game:player-connected", handler);
    },

    onPlayerDisconnected(handler: (data: PlayerConnectionPayload) => void): void {
      socket.on("game:player-disconnected", handler);
    },

    onMatchEnded(handler: (data: MatchEndedPayload) => void): void {
      socket.on("game:match-ended", handler);
    },

    cleanup(): void {
      socket.off("game:state-updated");
      socket.off("game:player-connected");
      socket.off("game:player-disconnected");
      socket.off("game:match-ended");
    },
  };
}

// --- React hook ---

export interface UseGameSocketOptions {
  /** Callback when a new game state arrives from the server. */
  onStateUpdate?: (data: StateUpdatedPayload) => void;
  /** Callback when the opponent connects. */
  onPlayerConnected?: (data: PlayerConnectionPayload) => void;
  /** Callback when the opponent disconnects. */
  onPlayerDisconnected?: (data: PlayerConnectionPayload) => void;
  /** Callback when the match ends. */
  onMatchEnded?: (data: MatchEndedPayload) => void;
}

export interface UseGameSocketResult {
  /** Whether the socket is currently connected. */
  connected: boolean;
  /** Whether we have joined the match room successfully. */
  joined: boolean;
  /** Any connection or join error message. */
  error: string | null;
}

/**
 * React hook that manages a WebSocket connection to a match room.
 *
 * - Connects to the /game namespace on mount
 * - Joins the match room via game:join-match
 * - Listens for game state updates, player connections, and match end
 * - Cleans up (leave room + disconnect) on unmount
 */
export function useGameSocket(
  matchId: string,
  options: UseGameSocketOptions = {},
): UseGameSocketResult {
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store callbacks in refs to avoid re-subscribing on every render
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const authToken = localStorage.getItem("auth_token");
    if (!authToken) {
      setError("No auth token found");
      return;
    }

    const socket = createGameSocket(API_BASE, authToken);
    socketRef.current = socket;
    const helpers = createGameSocketHelpers(socket);

    // Connection lifecycle
    socket.on("connect", () => {
      setConnected(true);
      setError(null);

      // Join the match room once connected
      helpers.joinMatch(matchId).then((res) => {
        if (res.ok) {
          setJoined(true);
        } else {
          setError(res.error ?? "Failed to join match room");
        }
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setJoined(false);
    });

    socket.on("connect_error", (err: Error) => {
      setError(err.message);
      setConnected(false);
    });

    // Game event listeners — delegate to callbacks via ref
    helpers.onStateUpdated((data) => {
      optionsRef.current.onStateUpdate?.(data);
    });

    helpers.onPlayerConnected((data) => {
      optionsRef.current.onPlayerConnected?.(data);
    });

    helpers.onPlayerDisconnected((data) => {
      optionsRef.current.onPlayerDisconnected?.(data);
    });

    helpers.onMatchEnded((data) => {
      optionsRef.current.onMatchEnded?.(data);
    });

    // Connect
    socket.connect();

    // Cleanup
    return () => {
      helpers.leaveMatch(matchId);
      helpers.cleanup();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId]);

  return { connected, joined, error };
}
