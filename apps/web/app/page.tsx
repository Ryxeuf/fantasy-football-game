'use client';

import { useMemo, useState } from "react";
import { PixiBoard } from "@bb/ui";
import { setup, getLegalMoves, applyMove, makeRNG, type GameState, type Position } from "@bb/game-engine";

export default function HomePage() {
  const [state, setState] = useState<GameState>(() => setup());
  const rng = useMemo(() => makeRNG("ui-seed"), []);

  const legal = useMemo(() => getLegalMoves(state), [state]);

  function onCellClick(pos: Position) {
    const candidate = legal.find(m => m.type === "MOVE" && m.to.x === pos.x && m.to.y === pos.y);
    if (candidate && candidate.type === "MOVE") {
      setState((s) => applyMove(s, candidate, rng));
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">BlooBowl – Pixi Renderer</h1>
      <p className="text-sm opacity-80">Clique une case adjacente à un joueur de l'équipe courante pour le déplacer.</p>
      <PixiBoard state={state} onCellClick={onCellClick} />
      <div className="text-sm">Tour: {state.turn} • Équipe: <span className="font-mono">{state.currentPlayer}</span></div>
      <button
        className="px-3 py-2 rounded border bg-white hover:bg-neutral-100"
        onClick={() => setState((s) => applyMove(s, { type: "END_TURN" }, rng))}
      >
        Fin du tour
      </button>
    </div>
  );
}
