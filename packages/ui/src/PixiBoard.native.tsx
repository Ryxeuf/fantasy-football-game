import * as React from 'react';
import Svg, { Rect, Line, G, Text as SvgText, Circle } from 'react-native-svg';
import type { GameState, Position } from '@bb/game-engine';
import { GestureResponderEvent } from 'react-native';

type Props = {
  state: GameState;
  onCellClick?: (pos: Position) => void;
  cellSize?: number;
  legalMoves?: Position[];
  selectedPlayerId?: string | null;
};

export default function PixiBoardNative({
  state,
  onCellClick,
  cellSize = 28,
  legalMoves = [],
  selectedPlayerId,
}: Props) {
  const width = state.width * cellSize;
  const height = state.height * cellSize;

  const handlePress = (e: GestureResponderEvent) => {
    if (!onCellClick) return;
    const x = Math.floor(e.nativeEvent.locationX / cellSize);
    const y = Math.floor(e.nativeEvent.locationY / cellSize);
    if (x >= 0 && y >= 0 && x < state.width && y < state.height) {
      onCellClick({ x, y });
    }
  };

  const grid: React.ReactNode[] = [];
  for (let x = 0; x <= state.width; x++) {
    grid.push(
      <Line
        key={`v-${x}`}
        x1={x * cellSize}
        y1={0}
        x2={x * cellSize}
        y2={height}
        stroke="#ccc"
        strokeWidth={1}
      />
    );
  }
  for (let y = 0; y <= state.height; y++) {
    grid.push(
      <Line
        key={`h-${y}`}
        x1={0}
        y1={y * cellSize}
        x2={width}
        y2={y * cellSize}
        stroke="#ccc"
        strokeWidth={1}
      />
    );
  }

  return (
    <Svg width={width} height={height} onPress={handlePress}>
      <G>{grid}</G>
      {/* legal moves */}
      {legalMoves.map((m) => (
        <Rect
          key={`lm-${m.x}-${m.y}`}
          x={m.x * cellSize}
          y={m.y * cellSize}
          width={cellSize}
          height={cellSize}
          fill="rgba(34,197,94,0.35)"
        />
      ))}
      {/* ball */}
      {state.ball && (
        <Circle
          cx={state.ball.x * cellSize + cellSize / 2}
          cy={state.ball.y * cellSize + cellSize / 2}
          r={cellSize * 0.25}
          fill="#222"
        />
      )}
      {/* players */}
      {state.players.map((p) => (
        <G key={p.id}>
          {p.id === selectedPlayerId && (
            <Rect
              x={p.pos.x * cellSize + cellSize * 0.1}
              y={p.pos.y * cellSize + cellSize * 0.1}
              width={cellSize * 0.8}
              height={cellSize * 0.8}
              stroke="#facc15"
              strokeWidth={2}
            />
          )}
          <Rect
            x={p.pos.x * cellSize + cellSize * 0.1}
            y={p.pos.y * cellSize + cellSize * 0.1}
            width={cellSize * 0.8}
            height={cellSize * 0.8}
            fill={p.team === 'A' ? '#3B82F6' : '#EF4444'}
          />
          <SvgText
            x={p.pos.x * cellSize + cellSize * 0.3}
            y={p.pos.y * cellSize + cellSize * 0.6}
            fontSize={12}
            fill="#fff"
          >
            {p.team}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}
