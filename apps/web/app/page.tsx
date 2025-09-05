"use client";

import { useMemo, useState } from "react";
import { PixiBoard, PlayerDetails, DiceResultPopup } from "@bb/ui";
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  clearDiceResult,
  type GameState,
  type Position,
  type Move,
  type DiceResult,
} from "@bb/game-engine";

export default function HomePage() {
  const [state, setState] = useState<GameState>(() => setup());
  const [showDicePopup, setShowDicePopup] = useState(false);
  const createRNG = () => makeRNG(`ui-seed-${Date.now()}-${Math.random()}`);

  const legal = useMemo(() => getLegalMoves(state), [state]);
  const isMove = (m: Move, pid: string): m is Extract<Move, { type: "MOVE" }> =>
    m.type === "MOVE" && (m as any).playerId === pid;
  const movesForSelected = useMemo(
    () =>
      state.selectedPlayerId
        ? legal
            .filter((m) => isMove(m, state.selectedPlayerId!))
            .map((m) => m.to)
        : [],
    [legal, state.selectedPlayerId],
  );

  function onCellClick(pos: Position) {
    const player = state.players.find(
      (p) => p.pos.x === pos.x && p.pos.y === pos.y,
    );
    if (player && player.team === state.currentPlayer) {
      setState((s) => ({ ...s, selectedPlayerId: player.id }));
      return;
    }
    if (state.selectedPlayerId) {
      const candidate = legal.find(
        (m) =>
          m.type === "MOVE" &&
          m.playerId === state.selectedPlayerId &&
          m.to.x === pos.x &&
          m.to.y === pos.y,
      );
      if (candidate && candidate.type === "MOVE") {
        setState((s) => {
          const s2 = applyMove(s, candidate, createRNG());
          const p = s2.players.find((pl) => pl.id === candidate.playerId);
          if (!p || p.pm <= 0) s2.selectedPlayerId = null;
          
          // Afficher la popup si un jet de dés a été effectué
          if (s2.lastDiceResult) {
            setShowDicePopup(true);
          }
          
          return s2;
        });
      }
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">BlooBowl – Pixi Renderer</h1>
      <p className="text-sm opacity-80">
        Clique un joueur pour le sélectionner puis une case surbrillée pour le
        déplacer.
      </p>
      <PixiBoard
        state={state}
        onCellClick={onCellClick}
        legalMoves={movesForSelected}
        selectedPlayerId={state.selectedPlayerId}
      />
      {state.selectedPlayerId && (
        <div className="text-sm">
          Joueur sélectionné:{" "}
          <span className="font-mono">{state.selectedPlayerId}</span>
        </div>
      )}
      <div className="text-sm">
        Tour: {state.turn} • Équipe:{" "}
        <span className="font-mono">{state.currentPlayer}</span>
        {state.isTurnover && (
          <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">
            TURNOVER !
          </span>
        )}
      </div>
      <button
        className="px-3 py-2 rounded border bg-white hover:bg-neutral-100 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => setState((s) => applyMove(s, { type: "END_TURN" }, createRNG()))}
      >
        {state.isTurnover ? "Tour terminé (Turnover)" : "Fin du tour"}
      </button>

      {/* Encart des détails du joueur */}
      {state.selectedPlayerId && (
        <PlayerDetails
          player={
            state.players.find((p) => p.id === state.selectedPlayerId) || null
          }
          onClose={() => setState((s) => ({ ...s, selectedPlayerId: null }))}
        />
      )}

      {/* Popup des résultats de jets */}
      {showDicePopup && state.lastDiceResult && (
        <DiceResultPopup
          result={state.lastDiceResult}
          onClose={() => {
            setShowDicePopup(false);
            // Réinitialiser le résultat de dés
            setState((s) => clearDiceResult(s));
            // Si c'est un échec d'esquive ou de pickup, forcer la fin du tour
            if (state.lastDiceResult && !state.lastDiceResult.success && (state.lastDiceResult.type === "dodge" || state.lastDiceResult.type === "pickup")) {
              setState((s) => applyMove(s, { type: "END_TURN" }, createRNG()));
            }
          }}
        />
      )}
    </div>
  );
}
