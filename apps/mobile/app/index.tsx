import { View, Text, Pressable } from "react-native";
import { useState, useMemo } from "react";
import { PixiBoard } from "@bb/ui";
import { setup, getLegalMoves, applyMove, makeRNG, type Position } from "@bb/game-engine";

export default function Home() {
  const [state, setState] = useState(setup());
  const rng = makeRNG("mobile-seed");
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
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:12, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>BlooBowl – Mobile MVP</Text>
      <PixiBoard
        state={state}
        onCellClick={onCellClick}
        legalMoves={movesForSelected}
        selectedPlayerId={selected}
      />
      <Text>Tour: {state.turn} • Équipe: {state.currentPlayer}</Text>
      <Pressable
        onPress={() => setState(s => applyMove(s, { type: "END_TURN" }, rng))}
        style={{ padding: 12, borderRadius: 8, borderWidth:1 }}
      >
        <Text>Fin du tour</Text>
      </Pressable>
    </View>
  );
}
