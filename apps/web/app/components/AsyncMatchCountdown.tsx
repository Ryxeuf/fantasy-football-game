"use client";

/**
 * Sprint R — Lot R.E.2 : composant countdown async match.
 *
 * Poll GET /match/:id/async-status toutes les 30s. Affiche :
 *   - Badge "Ton tour" si isYourTurn (couleur emerald)
 *   - Countdown "X h Y min restantes" si async + not your turn
 *   - "Deadline depassee" si isDeadlineExpired (rouge)
 *   - Rien (composant retourne null) si match realtime ou inexistant.
 *
 * Pas de WebSocket — on poll simplement. Pour les async matches,
 * 30s est tres conservateur (deadline = heures, pas secondes).
 */

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../lib/api-client";

interface AsyncMatchStatus {
  readonly matchId: string;
  readonly mode: "realtime" | "async";
  readonly status: string;
  readonly currentTurnUserId: string | null;
  readonly currentTurnDeadline: string | null;
  readonly turnDeadlineHours: number;
  readonly hoursRemaining: number | null;
  readonly isYourTurn: boolean;
  readonly isDeadlineExpired: boolean;
}

interface AsyncMatchCountdownProps {
  readonly matchId: string;
  /** Tick interval en ms. Default 30s. */
  readonly pollIntervalMs?: number;
  /** Affiche aussi en mode realtime (default false : composant retourne null). */
  readonly showInRealtime?: boolean;
}

function formatRemaining(hoursRemaining: number): string {
  if (hoursRemaining <= 0) return "0 min";
  const totalMinutes = Math.round(hoursRemaining * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes} min`;
}

export function AsyncMatchCountdown(
  props: AsyncMatchCountdownProps,
): JSX.Element | null {
  const { matchId, pollIntervalMs = 30_000, showInRealtime = false } = props;
  const [status, setStatus] = useState<AsyncMatchStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus(): Promise<void> {
      try {
        const result = await apiRequest<{ data: AsyncMatchStatus } | AsyncMatchStatus>(
          `/match/${encodeURIComponent(matchId)}/async-status`,
        );
        // sendSuccess wrapper retourne { data: ... } sometimes.
        const view: AsyncMatchStatus =
          (result as { data?: AsyncMatchStatus }).data ?? (result as AsyncMatchStatus);
        if (!cancelled) setStatus(view);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur reseau");
        }
      }
    }
    void fetchStatus();
    const id = setInterval(fetchStatus, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [matchId, pollIntervalMs]);

  const remaining = useMemo(
    () =>
      status?.hoursRemaining !== null && status?.hoursRemaining !== undefined
        ? formatRemaining(status.hoursRemaining)
        : null,
    [status?.hoursRemaining],
  );

  if (error) {
    return (
      <span
        data-testid="async-countdown-error"
        className="text-xs text-red-400"
      >
        {error}
      </span>
    );
  }
  if (!status) return null;
  if (status.mode === "realtime" && !showInRealtime) return null;
  if (status.status !== "active") return null;

  if (status.isDeadlineExpired) {
    return (
      <span
        data-testid="async-countdown-expired"
        className="rounded bg-red-900/40 px-2 py-0.5 text-xs text-red-200"
      >
        Deadline depassee
      </span>
    );
  }

  if (status.isYourTurn) {
    return (
      <span
        data-testid="async-countdown-your-turn"
        className="rounded bg-emerald-900/40 px-2 py-0.5 text-xs text-emerald-200"
      >
        A toi de jouer ({remaining ?? "—"})
      </span>
    );
  }

  return (
    <span
      data-testid="async-countdown-waiting"
      className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300"
    >
      Tour adverse — {remaining ?? "—"} restantes
    </span>
  );
}
