import { View, Text, Pressable } from "react-native";
import { useState, useMemo } from "react";
import { PixiBoard } from "@bb/ui";
import {
  setup,
  getLegalMoves,
  applyMove,
  makeRNG,
  type Position,
} from "@bb/game-engine";

export default function Home() {
  const [state, setState] = useState(setup());
  const rng = makeRNG("mobile-seed");
  const legal = useMemo(() => getLegalMoves(state), [state]);
  const movesForSelected = useMemo(
    () =>
      state.selectedPlayerId
        ? legal
            .filter(
              (m) => m.type === "MOVE" && m.playerId === state.selectedPlayerId,
            )
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
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "bold" }}>
        Nuffle Arena – Mobile MVP
      </Text>
      <PixiBoard
        state={state}
        onCellClick={onCellClick}
        legalMoves={movesForSelected}
        selectedPlayerId={state.selectedPlayerId}
      />
      <Text>
        Tour: {state.turn} • Équipe: {state.currentPlayer}
      </Text>
      <Pressable
        onPress={() => setState((s) => applyMove(s, { type: "END_TURN" }, rng))}
        style={{ padding: 12, borderRadius: 8, borderWidth: 1 }}
      >
        <Text>Fin du tour</Text>
      </Pressable>
    </View>
  );
}
