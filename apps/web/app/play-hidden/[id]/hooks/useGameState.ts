"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { ExtendedGameState } from "@bb/game-engine";
import { setupPreMatchWithTeams } from "@bb/game-engine";
import { API_BASE } from "../../../auth-client";
import { useGameSocket } from "./useGameSocket";
import type { StateUpdatedPayload, MatchEndedPayload, PlayerConnectionPayload } from "./useGameSocket";

function normalizeState(state: any): ExtendedGameState {
  if (!state) return state;
  if (!state.playerActions) state.playerActions = {};
  if (!state.teamBlitzCount) state.teamBlitzCount = {};
  if (!state.teamFoulCount) state.teamFoulCount = {};
  if (!state.matchStats) state.matchStats = {};
  if (typeof state.width !== "number") state.width = 26;
  if (typeof state.height !== "number") state.height = 15;
  if (state.preMatch?.phase === "setup") state.selectedPlayerId = null;
  return state as ExtendedGameState;
}

export interface InducementPhaseInfo {
  budget: number;
  pettyCash: number;
  hasApothecary: boolean;
  rosterSlug: string;
  alreadySubmitted: boolean;
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
  inducementPhase: InducementPhaseInfo | null;
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
  const [inducementPhase, setInducementPhase] = useState<InducementPhaseInfo | null>(null);

  const isActiveMatch = matchStatus === "active";

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
          window.location.href = "/lobby";
        }
      } catch { window.location.href = "/lobby"; }
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
        if (!res.ok) { window.location.href = "/lobby"; return; }
        const status = data?.status;
        if (status) setMatchStatus(status);
        if (status !== "active" && status !== "prematch" && status !== "prematch-setup" && status !== "ended") {
          window.location.href = `/waiting/${matchId}`;
        }
      } catch { window.location.href = "/lobby"; }
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
          setInducementPhase(data.inducementPhase || null);
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

  // WebSocket — real-time game state updates via socket.io
  const { connected: wsConnected } = useGameSocket(matchId, {
    onStateUpdate: useCallback((data: StateUpdatedPayload) => {
      if (data.gameState) {
        setState(normalizeState(data.gameState));
        setStateSource("server");
      }
    }, []),
    onMatchEnded: useCallback((data: MatchEndedPayload) => {
      if (data.gameState) {
        setState(normalizeState(data.gameState));
        setStateSource("server");
        setMatchStatus("ended");
      }
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
            setInducementPhase(data.inducementPhase || null);
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
    teamNameA, teamNameB, userName, inducementPhase,
    setState, setMatchStatus, setMyTeamSide, setIsMyTurn,
  };
}
