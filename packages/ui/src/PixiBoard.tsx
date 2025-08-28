'use client';
import * as React from "react";
import { Stage, Container, Graphics, Text as PixiText } from "@pixi/react";
import type { GameState, Position } from "@bb/game-engine";

type Props = {
  state: GameState;
  onCellClick?: (pos: Position) => void;
  cellSize?: number;
};

export default function PixiBoard({ state, onCellClick, cellSize = 28 }: Props) {
  const width = state.width * cellSize;
  const height = state.height * cellSize;

  // Pointer -> grid cell
  const handlePointerDown = (e: any) => {
    if (!onCellClick) return;
    const x = Math.floor(e.nativeEvent.offsetX / cellSize);
    const y = Math.floor(e.nativeEvent.offsetY / cellSize);
    if (x >= 0 && y >= 0 && x < state.width && y < state.height) {
      onCellClick({ x, y });
    }
  };

  return (
    <div style={{ display: 'inline-block', background: 'white', borderRadius: 8, border: '1px solid #ddd' }} onPointerDown={handlePointerDown}>
      <Stage width={width} height={height} options={{ backgroundAlpha: 0 }}>
        <Container>
          {/* Grid */}
          <Graphics
            draw={g => {
              g.clear();
              g.lineStyle(1, 0xCCCCCC, 1);
              for (let x = 0; x <= state.width; x++) {
                g.moveTo(x * cellSize + 0.5, 0);
                g.lineTo(x * cellSize + 0.5, height);
              }
              for (let y = 0; y <= state.height; y++) {
                g.moveTo(0, y * cellSize + 0.5);
                g.lineTo(width, y * cellSize + 0.5);
              }
            }}
          />
          {/* Ball */}
          {state.ball && (
            <Graphics
              draw={g => {
                g.clear();
                g.beginFill(0x222222);
                g.drawCircle(
                  state.ball!.x * cellSize + cellSize / 2,
                  state.ball!.y * cellSize + cellSize / 2,
                  cellSize * 0.25
                );
                g.endFill();
              }}
            />
          )}
          {/* Players */}
          <Graphics
            draw={g => {
              g.clear();
              for (const p of state.players) {
                const cx = p.pos.x * cellSize + cellSize / 2;
                const cy = p.pos.y * cellSize + cellSize / 2;
                const color = p.team === "A" ? 0x3B82F6 : 0xEF4444; // blue / red
                g.beginFill(color);
                g.drawRoundedRect(cx - cellSize * 0.4, cy - cellSize * 0.4, cellSize * 0.8, cellSize * 0.8, 6);
                g.endFill();
              }
            }}
          />
          {/* Labels */}
          {state.players.map((p, i) => (
            <PixiText
              key={p.id}
              text={p.team}
              x={p.pos.x * cellSize + cellSize / 2 - 5}
              y={p.pos.y * cellSize + cellSize / 2 - 8}
              style={{ fontFamily: 'monospace', fontSize: 12, fill: 0xFFFFFF }}
            />
          ))}
        </Container>
      </Stage>
    </div>
  );
}
