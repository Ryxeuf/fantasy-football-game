"use client";

import { useEffect, useState, useCallback } from "react";
import { API_BASE } from "../auth-client";

// Réengagement — Phase B : opt-in au digest e-mail hebdomadaire (RGPD).

interface EmailDigestPreferenceState {
  enabled: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setEnabled: (enabled: boolean) => Promise<void>;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("auth_token");
}

export function useEmailDigestPreference(): EmailDigestPreferenceState {
  const [enabled, setEnabledState] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch(`${API_BASE}/email/digest-preference`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Erreur chargement preference");
        return res.json();
      })
      .then((data: { enabled: boolean }) => {
        setEnabledState(Boolean(data.enabled));
      })
      .catch(() => {
        // Defaults to disabled on error (opt-in).
      })
      .finally(() => setLoading(false));
  }, []);

  const setEnabled = useCallback(async (next: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) throw new Error("Non authentifie");
      const res = await fetch(`${API_BASE}/email/digest-preference`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error("Erreur sauvegarde preference");
      const data: { enabled: boolean } = await res.json();
      setEnabledState(Boolean(data.enabled));
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Erreur sauvegarde preference";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, []);

  return { enabled, loading, saving, error, setEnabled };
}
