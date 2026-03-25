import { Stack } from "expo-router";
export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Nuffle Arena" }} />
      <Stack.Screen name="login" options={{ title: "Connexion" }} />
      <Stack.Screen name="register" options={{ title: "Inscription" }} />
    </Stack>
  );
}
