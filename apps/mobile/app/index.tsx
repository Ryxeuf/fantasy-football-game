import { View, Text, Pressable } from "react-native";
import { useState } from "react";
import { setup, getLegalMoves, applyMove, makeRNG } from "@bb/game-engine";

export default function Home() {
  const [state, setState] = useState(setup());
  const rng = makeRNG("mobile-seed");
  const legal = getLegalMoves(state);
  return (
    <View style={{ flex:1, alignItems:'center', justifyContent:'center', gap:12, padding: 24 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>BlooBowl – Mobile MVP</Text>
      <Text>Tour: {state.turn} • Équipe: {state.currentPlayer}</Text>
      <Pressable
        onPress={() => setState(s => applyMove(s, { type: "END_TURN" }, rng))}
        style={{ padding: 12, borderRadius: 8, borderWidth:1 }}
      >
        <Text>Fin du tour</Text>
      </Pressable>
      <Text style={{ opacity: 0.7 }}>UI plateau à venir (Pixi/Canvas RN).</Text>
    </View>
  );
}
