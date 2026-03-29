import * as React from "react";
import Svg, { Rect, Line, G, Text as SvgText, Circle } from "react-native-svg";
import { View, StyleSheet } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import type { GameState, Position } from "@bb/game-engine";

/* ── Viewport constants ─────────────────────────────────────────────── */
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SPRING_CONFIG = { damping: 20, stiffness: 200 };

type Props = {
  state: GameState;
  onCellClick?: (pos: Position) => void;
  onDeselect?: () => void;
  cellSize?: number;
  legalMoves?: Position[];
  blockTargets?: Position[];
  selectedPlayerId?: string | null;
};

export default function PixiBoardNative({
  state,
  onCellClick,
  onDeselect,
  cellSize = 28,
  legalMoves = [],
  blockTargets = [],
  selectedPlayerId,
}: Props) {
  const boardWidth = state.width * cellSize;
  const boardHeight = state.height * cellSize;

  /* ── Gesture shared values ──────────────────────────────────────── */
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  /* ── Pinch gesture (zoom) ───────────────────────────────────────── */
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    })
    .onEnd(() => {
      // Snap back if zoomed out too far
      if (scale.value < 0.6) {
        scale.value = withSpring(0.6, SPRING_CONFIG);
      }
    });

  /* ── Pan gesture (drag) ─────────────────────────────────────────── */
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd(() => {
      // Clamp translation to prevent the board from going off-screen too much
      const maxPanX = boardWidth * scale.value * 0.5;
      const maxPanY = boardHeight * scale.value * 0.5;
      if (translateX.value > maxPanX) {
        translateX.value = withSpring(maxPanX, SPRING_CONFIG);
      } else if (translateX.value < -maxPanX) {
        translateX.value = withSpring(-maxPanX, SPRING_CONFIG);
      }
      if (translateY.value > maxPanY) {
        translateY.value = withSpring(maxPanY, SPRING_CONFIG);
      } else if (translateY.value < -maxPanY) {
        translateY.value = withSpring(-maxPanY, SPRING_CONFIG);
      }
    });

  /* ── Tap gesture (cell selection) ───────────────────────────────── */
  const handleCellClick = onCellClick;
  const tapGesture = Gesture.Tap().onEnd((event) => {
    if (!handleCellClick) return;
    // Convert screen coordinates to board coordinates accounting for transform
    const tapX = (event.x - translateX.value) / scale.value;
    const tapY = (event.y - translateY.value) / scale.value;
    const gridX = Math.floor(tapX / cellSize);
    const gridY = Math.floor(tapY / cellSize);
    if (gridX >= 0 && gridY >= 0 && gridX < state.width && gridY < state.height) {
      runOnJS(handleCellClick)({ x: gridX, y: gridY });
    }
  });

  /* ── Double-tap to deselect player or reset viewport ─────────── */
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (selectedPlayerId && onDeselect) {
        // Deselect the current player
        runOnJS(onDeselect)();
      } else {
        // Reset viewport
        scale.value = withSpring(1, SPRING_CONFIG);
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
      }
    });

  /* ── Compose gestures ───────────────────────────────────────────── */
  const simultaneousGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const composedGesture = Gesture.Exclusive(
    doubleTapGesture,
    Gesture.Simultaneous(simultaneousGesture, tapGesture),
  );

  /* ── Animated transform style ───────────────────────────────────── */
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  /* ── Board grid lines ───────────────────────────────────────────── */
  const grid: React.ReactNode[] = [];
  for (let x = 0; x <= state.width; x++) {
    grid.push(
      <Line
        key={`v-${x}`}
        x1={x * cellSize}
        y1={0}
        x2={x * cellSize}
        y2={boardHeight}
        stroke="#ccc"
        strokeWidth={1}
      />,
    );
  }
  for (let y = 0; y <= state.height; y++) {
    grid.push(
      <Line
        key={`h-${y}`}
        x1={0}
        y1={y * cellSize}
        x2={boardWidth}
        y2={y * cellSize}
        stroke="#ccc"
        strokeWidth={1}
      />,
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.board, animatedStyle]}>
          <Svg width={boardWidth} height={boardHeight}>
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
                stroke="rgba(34,197,94,0.7)"
                strokeWidth={1}
              />
            ))}
            {/* block targets */}
            {blockTargets.map((t) => (
              <Rect
                key={`bt-${t.x}-${t.y}`}
                x={t.x * cellSize}
                y={t.y * cellSize}
                width={cellSize}
                height={cellSize}
                fill="rgba(239,68,68,0.35)"
                stroke="rgba(239,68,68,0.7)"
                strokeWidth={1}
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
                  <>
                    {/* Outer glow */}
                    <Rect
                      x={p.pos.x * cellSize}
                      y={p.pos.y * cellSize}
                      width={cellSize}
                      height={cellSize}
                      fill="rgba(250,204,21,0.2)"
                      stroke="#facc15"
                      strokeWidth={3}
                      rx={2}
                    />
                  </>
                )}
                <Rect
                  x={p.pos.x * cellSize + cellSize * 0.1}
                  y={p.pos.y * cellSize + cellSize * 0.1}
                  width={cellSize * 0.8}
                  height={cellSize * 0.8}
                  fill={p.team === "A" ? "#3B82F6" : "#EF4444"}
                />
                <SvgText
                  x={p.pos.x * cellSize + cellSize * 0.3}
                  y={p.pos.y * cellSize + cellSize * 0.6}
                  fontSize={12}
                  fill="#fff"
                >
                  {p.team}
                </SvgText>
                {/* Badge PM */}
                <Circle
                  cx={p.pos.x * cellSize + cellSize * 0.8}
                  cy={p.pos.y * cellSize + cellSize * 0.2}
                  r={cellSize * 0.2}
                  fill="#000"
                />
                <SvgText
                  x={p.pos.x * cellSize + cellSize * 0.8}
                  y={p.pos.y * cellSize + cellSize * 0.2 + cellSize * 0.08}
                  fontSize={cellSize * 0.25}
                  fill="#fff"
                  textAnchor="middle"
                >
                  {p.pm}
                </SvgText>
              </G>
            ))}
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  board: {
    alignSelf: "center",
  },
});
