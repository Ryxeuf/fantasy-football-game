// React hook wiring expo-notifications with the server push API.
// The pure/testable helpers live in ./expo-push.ts; this file contains the
// platform glue that depends on native modules and cannot run under vitest.

import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { apiPost } from "./api";
import {
  isExpoPushToken,
  parseNotificationData,
  resolveNavigationRoute,
} from "./expo-push";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

async function requestPermissions(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === "granted") return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

async function getTokenOrNull(): Promise<string | null> {
  try {
    const res = await Notifications.getExpoPushTokenAsync();
    return isExpoPushToken(res.data) ? res.data : null;
  } catch {
    return null;
  }
}

type PlatformOption = "ios" | "android" | "web";

function currentPlatform(): PlatformOption {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

export interface ExpoPushRegistrationOptions {
  enabled: boolean;
  onNavigate?: (path: string) => void;
}

export function useExpoPushRegistration({
  enabled,
  onNavigate,
}: ExpoPushRegistrationOptions): void {
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (Platform.OS === "web") return;

    let cancelled = false;

    (async () => {
      try {
        await ensureAndroidChannel();
        const granted = await requestPermissions();
        if (!granted || cancelled) return;
        const token = await getTokenOrNull();
        if (!token || cancelled) return;
        tokenRef.current = token;
        await apiPost("/push/expo-subscribe", {
          token,
          platform: currentPlatform(),
        });
      } catch {
        // Registration is best-effort; silently ignore failures.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!onNavigate) return;
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = parseNotificationData(
          response.notification.request.content.data,
        );
        const route = resolveNavigationRoute(data);
        if (route) onNavigate(route);
      },
    );
    return () => sub.remove();
  }, [onNavigate]);
}

export async function unregisterExpoPush(token: string): Promise<void> {
  try {
    await apiPost("/push/expo-unsubscribe", { token });
  } catch {
    // Ignore — best effort
  }
}
