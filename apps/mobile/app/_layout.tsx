import { Stack, useRouter } from "expo-router";
import { useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { useExpoPushRegistration } from "../lib/use-expo-push";

function PushRegistration() {
  const { user } = useAuth();
  const router = useRouter();
  const handleNavigate = useCallback(
    (path: string) => {
      // expo-router accepts relative/absolute paths; cast only because the
      // generic signature expects a typed route union.
      router.push(path as never);
    },
    [router],
  );
  useExpoPushRegistration({
    enabled: user !== null,
    onNavigate: handleNavigate,
  });
  return null;
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PushRegistration />
        <Stack>
          <Stack.Screen name="index" options={{ title: "Nuffle Arena" }} />
          <Stack.Screen name="lobby" options={{ title: "Mes matchs" }} />
          <Stack.Screen
            name="matchmaking"
            options={{ title: "Chercher un match" }}
          />
          <Stack.Screen name="leaderboard" options={{ title: "Classement" }} />
          <Stack.Screen name="login" options={{ title: "Connexion" }} />
          <Stack.Screen name="register" options={{ title: "Inscription" }} />
          <Stack.Screen
            name="match/[id]"
            options={{ title: "Historique du match", headerShown: false }}
          />
          <Stack.Screen
            name="replay/[id]"
            options={{ title: "Replay", headerShown: false }}
          />
          <Stack.Screen name="teams/index" options={{ title: "Mes equipes" }} />
          <Stack.Screen
            name="teams/new"
            options={{ title: "Nouvelle equipe" }}
          />
          <Stack.Screen
            name="teams/[id]"
            options={{ title: "Detail equipe" }}
          />
          <Stack.Screen name="cups/index" options={{ title: "Coupes" }} />
          <Stack.Screen
            name="cups/archived"
            options={{ title: "Coupes archivees" }}
          />
          <Stack.Screen
            name="cups/[id]"
            options={{ title: "Detail coupe" }}
          />
          <Stack.Screen name="leagues/index" options={{ title: "Ligues" }} />
          <Stack.Screen
            name="leagues/[id]"
            options={{ title: "Detail ligue" }}
          />
          <Stack.Screen
            name="star-players/index"
            options={{ title: "Star Players" }}
          />
          <Stack.Screen
            name="star-players/[slug]"
            options={{ title: "Detail Star Player" }}
          />
          <Stack.Screen
            name="settings"
            options={{ title: "Profil et reglages" }}
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
