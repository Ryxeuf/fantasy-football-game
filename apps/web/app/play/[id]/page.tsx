"use client";
import { useEffect, useMemo, useState } from "react";
import { PlayerDetails, DiceResultPopup, GameScoreboard, ActionPickerPopup, GameBoardWithDugouts } from "@bb/ui";
import { setup, getLegalMoves, applyMove, makeRNG, clearDiceResult, hasPlayerActed, type GameState, type Position, type Move } from "@bb/game-engine";
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

  const [state, setState] = useState<GameState>(() => setup());
  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<"MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | null>(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);
  const [coachNameA, setCoachNameA] = useState<string | null>(null); // local
  const [coachNameB, setCoachNameB] = useState<string | null>(null); // visiteur
  const [teamNameA, setTeamNameA] = useState<string | null>(null); // local
  const [teamNameB, setTeamNameB] = useState<string | null>(null); // visiteur

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.user?.name) setCoachNameA(data.user.name as string);
        else if (res.ok && data?.user?.email) setCoachNameA(data.user.email as string);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    // 1) Tenter avec le match_token (source de vérité pour le match courant)
    (async () => {
      try {
        const matchToken = localStorage.getItem("match_token");
        if (matchToken) {
          const res = await fetch(`${API_BASE}/match/details`, { headers: { "X-Match-Token": matchToken } });
          const data = await res.json().catch(() => ({} as any));
          if (res.ok && data) {
            setTeamNameA(data?.local?.teamName || null);
            setTeamNameB(data?.visitor?.teamName || null);
            setCoachNameA((prev) => prev ?? (data?.local?.coachName || null));
            setCoachNameB(data?.visitor?.coachName || null);
            return; // si OK, inutile de tenter l'endpoint auth
          }
        }
      } catch {}
      // 2) Fallback: endpoint authentifié avec l'id de match
      try {
        const token = localStorage.getItem("auth_token");
        if (!token) return;
        const res = await fetch(`${API_BASE}/match/${matchId}/details`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data) {
          setTeamNameA((prev) => prev ?? (data?.local?.teamName || null));
          setTeamNameB((prev) => prev ?? (data?.visitor?.teamName || null));
          setCoachNameA((prev) => prev ?? (data?.local?.coachName || null));
          setCoachNameB((prev) => prev ?? (data?.visitor?.coachName || null));
        }
      } catch {}
    })();
  }, [matchId]);

  // plus de fallback supplémentaire nécessaire après l'ordre ci-dessus

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

        // Mettre à jour l'état d'affichage (score/mi-temps/tour) et éventuellement les noms d'équipes
        setState((prev) => ({
          ...prev,
          half: typeof data.half === "number" ? data.half : prev.half,
          turn: typeof data.turn === "number" ? data.turn : prev.turn,
          score: {
            teamA: typeof data?.score?.teamA === "number" ? data.score.teamA : prev.score.teamA,
            teamB: typeof data?.score?.teamB === "number" ? data.score.teamB : prev.score.teamB,
          },
          teamNames: {
            teamA: teamNameA || data?.teams?.local?.name || prev.teamNames.teamA,
            teamB: teamNameB || data?.teams?.visitor?.name || prev.teamNames.teamB,
          },
        }));
      } catch {
        // noop: on garde l'état courant (démo) si l'API échoue
      }
    })();
  }, [matchId, teamNameA, teamNameB]);

  const legal = useMemo(() => getLegalMoves(state), [state]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> => m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(() => (state.selectedPlayerId ? legal.filter((m) => isMove(m, state.selectedPlayerId!)).map((m) => m.to) : []), [legal, state.selectedPlayerId]);

  function onCellClick(pos: Position) {
    const player = state.players.find((p) => p.pos.x === pos.x && p.pos.y === pos.y);
    if (player && player.team === state.currentPlayer) {
      setState((s) => ({ ...s, selectedPlayerId: player.id }));
      setCurrentAction(null);
      return;
    }
    if (state.selectedPlayerId) {
      const candidate = legal.find((m) => m.type === "MOVE" && m.playerId === state.selectedPlayerId && m.to.x === pos.x && m.to.y === pos.y);
      if (candidate && candidate.type === "MOVE" && (currentAction === "MOVE" || currentAction === "BLITZ" || currentAction === null)) {
        setState((s) => {
          const s2 = applyMove(s, candidate, createRNG());
          const p = s2.players.find((pl) => pl.id === candidate.playerId);
          if (!p || p.pm <= 0) s2.selectedPlayerId = null;
          if (s2.lastDiceResult) setShowDicePopup(true);
          return s2;
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <GameScoreboard
        state={state}
        leftTeamName={teamNameA || state.teamNames.teamA}
        rightTeamName={teamNameB || state.teamNames.teamB}
        leftCoachName={coachNameA || "Joueur"}
        rightCoachName={coachNameB || "Adversaire"}
        onEndTurn={() => setState((s) => applyMove(s, { type: "END_TURN" }, createRNG()))}
      />
      <div className="pt-24">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row items-start gap-6 mb-6">
            <div className="flex-1 flex justify-center">
              <GameBoardWithDugouts state={state} onCellClick={onCellClick} legalMoves={movesForSelected} blockTargets={[]} selectedPlayerId={state.selectedPlayerId} onPlayerClick={(playerId) => {
                const player = state.players.find((p) => p.id === playerId);
                if (player && player.team === state.currentPlayer) {
                  setState((s) => ({ ...s, selectedPlayerId: player.id }));
                  setCurrentAction(null);
                }
              }} />
            </div>
            <div className="w-full lg:w-auto">
              {state.selectedPlayerId && (
                <PlayerDetails variant="sidebar" player={state.players.find((p) => p.id === state.selectedPlayerId) || null} onClose={() => setState((s) => ({ ...s, selectedPlayerId: null }))} />
              )}
            </div>
          </div>
        </div>
      </div>
      {showDicePopup && state.lastDiceResult && (
        <DiceResultPopup result={state.lastDiceResult} onClose={() => { setShowDicePopup(false); setState((s) => clearDiceResult(s)); }} />
      )}
      {state.selectedPlayerId && currentAction === null && !hasPlayerActed(state, state.selectedPlayerId) && (
        <ActionPickerPopup playerName={state.players.find(p => p.id === state.selectedPlayerId)?.name || 'Joueur'} available={["MOVE", "BLOCK", "BLITZ", "PASS", "HANDOFF", "FOUL"]} onPick={(a) => setCurrentAction(a)} onClose={() => setCurrentAction("MOVE")} />
      )}
    </div>
  );
}


