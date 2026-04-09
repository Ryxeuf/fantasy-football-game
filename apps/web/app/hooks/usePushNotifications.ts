"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { API_BASE } from "../auth-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PushNotificationState {
  /** Whether the browser supports push notifications */
  supported: boolean;
  /** Current Notification permission ("default" | "granted" | "denied") */
  permission: NotificationPermission | "unsupported";
  /** Whether a push subscription is active */
  subscribed: boolean;
  /** Subscribe to push notifications (requests permission if needed) */
  subscribe: () => Promise<void>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<void>;
  /** Loading state during subscribe/unsubscribe */
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/push/vapid-public-key`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.key || null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePushNotifications(): PushNotificationState {
  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    supported ? Notification.permission : "unsupported",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Register the service worker on mount
  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        registrationRef.current = reg;
        // Check if already subscribed
        return reg.pushManager.getSubscription();
      })
      .then((sub) => {
        setSubscribed(sub !== null);
      })
      .catch(() => {
        // Service worker registration failed — not critical
      });
  }, [supported]);

  // Sync permission changes
  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission);
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !registrationRef.current) return;
    setLoading(true);
    try {
      // Request notification permission if not yet granted
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") return;
      } else if (Notification.permission === "denied") {
        return;
      }

      // Get VAPID public key from server
      const vapidKey = await fetchVapidPublicKey();
      if (!vapidKey) return;

      // Subscribe via the Push API
      const sub = await registrationRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      // Send subscription to server
      const token = getAuthToken();
      if (!token) return;

      const jsonSub = sub.toJSON();
      await fetch(`${API_BASE}/push/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: jsonSub.endpoint,
          keys: {
            p256dh: jsonSub.keys?.p256dh || "",
            auth: jsonSub.keys?.auth || "",
          },
        }),
      });

      setSubscribed(true);
    } catch {
      // Subscription failed
    } finally {
      setLoading(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported || !registrationRef.current) return;
    setLoading(true);
    try {
      const sub = await registrationRef.current.pushManager.getSubscription();
      if (!sub) {
        setSubscribed(false);
        return;
      }

      // Unsubscribe from the Push API
      await sub.unsubscribe();

      // Notify the server
      const token = getAuthToken();
      if (token) {
        await fetch(`${API_BASE}/push/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }

      setSubscribed(false);
    } catch {
      // Unsubscribe failed
    } finally {
      setLoading(false);
    }
  }, [supported]);

  return {
    supported,
    permission,
    subscribed,
    subscribe,
    unsubscribe,
    loading,
  };
}
