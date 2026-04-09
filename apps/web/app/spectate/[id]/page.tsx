"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  GameScoreboard,
  GameBoardWithDugouts,
  GameLog,
} from "@bb/ui";
import type { ExtendedGameState } from "@bb/game-engine";
import { API_BASE } from "../../auth-client";
import { useSpectatorSocket } from "./hooks/useSpectatorSocket";
import type {
  StateUpdatedPayload,
  MatchEndedPayload,
  MatchForfeitedPayload,
  TurnTimerStartedPayload,
  ResyncPayload,
} from "../../play-hidden/[id]/hooks/useGameSocket";

function normalizeState(state: any): ExtendedGameState {
  if (!state) return state;
  if (!state.playerActions) state.playerActions = {};
  if (!state.teamBlitzCount) state.teamBlitzCount = {};
  if (!state.teamFoulCount) state.teamFoulCount = {};
  if (!state.matchStats) state.matchStats = {};
  if (typeof state.width !== "number") state.width = 26;
  if (typeof state.height !== "number") state.height = 15;
  return state as ExtendedGameState;
}

export default function SpectatePage({ params }: { params: { id: string } }) {
  const matchId = params.id;

  const [state, setState] = useState<ExtendedGameState | null>(null);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [turnTimerDeadline, setTurnTimerDeadline] = useState<number | null>(null);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial game state
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setError("Connexion requise pour regarder un match");
          setLoading(false);
          return;
        }
        const res = await fetch(`${API_BASE}/match/${matchId}/spectate`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}) as any);
        if (!res.ok) {
          setError(data.error || "Impossible de charger le match");
          setLoading(false);
          return;
        }
        if (data.gameState) {
          setState(normalizeState(data.gameState));
          setMatchStatus(data.matchStatus);
        }
        initialLoadDone.current = true;
        setLoading(false);
      } catch {
        setError("Erreur de connexion au serveur");
        setLoading(false);
      }
    })();
  }, [matchId]);

  // WebSocket for real-time updates
  const {
    connected: wsConnected,
    reconnecting: wsReconnecting,
    spectatorCount,
  } = useSpectatorSocket(matchId, {
    onStateUpdate: useCallback((data: StateUpdatedPayload) => {
      if (data.gameState) {
        const gs = normalizeState(data.gameState);
        setState(gs);
        if (gs.gamePhase === "playing" && gs.half >= 1) {
          setMatchStatus("active");
        }
      }
    }, []),
    onMatchEnded: useCallback((data: MatchEndedPayload) => {
      if (data.gameState) {
        setState(normalizeState(data.gameState));
        setMatchStatus("ended");
      }
    }, []),
    onMatchForfeited: useCallback((data: MatchForfeitedPayload) => {
      if (data.gameState) {
        setState(normalizeState(data.gameState));
      }
      setMatchStatus("ended");
    }, []),
    onResyncState: useCallback((data: ResyncPayload) => {
      if (data.success && data.gameState) {
        setState(normalizeState(data.gameState));
      }
    }, []),
    onTurnTimerStarted: useCallback((data: TurnTimerStartedPayload) => {
      setTurnTimerDeadline(data.deadline);
      setTurnTimerSeconds(data.turnTimerSeconds);
    }, []),
  });

  // Fallback polling (30s when WS connected, 10s when not)
  useEffect(() => {
    if (!initialLoadDone.current) return;
    const pollInterval = wsConnected ? 30000 : 10000;
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/spectate`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.gameState) {
            setState(normalizeState(data.gameState));
            if (data.matchStatus) setMatchStatus(data.matchStatus);
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, pollInterval);
    return () => clearInterval(interval);
  }, [matchId, wsConnected]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-gray-300 border-t-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Chargement du match...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center p-6 bg-white rounded-lg shadow-md max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <a
            href="/spectate"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Retour aux matchs en direct
          </a>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-gray-600">Aucun etat de jeu disponible</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Spectator banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-purple-600 text-white text-center py-2 text-sm font-bold flex items-center justify-center gap-3">
        <span>Mode spectateur</span>
        <span className="bg-purple-800 px-2 py-0.5 rounded text-xs">
          {spectatorCount} spectateur{spectatorCount !== 1 ? "s" : ""}
        </span>
        {matchStatus === "ended" && (
          <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">
            Match termine — {state.score.teamA} - {state.score.teamB}
          </span>
        )}
        {!wsConnected && !wsReconnecting && (
          <span className="bg-red-700 px-2 py-0.5 rounded text-xs">
            Deconnecte
          </span>
        )}
        {wsReconnecting && (
          <span className="bg-yellow-600 px-2 py-0.5 rounded text-xs">
            Reconnexion...
          </span>
        )}
      </div>

      <div className="pt-32">
        <GameScoreboard
          state={state}
          leftTeamName={state.teamNames?.teamA}
          rightTeamName={state.teamNames?.teamB}
          wsConnected={wsConnected}
          wsReconnecting={wsReconnecting}
          turnTimerDeadline={turnTimerDeadline ?? undefined}
          turnTimerSeconds={turnTimerSeconds}
        />

        <div className="container mx-auto px-4 py-6">
          <GameBoardWithDugouts state={state} />

          {/* Game log */}
          {state.gameLog && state.gameLog.length > 0 && (
            <div className="mt-4 max-w-4xl mx-auto">
              <GameLog logEntries={state.gameLog} />
            </div>
          )}
        </div>
      </div>

      {/* Back to live matches link */}
      <div className="fixed bottom-4 left-4 z-50">
        <a
          href="/spectate"
          className="bg-gray-800 hover:bg-gray-700 text-white rounded-full px-4 py-2 text-sm shadow-lg transition-colors"
        >
          Retour aux matchs
        </a>
      </div>
    </div>
  );
}
