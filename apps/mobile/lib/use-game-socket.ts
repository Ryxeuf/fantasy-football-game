// React hook that manages the /game WebSocket connection for mobile.
// Mirrors apps/web useGameSocket, but reads the auth token via the
// mobile-specific SecureStore-backed helper rather than localStorage.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { Move } from "@bb/game-engine";
import { API_BASE, getToken } from "./api";
import {
  createGameSocket,
  createGameSocketHelpers,
  type GameSocketHelpers,
  type MatchEndedPayload,
  type MatchForfeitedPayload,
  type MoveAckPayload,
  type PlayerConnectionPayload,
  type ResyncPayload,
  type StateUpdatedPayload,
  type TurnTimerStartedPayload,
} from "./game-socket";

export interface UseGameSocketOptions {
  onStateUpdate?: (data: StateUpdatedPayload) => void;
  onPlayerConnected?: (data: PlayerConnectionPayload) => void;
  onPlayerDisconnected?: (data: PlayerConnectionPayload) => void;
  onMatchEnded?: (data: MatchEndedPayload) => void;
  onMatchForfeited?: (data: MatchForfeitedPayload) => void;
  onTurnTimerStarted?: (data: TurnTimerStartedPayload) => void;
  /** Callback when a resync provides a fresh game state after reconnection. */
  onResyncState?: (data: ResyncPayload) => void;
}

export interface UseGameSocketResult {
  connected: boolean;
  joined: boolean;
  error: string | null;
  reconnecting: boolean;
  reconnectAttempt: number;
  /** Submit a move via WebSocket. Returns null if socket is unavailable. */
  submitMove: (move: Move) => Promise<MoveAckPayload | null>;
  socket: Socket | null;
}

/**
 * React hook that connects to the /game namespace, joins the match room,
 * forwards game events to callbacks, and cleans up on unmount.
 *
 * The caller remains responsible for HTTP fallback — if `submitMove`
 * resolves with `null` (socket not ready), submit via REST.
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

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const socketRef = useRef<Socket | null>(null);
  const helpersRef = useRef<GameSocketHelpers | null>(null);

  const submitMove = useCallback(
    async (move: Move): Promise<MoveAckPayload | null> => {
      const helpers = helpersRef.current;
      const socket = socketRef.current;
      if (!helpers || !socket?.connected) return null;
      return helpers.submitMove(matchId, move);
    },
    [matchId],
  );

  useEffect(() => {
    let cancelled = false;
    let cleanupFn: (() => void) | null = null;

    (async () => {
      const token = await getToken();
      if (cancelled) return;
      if (!token) {
        setError("No auth token found");
        return;
      }

      const socket = createGameSocket(API_BASE, token);
      socketRef.current = socket;
      const helpers = createGameSocketHelpers(socket);
      helpersRef.current = helpers;

      const joinAndResync = (isReconnect: boolean) => {
        helpers.joinMatch(matchId).then((res) => {
          if (res.ok) {
            setJoined(true);
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

      socket.on("connect", () => {
        setConnected(true);
        setReconnecting(false);
        setReconnectAttempt(0);
        setError(null);
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

      socket.io.on("reconnect_attempt", (attempt: number) => {
        setReconnecting(true);
        setReconnectAttempt(attempt);
      });

      socket.io.on("reconnect", () => {
        setReconnecting(false);
        setReconnectAttempt(0);
        setError(null);
        joinAndResync(true);
      });

      socket.io.on("reconnect_failed", () => {
        setReconnecting(false);
        setError("Reconnection failed after maximum attempts");
      });

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

      socket.connect();

      cleanupFn = () => {
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
    })();

    return () => {
      cancelled = true;
      if (cleanupFn) cleanupFn();
    };
  }, [matchId]);

  return {
    connected,
    joined,
    error,
    reconnecting,
    reconnectAttempt,
    submitMove,
    socket: socketRef.current,
  };
}
