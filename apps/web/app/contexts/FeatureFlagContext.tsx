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
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!token) {
      setFlags(new Set());
      setLoading(false);
      return;
    }
    try {
      const keys = await fetchMyFlags();
      setFlags(new Set(keys));
    } catch (error: unknown) {
      // L'utilisateur n'est peut-être pas connecté ou le token est expiré —
      // on reste silencieux et on renvoie un set vide.
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
