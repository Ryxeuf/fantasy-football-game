"use client";

import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../auth-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  pushEnabled: boolean;
  turnNotification: boolean;
  matchFoundNotification: boolean;
}

interface NotificationPreferencesState {
  preferences: NotificationPreferences;
  loading: boolean;
  saving: boolean;
  error: string | null;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => Promise<void>;
}

const DEFAULTS: NotificationPreferences = {
  pushEnabled: true,
  turnNotification: true,
  matchFoundNotification: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotificationPreferences(): NotificationPreferencesState {
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch preferences on mount
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/push/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erreur chargement preferences");
        return res.json();
      })
      .then((data: NotificationPreferences) => {
        setPreferences(data);
      })
      .catch(() => {
        // Use defaults on error
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const updatePreferences = useCallback(
    async (partial: Partial<NotificationPreferences>) => {
      setSaving(true);
      setError(null);
      try {
        const token = getAuthToken();
        if (!token) throw new Error("Non authentifie");

        const res = await fetch(`${API_BASE}/push/preferences`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(partial),
        });

        if (!res.ok) throw new Error("Erreur sauvegarde preferences");

        const data: NotificationPreferences = await res.json();
        setPreferences(data);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : "Erreur sauvegarde preferences";
        setError(message);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  return { preferences, loading, saving, error, updatePreferences };
}
