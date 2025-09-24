"use client";
import { useEffect, useMemo, useState } from "react";
import { PixiBoard, PlayerDetails, DiceResultPopup, GameScoreboard, GameLog, BlockChoicePopup, ActionPickerPopup, PushChoicePopup, FollowUpChoicePopup, GameBoardWithDugouts } from "@bb/ui";
import { setup, getLegalMoves, applyMove, makeRNG, clearDiceResult, hasPlayerActed, type GameState, type Position, type Move } from "@bb/game-engine";
import { API_BASE } from "../auth-client";

export default function PlayPage() {
  useEffect(() => {
    const matchToken = localStorage.getItem("match_token");
    if (!matchToken) {
      window.location.href = "/lobby";
    }
  }, []);

  const [state, setState] = useState<GameState>(() => setup());
  const [showDicePopup, setShowDicePopup] = useState(false);
  const [currentAction, setCurrentAction] = useState<"MOVE" | "BLOCK" | "BLITZ" | "PASS" | "HANDOFF" | "FOUL" | null>(null);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);
  const [coachNameA, setCoachNameA] = useState<string | null>(null); // local
  const [coachNameB, setCoachNameB] = useState<string | null>(null); // visiteur
  const [teamNameA, setTeamNameA] = useState<string | null>(null); // local
  const [teamNameB, setTeamNameB] = useState<string | null>(null); // visiteur

  useEffect(() => {
    // Récupère le nom du coach connecté pour l'afficher
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data?.user?.name) {
          setCoachNameA(data.user.name as string);
        } else if (res.ok && data?.user?.email) {
          setCoachNameA(data.user.email as string);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    // Récupère les noms d'équipes et coachs via le token de match
    (async () => {
      try {
        const matchToken = localStorage.getItem("match_token");
        if (!matchToken) return;
        const res = await fetch(`${API_BASE}/match/details`, {
          headers: { "X-Match-Token": matchToken },
        });
        const data = await res.json().catch(() => ({} as any));
        if (res.ok && data) {
          // local/visitor -> gauche/droite
          setTeamNameA(data?.local?.teamName || null);
          setTeamNameB(data?.visitor?.teamName || null);
          setCoachNameA((prev) => prev ?? (data?.local?.coachName || null));
          setCoachNameB(data?.visitor?.coachName || null);
        }
      } catch {}
    })();
  }, []);

  const legal = useMemo(() => getLegalMoves(state), [state]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> => m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(() => (state.selectedPlayerId ? legal.filter((m) => isMove(m, state.selectedPlayerId!)).map((m) => m.to) : []), [legal, state.selectedPlayerId]);

  const blockTargets = useMemo(() => {
    if (!state.selectedPlayerId) return [] as Position[];
    const attacker = state.players.find((p) => p.id === state.selectedPlayerId);
    if (!attacker) return [] as Position[];
    return legal
      .filter((m) => m.type === "BLOCK" && (m as any).playerId === attacker.id)
      .map((m: any) => {
        const target = state.players.find((p) => p.id === m.targetId);
        return target ? target.pos : null;
      })
      .filter(Boolean) as Position[];
  }, [legal, state.selectedPlayerId, state.players]);

  function onCellClick(pos: Position) {
    const player = state.players.find((p) => p.pos.x === pos.x && p.pos.y === pos.y);
    if (player && player.team === state.currentPlayer) {
      setState((s) => ({ ...s, selectedPlayerId: player.id }));
      setCurrentAction(null);
      return;
    }
    if (state.selectedPlayerId) {
      const attackerId = state.selectedPlayerId;
      const target = state.players.find((p) => p.team !== state.currentPlayer && p.pos.x === pos.x && p.pos.y === pos.y);
      const blockMove = legal.find((m) => m.type === "BLOCK" && (m as any).playerId === attackerId && target && (m as any).targetId === target.id) as any;
      if (blockMove && target && (currentAction === "BLOCK" || currentAction === "BLITZ")) {
        setState((s) => applyMove(s, { type: "BLOCK", playerId: attackerId, targetId: target.id } as any, createRNG()));
        return;
      }
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
          {/* Zone réservée pour des composants d'interface de match (pas de démo ici) */}
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


