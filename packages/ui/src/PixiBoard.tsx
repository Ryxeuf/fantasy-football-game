'use client';
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Container,
  Graphics,
  Text as PixiText,
  Sprite,
} from "@pixi/react";
import { Texture } from "@pixi/core";
import type { Graphics as PixiGraphics } from "@pixi/graphics";
import { TextStyle } from "@pixi/text";
import type { GameState, Position } from "@bb/game-engine";

type Props = {
  state: GameState;
  onCellClick?: (pos: Position) => void;
  cellSize?: number;
  legalMoves?: Position[];
  selectedPlayerId?: string | null;
};

export default function PixiBoard({
  state,
  onCellClick,
  cellSize = 28,
  legalMoves = [],
  selectedPlayerId,
}: Props) {
  const width = state.width * cellSize;
  const height = state.height * cellSize;

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number }>();
  const isDragging = useRef(false);

  const clampOffset = React.useCallback(
    (x: number, y: number) => {
      const minX = width - width * scale;
      const minY = height - height * scale;
      return {
        x: Math.min(0, Math.max(minX, x)),
        y: Math.min(0, Math.max(minY, y)),
      };
    },
    [width, height, scale]
  );

  const handlePointerDown = (e: any) => {
    if (e.button === 2) {
      isDragging.current = true;
      dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }
    if (!onCellClick) return;
    const px = (e.nativeEvent.offsetX - offset.x) / scale;
    const py = (e.nativeEvent.offsetY - offset.y) / scale;
    const x = Math.floor(px / cellSize);
    const y = Math.floor(py / cellSize);
    if (x >= 0 && y >= 0 && x < state.width && y < state.height) {
      onCellClick({ x, y });
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDragging.current) return;
    const ds = dragStart.current!;
    const x = ds.ox + (e.clientX - ds.x);
    const y = ds.oy + (e.clientY - ds.y);
    setOffset(clampOffset(x, y));
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: any) => {
    const next = Math.min(2, Math.max(0.5, scale + e.deltaY * -0.001));
    setScale(next);
    setOffset((o) => clampOffset(o.x, o.y));
  };

  return (
    <div
      style={{ display: "inline-block", background: "white", borderRadius: 8, border: "1px solid #ddd" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Stage width={width} height={height} options={{ backgroundAlpha: 0 }}>
        <Container scale={scale} x={offset.x} y={offset.y}>
          {/* Grid */}
          <Graphics
            draw={(g: PixiGraphics) => {
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
              draw={(g: PixiGraphics) => {
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
          {/* Highlight legal moves */}
          {legalMoves.map((m) => (
            <Graphics
              key={`lm-${m.x}-${m.y}`}
              draw={(g: PixiGraphics) => {
                g.clear();
                g.beginFill(0x22c55e, 0.35);
                g.drawRect(m.x * cellSize, m.y * cellSize, cellSize, cellSize);
                g.endFill();
              }}
            />
          ))}
          {/* Players */}
          {state.players.map((p) => (
            <PlayerSprite
              key={p.id}
              player={p}
              cellSize={cellSize}
              selected={p.id === selectedPlayerId}
            />
          ))}
        </Container>
      </Stage>
    </div>
  );
}

type PlayerSpriteProps = {
  player: GameState["players"][number];
  cellSize: number;
  selected?: boolean;
};

function PlayerSprite({ player, cellSize, selected }: PlayerSpriteProps) {
  const [pos, setPos] = useState({ x: player.pos.x, y: player.pos.y });
  const prev = useRef(pos);

  useEffect(() => {
    const from = prev.current;
    const to = player.pos;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / 200);
      setPos({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
      if (t < 1) requestAnimationFrame(animate);
      else prev.current = { ...to };
    };
    requestAnimationFrame(animate);
  }, [player.pos.x, player.pos.y]);

  const color = player.team === "A" ? 0x3B82F6 : 0xEF4444;

  return (
    <Container x={pos.x * cellSize} y={pos.y * cellSize}>
      {selected && (
        <Graphics
          draw={(g: PixiGraphics) => {
            g.clear();
            g.lineStyle(2, 0xFACC15);
            g.drawRoundedRect(cellSize * 0.1, cellSize * 0.1, cellSize * 0.8, cellSize * 0.8, 6);
          }}
        />
      )}
      <Sprite
        texture={Texture.WHITE}
        width={cellSize * 0.8}
        height={cellSize * 0.8}
        tint={color}
        x={cellSize * 0.1}
        y={cellSize * 0.1}
      />
      <PixiText
        text={player.team}
        x={cellSize * 0.3}
        y={cellSize * 0.3}
        style={new TextStyle({ fontFamily: "monospace", fontSize: 12, fill: 0xffffff as any })}
      />
    </Container>
  );
}
