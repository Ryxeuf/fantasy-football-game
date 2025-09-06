import * as React from "react";
import type { GameState, Position, Player } from "@bb/game-engine";

function keyPos(p: Position) { return `${p.x},${p.y}`; }

export function Board({ state, onCellClick }: {
  state: GameState;
  onCellClick?: (pos: Position) => void;
}) {
  const { width, height, players, ball } = state;
  const occ = new Map(players.map(p => [keyPos(p.pos), p] as const));
  const rows = [];
  for (let y=0; y<height; y++) {
    const cells = [];
    for (let x=0; x<width; x++) {
      const p = occ.get(`${x},${y}`);
      const isBall = ball && ball.x === x && ball.y === y;
      cells.push(
        <div
          key={x}
          onClick={() => onCellClick?.({x,y})}
          className="w-6 h-6 border border-neutral-300 flex items-center justify-center text-[10px] select-none hover:bg-neutral-200 cursor-pointer"
          title={`(${x},${y})`}
        >
          {p ? (p.team === "A" ? "A" : "B") : (isBall ? "●" : "")}
        </div>
      );
    }
    rows.push(<div key={y} className="flex flex-row">{cells}</div>);
  }
  return <div className="inline-block">{rows}</div>;
}

export { default as PixiBoard } from './PixiBoard';
export { default as PlayerDetails } from './PlayerDetails';
export { default as DiceResultPopup } from './DiceResultPopup';
export { default as GameScoreboard } from './GameScoreboard';
export { default as GameLog } from './GameLog';
