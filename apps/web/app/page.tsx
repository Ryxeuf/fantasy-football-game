'use client';

import { useMemo, useState } from "react";
import { PixiBoard } from "@bb/ui";
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  type GameState,
  type Position,
} from "@bb/game-engine";

export default function HomePage() {
  const [state, setState] = useState<GameState>(() => setup());
  const rng = useMemo(() => makeRNG("ui-seed"), []);

  const [selected, setSelected] = useState<string | null>(null);

  const legal = useMemo(() => getLegalMoves(state), [state]);
  const movesForSelected = useMemo(
    () =>
      selected
        ? legal.filter((m) => m.type === "MOVE" && m.playerId === selected).map((m) => m.to)
        : [],
    [legal, selected]
  );

  function onCellClick(pos: Position) {
    const player = state.players.find((p) => p.pos.x === pos.x && p.pos.y === pos.y);
    if (player && player.team === state.currentPlayer) {
      setSelected(player.id);
      return;
    }
    if (selected) {
      const candidate = legal.find(
        (m) => m.type === "MOVE" && m.playerId === selected && m.to.x === pos.x && m.to.y === pos.y
      );
      if (candidate && candidate.type === "MOVE") {
        setState((s) => applyMove(s, candidate, rng));
        setSelected(null);
      }
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">BlooBowl – Pixi Renderer</h1>
      <p className="text-sm opacity-80">
        Clique un joueur pour le sélectionner puis une case surbrillée pour le déplacer.
      </p>
      <PixiBoard
        state={state}
        onCellClick={onCellClick}
        legalMoves={movesForSelected}
        selectedPlayerId={selected}
      />
      {selected && (
        <div className="text-sm">
          Joueur sélectionné: <span className="font-mono">{selected}</span>
        </div>
      )}
      <div className="text-sm">
        Tour: {state.turn} • Équipe: <span className="font-mono">{state.currentPlayer}</span>
      </div>
      <button
        className="px-3 py-2 rounded border bg-white hover:bg-neutral-100"
        onClick={() => setState((s) => applyMove(s, { type: "END_TURN" }, rng))}
      >
        Fin du tour
      </button>
    </div>
  );
}
