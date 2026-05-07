import { Stack, useRouter } from "expo-router";
import { useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../lib/auth-context";
import { LocaleProvider, useTranslation } from "../lib/i18n-context";
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

function AppStack() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: t("nav.appName") }} />
      <Stack.Screen name="lobby" options={{ title: t("nav.lobby") }} />
      <Stack.Screen
        name="matchmaking"
        options={{ title: t("nav.matchmaking") }}
      />
      <Stack.Screen
        name="leaderboard"
        options={{ title: t("nav.leaderboard") }}
      />
      <Stack.Screen name="login" options={{ title: t("nav.login") }} />
      <Stack.Screen name="register" options={{ title: t("nav.register") }} />
      <Stack.Screen
        name="match/[id]"
        options={{ title: t("nav.matchHistory"), headerShown: false }}
      />
      <Stack.Screen
        name="replay/[id]"
        options={{ title: t("nav.replay"), headerShown: false }}
      />
      <Stack.Screen
        name="teams/index"
        options={{ title: t("nav.teamsList") }}
      />
      <Stack.Screen
        name="teams/new"
        options={{ title: t("nav.teamsNew") }}
      />
      <Stack.Screen
        name="teams/[id]"
        options={{ title: t("nav.teamsDetail") }}
      />
      <Stack.Screen name="cups/index" options={{ title: t("nav.cupsList") }} />
      <Stack.Screen
        name="cups/archived"
        options={{ title: t("nav.cupsArchived") }}
      />
      <Stack.Screen
        name="cups/[id]"
        options={{ title: t("nav.cupsDetail") }}
      />
      <Stack.Screen
        name="leagues/index"
        options={{ title: t("nav.leaguesList") }}
      />
      <Stack.Screen
        name="leagues/[id]"
        options={{ title: t("nav.leaguesDetail") }}
      />
      <Stack.Screen
        name="star-players/index"
        options={{ title: t("nav.starPlayersList") }}
      />
      <Stack.Screen
        name="star-players/[slug]"
        options={{ title: t("nav.starPlayersDetail") }}
      />
      <Stack.Screen name="settings" options={{ title: t("nav.settings") }} />
    </Stack>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LocaleProvider>
        <AuthProvider>
          <PushRegistration />
          <AppStack />
        </AuthProvider>
      </LocaleProvider>
    </GestureHandlerRootView>
  );
}
