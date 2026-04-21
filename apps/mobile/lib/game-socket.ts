// Pure helpers around socket.io-client for the /game namespace.
// Extracted so the logic can be unit-tested in Node without React Native.

import { io, type Socket } from "socket.io-client";
import type { ExtendedGameState, Move } from "@bb/game-engine";

// --- Server -> client event payloads ---

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

// --- Client -> server ack payloads ---

export interface JoinAckPayload {
  ok: boolean;
  error?: string;
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

// --- Factory ---

/**
 * Create a socket.io client configured for the /game namespace.
 * Does NOT auto-connect — the caller must call `.connect()` explicitly.
 */
export function createGameSocket(serverUrl: string, authToken: string): Socket {
  const trimmed = serverUrl.endsWith("/")
    ? serverUrl.slice(0, -1)
    : serverUrl;
  return io(`${trimmed}/game`, {
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

// --- Helpers ---

/**
 * Typed helpers that wrap raw socket.emit/on calls for game events.
 * Callers keep hold of the returned object to subscribe, submit moves,
 * request a resync, and clean up listeners on teardown.
 */
export function createGameSocketHelpers(socket: Socket) {
  return {
    joinMatch(matchId: string): Promise<JoinAckPayload> {
      return new Promise((resolve) => {
        socket.emit("game:join-match", { matchId }, (response: JoinAckPayload) => {
          resolve(response);
        });
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

export type GameSocketHelpers = ReturnType<typeof createGameSocketHelpers>;
