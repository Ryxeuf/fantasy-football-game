"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ExtendedGameState } from "@bb/game-engine";
import { setupPreMatchWithTeams } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";
import { useGameSocket } from "./useGameSocket";
import { deriveIsMyTurn } from "./deriveSetupTurn";
import type { StateUpdatedPayload, MatchEndedPayload, PlayerConnectionPayload, MatchForfeitedPayload, TurnTimerStartedPayload } from "./useGameSocket";

function normalizeState(state: any): ExtendedGameState {
  if (!state) return state;
  return {
    ...state,
    playerActions: state.playerActions ?? {},
    teamBlitzCount: state.teamBlitzCount ?? {},
    teamFoulCount: state.teamFoulCount ?? {},
    matchStats: state.matchStats ?? {},
    width: typeof state.width === "number" ? state.width : 26,
    height: typeof state.height === "number" ? state.height : 15,
    selectedPlayerId: state.preMatch?.phase === "setup" ? null : state.selectedPlayerId,
  } as ExtendedGameState;
}

export interface GameStateInfo {
  state: ExtendedGameState | null;
  stateSource: "server" | "fallback" | null;
  matchStatus: string | null;
  myTeamSide: "A" | "B" | null;
  isMyTurn: boolean;
  teamNameA: string | undefined;
  teamNameB: string | undefined;
  userName: string | undefined;
  /** True when the opponent has disconnected from the match. */
  opponentDisconnected: boolean;
  /** Timestamp (ms) when the opponent disconnected, or null. */
  opponentDisconnectedAt: number | null;
  /** Turn timer deadline (ms epoch) from server, or null if no timer active. */
  turnTimerDeadline: number | null;
  /** Turn timer total duration in seconds (from server). */
  turnTimerSeconds: number;
  /** WebSocket connection status */
  wsConnected: boolean;
  wsReconnecting: boolean;
  wsReconnectAttempt: number;
  /** WebSocket submitMove function */
  wsSubmitMove: ReturnType<typeof useGameSocket>["submitMove"];
  /** Raw socket reference for chat */
  gameSocket: ReturnType<typeof useGameSocket>["socket"];
  setState: (s: ExtendedGameState | ((prev: ExtendedGameState | null) => ExtendedGameState | null)) => void;
  setMatchStatus: (s: string | null) => void;
  setMyTeamSide: (s: "A" | "B" | null) => void;
  setIsMyTurn: (s: boolean) => void;
}

/**
 * Hook pour gérer l'état du jeu : chargement initial, polling, normalisation
 */
export function useGameState(matchId: string): GameStateInfo {
  const [state, setState] = useState<ExtendedGameState | null>(null);
  const [stateSource, setStateSource] = useState<"server" | "fallback" | null>(null);
  const [matchStatus, setMatchStatus] = useState<string | null>(null);
  const [myTeamSide, setMyTeamSide] = useState<"A" | "B" | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [teamNameA, setTeamNameA] = useState<string | undefined>(undefined);
  const [teamNameB, setTeamNameB] = useState<string | undefined>(undefined);
  const [userName, setUserName] = useState<string | undefined>(undefined);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [opponentDisconnectedAt, setOpponentDisconnectedAt] = useState<number | null>(null);
  const [turnTimerDeadline, setTurnTimerDeadline] = useState<number | null>(null);
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(0);

  const isActiveMatch = matchStatus === "active";

  // Ref for myTeamSide — used inside useCallback to avoid stale closures
  const myTeamSideRef = useRef(myTeamSide);
  myTeamSideRef.current = myTeamSide;

  // Auth check + join
  useEffect(() => {
    (async () => {
      const matchToken = localStorage.getItem("match_token");
      if (matchToken) return;
      try {
        const authToken = localStorage.getItem("auth_token");
        if (!authToken) { window.location.href = "/lobby"; return; }
        const res = await fetch(`${API_BASE}/match/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ matchId }),
        });
        const data = await res.json().catch(() => ({}) as any);
        if (res.ok && data?.matchToken) {
          localStorage.setItem("match_token", data.matchToken as string);
        } else {
          // Match introuvable — nettoyer session + queue matchmaking
          localStorage.removeItem("match_token");
          await fetch(`${API_BASE}/matchmaking/leave`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          }).catch(() => {});
          window.location.href = "/play";
        }
      } catch {
        localStorage.removeItem("match_token");
        const authToken = localStorage.getItem("auth_token");
        if (authToken) {
          await fetch(`${API_BASE}/matchmaking/leave`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          }).catch(() => {});
        }
        window.location.href = "/play";
      }
    })();
  }, []);

  // Match status check
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) { window.location.href = "/lobby"; return; }
        const res = await fetch(`${API_BASE}/match/${matchId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}) as any);
        if (!res.ok) {
          // Match introuvable — nettoyer session + queue matchmaking
          localStorage.removeItem("match_token");
          await fetch(`${API_BASE}/matchmaking/leave`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
          window.location.href = "/play";
          return;
        }
        const status = data?.status;
        if (status) setMatchStatus(status);
        if (status !== "active" && status !== "prematch" && status !== "prematch-setup" && status !== "ended") {
          window.location.href = `/waiting/${matchId}`;
        }
      } catch {
        localStorage.removeItem("match_token");
        const authToken = localStorage.getItem("auth_token");
        if (authToken) {
          await fetch(`${API_BASE}/matchmaking/leave`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${authToken}` },
          }).catch(() => {});
        }
        window.location.href = "/play";
      }
    })();
  }, [matchId]);

  // Load team names
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const matchToken = localStorage.getItem("match_token");
        if (matchToken) {
          const res = await fetch(`${API_BASE}/match/details`, {
            headers: { "X-Match-Token": matchToken },
          });
          const data = await res.json().catch(() => ({}) as any);
          if (res.ok && data) {
            setTeamNameA(data?.local?.teamName || undefined);
            setTeamNameB(data?.visitor?.teamName || undefined);
            return;
          }
        }
        const res = await fetch(`${API_BASE}/match/${matchId}/details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}) as any);
        if (res.ok && data) {
          setTeamNameA(data?.local?.teamName || undefined);
          setTeamNameB(data?.visitor?.teamName || undefined);
        }
      } catch {
        setTeamNameA("Équipe Locale");
        setTeamNameB("Équipe Visiteuse");
      }
    })();
  }, [matchId]);

  // Load initial game state (une seule fois)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}) as any);
        if (res.ok && data?.gameState) {
          setState(normalizeState(data.gameState));
          setStateSource("server");
          if (data.matchStatus) setMatchStatus(data.matchStatus);
          if (data.myTeamSide) setMyTeamSide(data.myTeamSide);
          if (typeof data.isMyTurn === "boolean") setIsMyTurn(data.isMyTurn);
          initialLoadDone.current = true;
          return;
        }
      } catch {}

      // Fallback
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setState(setupPreMatchWithTeams([], [], "Équipe Locale", "Équipe Visiteuse"));
          setStateSource("fallback");
          initialLoadDone.current = true;
          return;
        }
        const teamsRes = await fetch(`${API_BASE}/match/${matchId}/teams`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const teamsData = await teamsRes.json().catch(() => ({}) as any);
        if (teamsRes.ok && (teamsData.teamA || (teamsData.local && teamsData.visitor))) {
          const a = teamsData.teamA || teamsData.local;
          const b = teamsData.teamB || teamsData.visitor;
          setState(normalizeState(
            setupPreMatchWithTeams(a.players || [], b.players || [], teamNameA || a.teamName || "Équipe Locale", teamNameB || b.teamName || "Équipe Visiteuse")
          ));
          setStateSource("fallback");
          initialLoadDone.current = true;
          return;
        }
      } catch {}

      setState(setupPreMatchWithTeams([], [], teamNameA || "Équipe Locale", teamNameB || "Équipe Visiteuse"));
      setStateSource("fallback");
      initialLoadDone.current = true;
    })();
  }, [matchId, teamNameA, teamNameB]);

  // WebSocket — single connection for real-time game state updates + move submission + chat
  const {
    connected: wsConnected,
    reconnecting: wsReconnecting,
    reconnectAttempt: wsReconnectAttempt,
    submitMove: wsSubmitMove,
    socket: gameSocket,
  } = useGameSocket(matchId, {
    onStateUpdate: useCallback((data: StateUpdatedPayload) => {
      if (data.gameState) {
        const gs = normalizeState(data.gameState);
        setState(gs);
        setStateSource("server");
        // Derive isMyTurn from game state so opponent instantly knows when it's their turn
        const derived = deriveIsMyTurn(gs, myTeamSideRef.current);
        setIsMyTurn(derived);
        // Detect phase transitions (e.g. prematch-setup → active)
        if (gs.gamePhase === "playing" && gs.half >= 1) {
          setMatchStatus("active");
        }
      }
    }, []),
    onMatchEnded: useCallback((data: MatchEndedPayload) => {
      if (data.gameState) {
        setState(normalizeState(data.gameState));
        setStateSource("server");
        setMatchStatus("ended");
      }
    }, []),
    onMatchForfeited: useCallback((data: MatchForfeitedPayload) => {
      if (data.gameState) {
        setState(normalizeState(data.gameState));
        setStateSource("server");
      }
      setMatchStatus("ended");
      setOpponentDisconnected(false);
      setOpponentDisconnectedAt(null);
    }, []),
    onPlayerDisconnected: useCallback((_data: PlayerConnectionPayload) => {
      setOpponentDisconnected(true);
      setOpponentDisconnectedAt(Date.now());
    }, []),
    onPlayerConnected: useCallback((_data: PlayerConnectionPayload) => {
      setOpponentDisconnected(false);
      setOpponentDisconnectedAt(null);
    }, []),
    onTurnTimerStarted: useCallback((data: TurnTimerStartedPayload) => {
      setTurnTimerDeadline(data.deadline);
      setTurnTimerSeconds(data.turnTimerSeconds);
    }, []),
  });

  // Fallback polling — slow interval (30s) when WebSocket is connected, faster (5s) when not.
  // Disabled during our setup placement turn to avoid conflicts.
  const isMySetupTurn = state?.preMatch?.phase === "setup" && state?.preMatch?.currentCoach === myTeamSide;
  useEffect(() => {
    if (isMySetupTurn) return;

    const pollInterval = wsConnected ? 30000 : (isActiveMatch && !isMyTurn ? 3000 : 10000);
    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.gameState) {
            setState(normalizeState(data.gameState));
            setStateSource("server");
            if (data.matchStatus) setMatchStatus(data.matchStatus);
            if (data.myTeamSide) setMyTeamSide(data.myTeamSide);
            if (typeof data.isMyTurn === "boolean") setIsMyTurn(data.isMyTurn);
          }
        }
      } catch {}
    }, pollInterval);
    return () => clearInterval(interval);
  }, [matchId, isActiveMatch, isMyTurn, isMySetupTurn, wsConnected]);

  // Load summary
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}) as any);
        if (!res.ok || !data) return;
        setState((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            half: prev.half === 0 ? 0 : typeof data.half === "number" ? data.half : prev.half,
            turn: prev.half === 0 ? 0 : typeof data.turn === "number" ? data.turn : prev.turn,
            score: {
              teamA: typeof data?.score?.teamA === "number" ? data.score.teamA : prev.score.teamA,
              teamB: typeof data?.score?.teamB === "number" ? data.score.teamB : prev.score.teamB,
            },
          } as any;
          if (prev.half === 0) updated.preMatch = prev.preMatch;
          return updated as ExtendedGameState;
        });
      } catch {}
    })();
  }, [matchId]);

  // Load user name
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}) as any);
        if (res.ok && data?.user?.name) setUserName(data.user.name);
        else if (res.ok && data?.user?.email) setUserName(data.user.email);
      } catch {}
    })();
  }, []);

  return {
    state, stateSource, matchStatus, myTeamSide, isMyTurn,
    teamNameA, teamNameB, userName,
    opponentDisconnected, opponentDisconnectedAt,
    turnTimerDeadline, turnTimerSeconds,
    wsConnected, wsReconnecting, wsReconnectAttempt,
    wsSubmitMove, gameSocket,
    setState, setMatchStatus, setMyTeamSide, setIsMyTurn,
  };
}
