"use client";
import { useMemo, useState } from "react";
import { getLegalMoves, type GameState, type Move, type TeamId } from "@bb/game-engine";
import { useAIPracticeLoop } from "./hooks/useAIPracticeLoop";

/**
 * N.4 — Panel d'orchestration IA pour les matches LocalMatch en mode pratique.
 *
 * Visible uniquement quand `aiOpponent === true`. Expose :
 *  - l'etat resume (phase, cote IA, tour courant) ;
 *  - un bouton "Jouer le tour IA" qui declenche la boucle jusqu'a ce que le
 *    controle revienne au joueur ;
 *  - la liste des coups legaux du joueur (bouton par coup) pour piloter le
 *    moteur cote utilisateur tant qu'une UI board complete n'est pas cablee.
 */

interface PracticeAIPanelProps {
  readonly matchId: string;
  readonly gameState: GameState | null | undefined;
  readonly aiTeam: TeamId;
  readonly difficulty: string | null | undefined;
  readonly onStateChange: (state: GameState) => void;
}

function summarizeMove(move: Move): string {
  switch (move.type) {
    case "MOVE":
      return `MOVE #${move.playerId} → (${move.to.x}, ${move.to.y})`;
    case "BLOCK":
      return `BLOCK #${move.attackerId} vs #${move.defenderId}`;
    case "BLITZ":
      return `BLITZ #${move.attackerId} vs #${move.defenderId}`;
    case "PASS":
      return `PASS #${move.passerId} → (${move.targetX}, ${move.targetY})`;
    case "HANDOFF":
      return `HANDOFF #${move.passerId} → #${move.receiverId}`;
    case "FOUL":
      return `FOUL #${move.attackerId} vs #${move.defenderId}`;
    case "END_TURN":
      return "END_TURN";
    default:
      return move.type;
  }
}

export function PracticeAIPanel({
  matchId,
  gameState,
  aiTeam,
  difficulty,
  onStateChange,
}: PracticeAIPanelProps) {
  const [appliedMoves, setAppliedMoves] = useState<string[]>([]);

  const loop = useAIPracticeLoop({
    matchId,
    aiTeam,
    onStateChange,
  });

  const legalMoves = useMemo<Move[]>(() => {
    if (!gameState) return [];
    try {
      return getLegalMoves(gameState);
    } catch {
      return [];
    }
  }, [gameState]);

  if (!gameState) {
    return (
      <div className="rounded-xl border-2 border-purple-200 bg-purple-50/60 p-4">
        <p className="text-sm text-purple-900 font-body">
          Etat de jeu non initialise. Demarrez le pre-match depuis la carte de la partie.
        </p>
      </div>
    );
  }

  const isAITurn = gameState.currentPlayer === aiTeam;
  const userTeam: TeamId = aiTeam === "A" ? "B" : "A";

  async function handlePlayAITurn() {
    if (!gameState) return;
    try {
      const result = await loop.playAITurn(gameState);
      setAppliedMoves(prev => [
        ...prev,
        ...result.moves.map(summarizeMove),
      ].slice(-12));
    } catch {
      // erreur deja exposee par le hook
    }
  }

  async function handleApplyUserMove(move: Move) {
    if (!gameState) return;
    try {
      await loop.applyUserMove(gameState, move);
      setAppliedMoves(prev => [...prev, `[vous] ${summarizeMove(move)}`].slice(-12));
    } catch {
      // erreur deja exposee par le hook
    }
  }

  return (
    <div
      data-testid="practice-ai-panel"
      className="rounded-xl border-2 border-purple-300 bg-white shadow-md overflow-hidden"
    >
      <div className="h-2 bg-gradient-to-r from-purple-500 via-nuffle-gold to-purple-500" />
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-heading font-bold text-nuffle-anthracite">
            Mode pratique vs IA
          </h3>
          <span className="text-xs font-subtitle font-semibold px-2 py-1 rounded bg-purple-100 text-purple-700">
            Difficulte : {difficulty ?? "n/a"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm font-body">
          <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3">
            <div className="text-xs text-purple-700/70 uppercase tracking-wide">Cote IA</div>
            <div className="font-subtitle font-semibold text-purple-900">Equipe {aiTeam}</div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-3">
            <div className="text-xs text-purple-700/70 uppercase tracking-wide">Tour en cours</div>
            <div className="font-subtitle font-semibold text-purple-900">
              Equipe {gameState.currentPlayer}
              {isAITurn ? " (IA)" : " (vous)"}
            </div>
          </div>
        </div>

        {loop.error && (
          <div
            data-testid="practice-ai-error"
            className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 font-body flex items-start justify-between gap-3"
          >
            <span>{loop.error}</span>
            <button
              type="button"
              onClick={loop.clearError}
              className="text-red-700 hover:underline text-xs"
            >
              Masquer
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="practice-ai-play-turn"
            disabled={!isAITurn || loop.running}
            onClick={handlePlayAITurn}
            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-subtitle font-semibold text-sm shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loop.running ? "IA en train de jouer..." : "Jouer le tour IA"}
          </button>
          <span className="text-xs text-nuffle-anthracite/60 self-center font-body">
            {isAITurn
              ? "C'est le tour de l'IA — declenchez la boucle."
              : `C'est votre tour (equipe ${userTeam}). Choisissez un coup ci-dessous.`}
          </span>
        </div>

        {!isAITurn && (
          <div className="space-y-2" data-testid="practice-ai-legal-moves">
            <div className="text-xs font-subtitle font-semibold text-nuffle-anthracite/70 uppercase tracking-wide">
              Coups legaux ({legalMoves.length})
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
              {legalMoves.length === 0 ? (
                <p className="text-xs text-nuffle-anthracite/50 font-body italic">
                  Aucun coup legal detecte dans cet etat.
                </p>
              ) : (
                legalMoves.map((move, idx) => (
                  <button
                    key={`${move.type}-${idx}`}
                    type="button"
                    data-testid={`practice-ai-move-${idx}`}
                    disabled={loop.running}
                    onClick={() => handleApplyUserMove(move)}
                    className="w-full text-left text-xs px-3 py-1.5 rounded border border-nuffle-bronze/20 hover:border-purple-300 hover:bg-purple-50/40 font-body disabled:opacity-50"
                  >
                    {summarizeMove(move)}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {appliedMoves.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-subtitle font-semibold text-nuffle-anthracite/70 uppercase tracking-wide">
              Historique recent
            </div>
            <ul className="text-[11px] font-mono text-nuffle-anthracite/70 bg-nuffle-anthracite/5 rounded p-2 space-y-0.5 max-h-32 overflow-y-auto">
              {appliedMoves.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
