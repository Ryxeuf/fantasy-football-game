"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchMyFlags } from "../lib/featureFlags";

interface FeatureFlagContextValue {
  flags: Set<string>;
  loading: boolean;
  refresh: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | undefined>(
  undefined,
);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    // /api/feature-flags/me accepte les visiteurs anonymes : il retourne
    // les flags globalement activés (et tous les flags si
    // FEATURE_FLAGS_FORCE_ENABLED=true côté serveur). On l'appelle donc
    // même sans `auth_token` pour que les pages publiques (/leaderboard,
    // /play en mode discovery, etc.) reçoivent l'autorisation correcte.
    try {
      const keys = await fetchMyFlags();
      setFlags(new Set(keys));
    } catch (error: unknown) {
      // L'API peut échouer (réseau, token expiré 401) — on reste silencieux
      // et on renvoie un set vide pour ne pas bloquer la page.
      setFlags(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<FeatureFlagContextValue>(
    () => ({ flags, loading, refresh }),
    [flags, loading, refresh],
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlagContext(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) {
    throw new Error(
      "useFeatureFlagContext doit être utilisé dans un FeatureFlagProvider",
    );
  }
  return ctx;
}
