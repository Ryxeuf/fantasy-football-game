import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "../lib/auth-context";

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: "Nuffle Arena" }} />
          <Stack.Screen name="lobby" options={{ title: "Mes matchs" }} />
          <Stack.Screen name="matchmaking" options={{ title: "Chercher un match" }} />
          <Stack.Screen name="login" options={{ title: "Connexion" }} />
          <Stack.Screen name="register" options={{ title: "Inscription" }} />
          <Stack.Screen name="match/[id]" options={{ title: "Historique du match", headerShown: false }} />
          <Stack.Screen name="teams/index" options={{ title: "Mes equipes" }} />
          <Stack.Screen name="teams/new" options={{ title: "Nouvelle equipe" }} />
          <Stack.Screen name="teams/[id]" options={{ title: "Detail equipe" }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
