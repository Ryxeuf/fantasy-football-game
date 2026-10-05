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
import { apiRequest } from "../lib/api-client";
import { getAuthToken } from "../lib/auth-storage";
import { CROWNS_FLAG } from "../lib/featureFlagKeys";
import { useFeatureFlagOrOff } from "../hooks/useFeatureFlag";

/** Une opération du journal des Crowns (`ProTransaction`). */
export interface CrownsTransaction {
  readonly id: string;
  readonly type: string;
  /** Signé : négatif pour une dépense. */
  readonly amount: number;
  readonly ref: string | null;
  readonly createdAt: string;
}

/** Réponse de `GET /crowns/me`. */
export interface CrownsResponse {
  readonly balance: number;
  readonly transactions: readonly CrownsTransaction[];
}

export interface CrownsContextValue {
  /** Faux quand le flag `crowns` est OFF : rien ne s'affiche, rien ne s'achète. */
  readonly enabled: boolean;
  readonly loading: boolean;
  /** Vrai si le dernier chargement du solde a échoué. */
  readonly error: boolean;
  /** `null` tant que non chargé (ou visiteur anonyme). */
  readonly balance: number | null;
  readonly transactions: readonly CrownsTransaction[];
  readonly refresh: () => Promise<void>;
  /** Applique un solde connu (réponse d'un achat) sans requête. */
  readonly applyBalance: (balance: number) => void;
}

const DEFAULT_VALUE: CrownsContextValue = {
  enabled: false,
  loading: false,
  error: false,
  balance: null,
  transactions: [],
  refresh: async () => {},
  applyBalance: () => {},
};

const CrownsContext = createContext<CrownsContextValue | null>(null);

/**
 * Couronnes (Crowns) du coach connecté : solde + historique récent.
 *
 * Flag `crowns` OFF, ou visiteur anonyme : rien n'est chargé, `balance`
 * reste `null` et l'UI masque toute mention des Crowns.
 */
export function CrownsProvider({ children }: { children: ReactNode }) {
  const enabled = useFeatureFlagOrOff(CROWNS_FLAG);
  const [data, setData] = useState<CrownsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !getAuthToken()) {
      setData(null);
      setError(false);
      return;
    }
    setLoading(true);
    try {
      setData(await apiRequest<CrownsResponse>("/crowns/me"));
      setError(false);
    } catch {
      setData(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyBalance = useCallback((balance: number) => {
    setData((prev) => ({ balance, transactions: prev?.transactions ?? [] }));
  }, []);

  const value = useMemo<CrownsContextValue>(
    () => ({
      enabled,
      loading,
      error: enabled && error,
      balance: enabled ? data?.balance ?? null : null,
      transactions: enabled ? data?.transactions ?? [] : [],
      refresh: load,
      applyBalance,
    }),
    [enabled, loading, error, data, load, applyBalance],
  );

  return <CrownsContext.Provider value={value}>{children}</CrownsContext.Provider>;
}

/** Crowns du coach ; no-op (rien d'affiché) hors provider. */
export function useCrowns(): CrownsContextValue {
  return useContext(CrownsContext) ?? DEFAULT_VALUE;
}
