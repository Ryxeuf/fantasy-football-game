"use client";
import { useEffect, useMemo, useState } from "react";
import { PlayerDetails, DiceResultPopup, GameScoreboard, ActionPickerPopup, GameBoardWithDugouts } from "@bb/ui";
import { setup, getLegalMoves, applyMove, makeRNG, clearDiceResult, hasPlayerActed, type GameState, type Position, type Move, setupPreMatch, setupPreMatchWithTeams, startMatchFromPreMatch } from "@bb/game-engine";
import { API_BASE } from "../../auth-client";

export default function PlayByIdPage({ params }: { params: { id: string } }) {
  const matchId = params.id;

  useEffect(() => {
    (async () => {
      const matchToken = localStorage.getItem("match_token");
      if (matchToken) return;
      try {
        const authToken = localStorage.getItem("auth_token");
        if (!authToken) { window.location.href = "/lobby"; return; }
        const res = await fetch(`${API_BASE}/match/join`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ matchId }),
        });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.matchToken) {
          localStorage.setItem("match_token", data.matchToken as string);
        } else {
          window.location.href = "/lobby";
        }
      } catch {
        window.location.href = "/lobby";
      }
    })();
  }, []);

  // Bloquer l'accès si le match n'est pas encore actif
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) { window.location.href = "/lobby"; return; }
      const res = await fetch(`${API_BASE}/match/${matchId}/summary`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
      if (!res.ok) { window.location.href = "/lobby"; return; }
      const status = data?.status;
      // Autoriser 'active' et 'prematch'. Sinon, renvoyer vers la salle d'attente de ce match
      if (status !== 'active' && status !== 'prematch') {
        window.location.href = `/waiting/${matchId}`;
        return;
      }
      } catch {
        window.location.href = "/lobby";
      }
    })();
  }, [matchId]);

  const [state, setState] = useState<GameState | null>(null);
  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<"MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | null>(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);
  const [teamNameA, setTeamNameA] = useState<string | null>(null); // local
  const [teamNameB, setTeamNameB] = useState<string | null>(null); // visiteur

  // useEffect pour charger les noms d'équipes et coaches via /details (prioritaire, indépendant)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        // 1) Tenter avec match_token d'abord
        const matchToken = localStorage.getItem("match_token");
        let data: any = {};
        if (matchToken) {
          const res = await fetch(`${API_BASE}/match/details`, { headers: { "X-Match-Token": matchToken } });
          data = await res.json().catch(() => ({} as any));
          if (res.ok && data) {
            setTeamNameA(data?.local?.teamName || null);
            setTeamNameB(data?.visitor?.teamName || null);
            return;
          }
        }
        // 2) Fallback auth
        const res = await fetch(`${API_BASE}/match/${matchId}/details`, { headers: { Authorization: `Bearer ${token}` } });
        data = await res.json().catch(() => ({} as any));
        if (res.ok && data) {
          setTeamNameA(data?.local?.teamName || null);
          setTeamNameB(data?.visitor?.teamName || null);
        }
      } catch (e) {
        console.error('Failed to load team names:', e);
        // Fallback démo si échec total
        setTeamNameA('Équipe Locale');
        setTeamNameB('Équipe Visiteuse');
      }
    })();
  }, [matchId]); // Seulement matchId, pas de teamNames dans deps

  // Nouveau useEffect pour charger l'état du jeu (dépend des teamNames pour fallback)
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/state`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.gameState) {
          setState(data.gameState);
          // Ne pas override teamNames si déjà set
          return;
        }
      } catch (e) {
        console.error('Failed to load game state:', e);
      }
      // Fallback: charger les équipes et setup prematch avec vrais data
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) {
          setState(setupPreMatch());
          return;
        }
        const teamsRes = await fetch(`${API_BASE}/match/${matchId}/teams`, { headers: { Authorization: `Bearer ${token}` } });
        const teamsData = await teamsRes.json().catch(() => ({} as any));
        if (teamsRes.ok && teamsData.local && teamsData.visitor) {
          // Utiliser teamNameA/B déjà chargés, ou fallback aux data
          const teamAName = teamNameA || teamsData.local.teamName || 'Équipe Locale';
          const teamBName = teamNameB || teamsData.visitor.teamName || 'Équipe Visiteuse';
          setState(setupPreMatchWithTeams(teamsData.local.players || [], teamsData.visitor.players || [], teamAName, teamBName));
          return;
        }
      } catch (e) {
        console.error('Failed to load teams for prematch:', e);
      }
      // Dernier fallback: démo, mais avec teamNames si disponibles
      const demoState = setupPreMatch();
      if (teamNameA) demoState.teamNames.teamA = teamNameA;
      if (teamNameB) demoState.teamNames.teamB = teamNameB;
      setState(demoState);
    })();
  }, [matchId, teamNameA, teamNameB]); // Dépend des teamNames pour utiliser les bons noms dans fallback

  // Charger le résumé (tour/mi-temps/score) depuis l'API pour refléter l'état en base
  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({} as any));
        if (!res.ok || !data) return;

        // Ne pas écraser half/turn si en phase pré-match (half=0)
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            half: prev.half === 0 ? 0 : (typeof data.half === "number" ? data.half : prev.half),
            turn: prev.half === 0 ? 0 : (typeof data.turn === "number" ? data.turn : prev.turn),
            score: {
              teamA: typeof data?.score?.teamA === "number" ? data.score.teamA : prev.score.teamA,
              teamB: typeof data?.score?.teamB === "number" ? data.score.teamB : prev.score.teamB,
            },
            // Ne pas override teamNames du state si déjà bons
            teamNames: {
              teamA: prev.teamNames.teamA || teamNameA || data?.teams?.local?.name || prev.teamNames.teamA,
              teamB: prev.teamNames.teamB || teamNameB || data?.teams?.visitor?.name || prev.teamNames.teamB,
            },
          };
        });
      } catch {
        // noop: on garde l'état courant (démo) si l'API échoue
      }
    })();
  }, [matchId]); // Retiré teamNameA/B des deps pour éviter loops

  const legal = useMemo(() => {
    if (!state) return [];
    return getLegalMoves(state);
  }, [state]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> => m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(() => {
    if (!state || !state.selectedPlayerId) return [];
    return legal.filter((m) => isMove(m, state.selectedPlayerId!)).map((m) => m.to);
  }, [legal, state?.selectedPlayerId]);

  function onCellClick(pos: Position) {
    if (!state) return;
    const player = state.players.find((p) => p.pos.x === pos.x && p.pos.y === pos.y);
    if (player && player.team === state.currentPlayer) {
      setState((s) => s ? ({ ...s, selectedPlayerId: player.id }) : null);
      setCurrentAction(null);
      return;
    }
    if (state.selectedPlayerId) {
      const candidate = legal.find((m) => m.type === "MOVE" && m.playerId === state.selectedPlayerId && m.to.x === pos.x && m.to.y === pos.y);
      if (candidate && candidate.type === "MOVE" && (currentAction === "MOVE" || currentAction === "BLITZ" || currentAction === null)) {
        setState((s) => {
          if (!s) return null;
          const s2 = applyMove(s, candidate, createRNG());
          const p = s2.players.find((pl) => pl.id === candidate.playerId);
          if (!p || p.pm <= 0) s2.selectedPlayerId = null;
          if (s2.lastDiceResult) setShowDicePopup(true);
          return s2;
        });
      }
    }
  }

  const handleEndTurn = useMemo(() => {
    if (!state || state.half <= 0) return undefined;
    return () => setState((s) => s ? applyMove(s, { type: "END_TURN" }, createRNG()) : null);
  }, [state]);

  const handleStartMatch = useMemo(() => {
    if (state?.half !== 0) return undefined;
    return () => {
      setState((s) => {
        if (!s || s.half !== 0) return s;
        const startedState = startMatchFromPreMatch(s);
        return startedState;
      });
    };
  }, [state]);

  if (!state) {
    return <div className="flex items-center justify-center min-h-screen">Chargement de la partie...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <GameScoreboard
        state={state}
        leftTeamName={teamNameA}
        rightTeamName={teamNameB}
        // Supprimé leftCoachName et rightCoachName
        onEndTurn={handleEndTurn}
      />
      {state.half === 0 && handleStartMatch && (
        <div className="flex justify-center mt-4">
          <button 
            onClick={handleStartMatch} 
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Commencer le match
          </button>
        </div>
      )}
      <div className="pt-24">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row items-start gap-6 mb-6">
            <div className="flex-1 flex justify-center">
              <GameBoardWithDugouts state={state} onCellClick={onCellClick} legalMoves={movesForSelected} blockTargets={[]} selectedPlayerId={state.selectedPlayerId} onPlayerClick={(playerId) => {
                if (!state) return;
                const player = state.players.find((p) => p.id === playerId);
                if (player && player.team === state.currentPlayer) {
                  setState((s) => s ? ({ ...s, selectedPlayerId: player.id }) : null);
                  setCurrentAction(null);
                }
              }} />
            </div>
            <div className="w-full lg:w-auto">
              {state.selectedPlayerId && (
                <PlayerDetails variant="sidebar" player={state.players.find((p) => p.id === state.selectedPlayerId) || null} onClose={() => setState((s) => s ? ({ ...s, selectedPlayerId: null }) : null)} />
              )}
            </div>
          </div>
        </div>
      </div>
      {showDicePopup && state.lastDiceResult && (
        <DiceResultPopup result={state.lastDiceResult} onClose={() => { setShowDicePopup(false); setState((s) => s ? clearDiceResult(s) : null); }} />
      )}
      {state.selectedPlayerId && currentAction === null && !hasPlayerActed(state, state.selectedPlayerId) && (
        <ActionPickerPopup playerName={state.players.find(p => p.id === state.selectedPlayerId)?.name || 'Joueur'} available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]} onPick={(a) => setCurrentAction(a)} onClose={() => setCurrentAction("MOVE")} />
      )}
    </div>
  );
}


