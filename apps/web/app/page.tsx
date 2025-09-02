"use client";

import { useMemo, useState } from "react";
import { PixiBoard, PlayerDetails } from "@bb/ui";
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  type GameState,
  type Position,
  type Move,
} from "@bb/game-engine";

export default function HomePage() {
  const [state, setState] = useState<GameState>(() => setup());
  const rng = useMemo(() => makeRNG("ui-seed"), []);

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
          const s2 = applyMove(s, candidate, rng);
          const p = s2.players.find((pl) => pl.id === candidate.playerId);
          if (!p || p.pm <= 0) s2.selectedPlayerId = null;
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
      </div>
      <button
        className="px-3 py-2 rounded border bg-white hover:bg-neutral-100"
        onClick={() => setState((s) => applyMove(s, { type: "END_TURN" }, rng))}
      >
        Fin du tour
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
    </div>
  );
}
