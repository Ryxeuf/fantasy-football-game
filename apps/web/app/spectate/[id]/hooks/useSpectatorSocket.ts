"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import type { ExtendedGameState } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";
import {
  createGameSocket,
  createGameSocketHelpers,
  type StateUpdatedPayload,
  type MatchEndedPayload,
  type MatchForfeitedPayload,
  type TurnTimerStartedPayload,
  type ResyncPayload,
} from "../../../play-hidden/[id]/hooks/useGameSocket";

export interface SpectatorCountPayload {
  matchId: string;
  spectatorCount: number;
}

export interface UseSpectatorSocketOptions {
  onStateUpdate?: (data: StateUpdatedPayload) => void;
  onMatchEnded?: (data: MatchEndedPayload) => void;
  onMatchForfeited?: (data: MatchForfeitedPayload) => void;
  onResyncState?: (data: ResyncPayload) => void;
  onTurnTimerStarted?: (data: TurnTimerStartedPayload) => void;
  onSpectatorCount?: (data: SpectatorCountPayload) => void;
}

export interface UseSpectatorSocketResult {
  connected: boolean;
  joined: boolean;
  error: string | null;
  reconnecting: boolean;
  spectatorCount: number;
}

/**
 * React hook for spectator WebSocket connection.
 * Joins match room as spectator (read-only — no move submission).
 */
export function useSpectatorSocket(
  matchId: string,
  options: UseSpectatorSocketOptions = {},
): UseSpectatorSocketResult {
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);

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

    const joinAsSpectator = (isReconnect: boolean) => {
      socket.emit(
        "game:spectate-match",
        { matchId },
        (response: { ok: boolean; error?: string }) => {
          if (response.ok) {
            setJoined(true);
            if (isReconnect) {
              helpers.requestResync(matchId).then((resyncRes) => {
                optionsRef.current.onResyncState?.(resyncRes);
              });
            }
          } else {
            setError(response.error ?? "Failed to join as spectator");
          }
        },
      );
    };

    socket.on("connect", () => {
      setConnected(true);
      setReconnecting(false);
      setError(null);
      joinAsSpectator(false);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setJoined(false);
    });

    socket.on("connect_error", (err: Error) => {
      setError(err.message);
      setConnected(false);
    });

    socket.io.on("reconnect_attempt", () => {
      setReconnecting(true);
    });

    socket.io.on("reconnect", () => {
      setReconnecting(false);
      setError(null);
      joinAsSpectator(true);
    });

    socket.io.on("reconnect_failed", () => {
      setReconnecting(false);
      setError("Reconnection failed");
    });

    // Game event listeners (read-only)
    helpers.onStateUpdated((data) => {
      optionsRef.current.onStateUpdate?.(data);
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

    socket.on("game:spectator-count", (data: SpectatorCountPayload) => {
      if (data.matchId === matchId) {
        setSpectatorCount(data.spectatorCount);
        optionsRef.current.onSpectatorCount?.(data);
      }
    });

    socket.connect();

    return () => {
      socket.emit("game:leave-spectate", { matchId }, () => {});
      helpers.cleanup();
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("game:spectator-count");
      socket.io.off("reconnect_attempt");
      socket.io.off("reconnect");
      socket.io.off("reconnect_failed");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [matchId]);

  return { connected, joined, error, reconnecting, spectatorCount };
}
