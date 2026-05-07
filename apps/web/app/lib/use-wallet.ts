"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiClientError, apiRequest } from "./api-client";

/**
 * Hook React qui gère l'état du wallet Pro League : balance + statut
 * du daily bonus + transactions récentes — sprint Pro League lot 1.D.7.
 *
 * `authed` est `false` si l'API renvoie 401 (visiteur anonyme) — l'UI
 * peut alors masquer les composants paris ou inviter à login.
 */

export interface ProTransactionEntry {
  readonly id: string;
  readonly type: "BET" | "WIN" | "REWARD" | "DAILY" | "BADGE";
  readonly amount: number;
  readonly ref: string | null;
  readonly createdAt: string;
}

export interface UseWalletResult {
  readonly authed: boolean;
  readonly loading: boolean;
  readonly balance: number;
  readonly transactions: readonly ProTransactionEntry[];
  readonly dailyAvailable: boolean;
  readonly dailyNextEligibleAt: string | null;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
  readonly claimDaily: () => Promise<{ granted: boolean; amount: number }>;
  readonly grantFirstTime: () => Promise<{ granted: boolean; amount: number }>;
}

interface WalletSnapshot {
  readonly balance: number;
  readonly transactions: readonly ProTransactionEntry[];
}

interface DailyStatus {
  readonly available: boolean;
  readonly nextEligibleAt: string | null;
}

interface BonusOutcome {
  readonly granted: boolean;
  readonly amount: number;
  readonly balance: number;
  readonly nextEligibleAt: string | null;
}

export function useWallet(): UseWalletResult {
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<readonly ProTransactionEntry[]>(
    [],
  );
  const [dailyAvailable, setDailyAvailable] = useState(false);
  const [dailyNextEligibleAt, setDailyNextEligibleAt] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [snap, daily] = await Promise.all([
        apiRequest<WalletSnapshot>("/pro-league/me/wallet"),
        apiRequest<DailyStatus>("/pro-league/me/wallet/daily-bonus"),
      ]);
      setAuthed(true);
      setBalance(snap.balance);
      setTransactions(snap.transactions);
      setDailyAvailable(daily.available);
      setDailyNextEligibleAt(daily.nextEligibleAt);
    } catch (e: unknown) {
      if (e instanceof ApiClientError && e.status === 401) {
        setAuthed(false);
        return;
      }
      const msg = e instanceof Error ? e.message : "fetch error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const claimDaily = useCallback(async (): Promise<{
    granted: boolean;
    amount: number;
  }> => {
    setError(null);
    try {
      const out = await apiRequest<BonusOutcome>(
        "/pro-league/me/wallet/daily-bonus",
        { method: "POST" },
      );
      setBalance(out.balance);
      setDailyAvailable(false);
      setDailyNextEligibleAt(out.nextEligibleAt);
      // Refresh transactions list (cheap).
      void refresh();
      return { granted: out.granted, amount: out.amount };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "claim error";
      setError(msg);
      return { granted: false, amount: 0 };
    }
  }, [refresh]);

  const grantFirstTime = useCallback(async (): Promise<{
    granted: boolean;
    amount: number;
  }> => {
    setError(null);
    try {
      const out = await apiRequest<BonusOutcome>(
        "/pro-league/me/wallet/first-time-bonus",
        { method: "POST" },
      );
      setBalance(out.balance);
      void refresh();
      return { granted: out.granted, amount: out.amount };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "claim error";
      setError(msg);
      return { granted: false, amount: 0 };
    }
  }, [refresh]);

  return {
    authed,
    loading,
    balance,
    transactions,
    dailyAvailable,
    dailyNextEligibleAt,
    error,
    refresh,
    claimDaily,
    grantFirstTime,
  };
}
