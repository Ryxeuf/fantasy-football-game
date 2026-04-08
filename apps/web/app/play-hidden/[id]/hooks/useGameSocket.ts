"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ExtendedGameState, Move, InducementSelection } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";
import { submitMoveWithFallback } from "./submitMoveWithFallback";

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

export interface MatchForfeitedPayload {
  matchId: string;
  forfeitingUserId: string;
  gameState: ExtendedGameState;
  timestamp: string;
}

export interface TurnTimerStartedPayload {
  matchId: string;
  deadline: number;
  turnTimerSeconds: number;
  timestamp: string;
}

export interface MoveAckPayload {
  success: boolean;
  gameState?: ExtendedGameState;
  isMyTurn?: boolean;
  moveCount?: number;
  error?: string;
  code?: string;
}

export interface ResyncPayload {
  success: boolean;
  gameState?: ExtendedGameState;
  matchId?: string;
  error?: string;
}

export type GameSocketEvents = {
  "game:state-updated": StateUpdatedPayload;
  "game:player-connected": PlayerConnectionPayload;
  "game:player-disconnected": PlayerConnectionPayload;
  "game:match-ended": MatchEndedPayload;
  "game:match-forfeited": MatchForfeitedPayload;
  "game:turn-timer-started": TurnTimerStartedPayload;
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
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: 15,
    randomizationFactor: 0.3,
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

    onMatchForfeited(handler: (data: MatchForfeitedPayload) => void): void {
      socket.on("game:match-forfeited", handler);
    },

    onTurnTimerStarted(handler: (data: TurnTimerStartedPayload) => void): void {
      socket.on("game:turn-timer-started", handler);
    },

    submitMove(matchId: string, move: Move): Promise<MoveAckPayload> {
      return new Promise((resolve) => {
        socket.emit(
          "game:submit-move",
          { matchId, move },
          (response: MoveAckPayload) => {
            resolve(response);
          },
        );
      });
    },

    submitInducements(
      matchId: string,
      selection: InducementSelection,
    ): Promise<{ success: boolean; status?: string; error?: string }> {
      return new Promise((resolve) => {
        socket.emit(
          "game:submit-inducements",
          { matchId, selection },
          (response: { success: boolean; status?: string; error?: string }) => {
            resolve(response);
          },
        );
      });
    },

    requestResync(matchId: string): Promise<ResyncPayload> {
      return new Promise((resolve) => {
        socket.emit(
          "game:request-resync",
          { matchId },
          (response: ResyncPayload) => {
            resolve(response);
          },
        );
      });
    },

    cleanup(): void {
      socket.off("game:state-updated");
      socket.off("game:player-connected");
      socket.off("game:player-disconnected");
      socket.off("game:match-ended");
      socket.off("game:match-forfeited");
      socket.off("game:turn-timer-started");
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
  /** Callback when the match is forfeited due to opponent disconnection. */
  onMatchForfeited?: (data: MatchForfeitedPayload) => void;
  /** Callback when a resync provides a fresh game state after reconnection. */
  onResyncState?: (data: ResyncPayload) => void;
  /** Callback when the server sends turn timer info. */
  onTurnTimerStarted?: (data: TurnTimerStartedPayload) => void;
}

export interface UseGameSocketResult {
  /** Whether the socket is currently connected. */
  connected: boolean;
  /** Whether we have joined the match room successfully. */
  joined: boolean;
  /** Any connection or join error message. */
  error: string | null;
  /** Whether the socket is currently attempting to reconnect. */
  reconnecting: boolean;
  /** Current reconnection attempt number (0 when connected). */
  reconnectAttempt: number;
  /** Submit a move via WebSocket, with automatic HTTP fallback if WS is unavailable. */
  submitMove: (move: Move) => Promise<MoveAckPayload | null>;
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
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  // Store callbacks in refs to avoid re-subscribing on every render
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const socketRef = useRef<Socket | null>(null);
  const helpersRef = useRef<ReturnType<typeof createGameSocketHelpers> | null>(null);

  const submitMove = useCallback(
    async (move: Move): Promise<MoveAckPayload | null> => {
      const wsConnected = !!socketRef.current?.connected && !!helpersRef.current;
      const wsSubmit = helpersRef.current
        ? helpersRef.current.submitMove.bind(helpersRef.current)
        : async () => null;

      return submitMoveWithFallback({
        matchId,
        move,
        apiBase: API_BASE,
        wsConnected,
        wsSubmit,
      });
    },
    [matchId],
  );

  useEffect(() => {
    const authToken = localStorage.getItem("auth_token");
    if (!authToken) {
      setError("No auth token found");
      return;
    }

    const socket = createGameSocket(API_BASE, authToken);
    socketRef.current = socket;
    const helpers = createGameSocketHelpers(socket);
    helpersRef.current = helpers;

    /** Join the match room and optionally request a state resync. */
    const joinAndResync = (isReconnect: boolean) => {
      helpers.joinMatch(matchId).then((res) => {
        if (res.ok) {
          setJoined(true);
          // After a reconnect, request the latest gameState to catch up
          if (isReconnect) {
            helpers.requestResync(matchId).then((resyncRes) => {
              optionsRef.current.onResyncState?.(resyncRes);
            });
          }
        } else {
          setError(res.error ?? "Failed to join match room");
        }
      });
    };

    // Connection lifecycle
    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      setReconnectAttempt(0);
      setError(null);

      // Join the match room on first connect
      joinAndResync(false);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setJoined(false);
    });

    socket.on("connect_error", (err: Error) => {
      setError(err.message);
      setConnected(false);
    });

    // Reconnection events (on the Manager instance — socket.io)
    socket.io.on("reconnect_attempt", (attempt: number) => {
      setReconnecting(true);
      setReconnectAttempt(attempt);
    });

    socket.io.on("reconnect", () => {
      setReconnecting(false);
      setReconnectAttempt(0);
      setError(null);
      // Re-join the room and resync state after successful reconnect
      joinAndResync(true);
    });

    socket.io.on("reconnect_failed", () => {
      setReconnecting(false);
      setError("Reconnection failed after maximum attempts");
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

    helpers.onMatchForfeited((data) => {
      optionsRef.current.onMatchForfeited?.(data);
    });

    helpers.onTurnTimerStarted((data) => {
      optionsRef.current.onTurnTimerStarted?.(data);
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
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect");
      socket.io.off("reconnect_failed");
      socket.disconnect();
      helpersRef.current = null;
      socketRef.current = null;
    };
  }, [matchId]);

  return { connected, joined, error, reconnecting, reconnectAttempt, submitMove };
}
