/**
 * Sprint 1.G.3 — Hook auto-redirect entre `/live` et `/replay`.
 *
 * Logique :
 *  - Mode `live` est valide quand :
 *    - `match.status === 'in_progress'`, OU
 *    - `match.status === 'ready'` ET `scheduledAt <= now` (le broadcaster
 *      in-memory streame le replay pre-simule des le kickoff passe ; le
 *      status DB ne fait pas la transition `ready → in_progress`).
 *  - Mode `replay` est valide quand `match.status === 'completed'`.
 *  - Si l'utilisateur arrive sur le mauvais mode, on `router.replace()`
 *    vers le bon URL pour ne pas polluer l'historique.
 *  - Sur un `scheduled` / `ready` (kickoff futur) / `failed` on redirige
 *    vers la page parent `/pro-league/matches/:id` (info pre-match /
 *    erreur).
 *
 * Le hook fait sa propre fetch leger sur `/pro-league/matches/:id` (la
 * route hub renvoie deja le status + scheduledAt).
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "./api-client";

export type MatchMode = "live" | "replay";

interface MinimalMatch {
  readonly id: string;
  readonly status: string;
  readonly scheduledAt: string;
  readonly isTest?: boolean;
}

export interface MatchModeRedirectResult {
  readonly redirecting: boolean;
  readonly status: string | null;
  readonly error: string | null;
  /**
   * Lot 2.C.5 — `true` quand le match est un sandbox lancé depuis
   * l'admin. Permet aux pages live/replay d'afficher un bandeau
   * "TEST MATCH — does not count" sans une fetch séparée.
   */
  readonly isTest: boolean;
}

function isLiveValid(status: string, scheduledAtMs: number, nowMs: number): boolean {
  if (status === "in_progress") return true;
  if (status === "ready" && scheduledAtMs <= nowMs) return true;
  return false;
}

function targetPathFor(
  matchId: string,
  status: string,
  scheduledAtMs: number,
  nowMs: number,
): string | null {
  if (isLiveValid(status, scheduledAtMs, nowMs)) {
    return `/pro-league/matches/${matchId}/live`;
  }
  if (status === "completed") return `/pro-league/matches/${matchId}/replay`;
  // scheduled / ready (kickoff futur) / failed -> page parent.
  return `/pro-league/matches/${matchId}`;
}

export function useMatchModeRedirect(
  matchId: string,
  expectedMode: MatchMode,
): MatchModeRedirectResult {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isTest, setIsTest] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    apiRequest<MinimalMatch>(
      `/pro-league/matches/${encodeURIComponent(matchId)}`,
    )
      .then((m) => {
        if (cancelled) return;
        setStatus(m.status);
        setIsTest(Boolean(m.isTest));
        const nowMs = Date.now();
        const scheduledAtMs = new Date(m.scheduledAt).getTime();
        const liveOk = isLiveValid(m.status, scheduledAtMs, nowMs);
        const replayOk = m.status === "completed";
        const matchedExpected =
          expectedMode === "live" ? liveOk : replayOk;
        if (!matchedExpected) {
          const target = targetPathFor(
            matchId,
            m.status,
            scheduledAtMs,
            nowMs,
          );
          if (target) {
            setRedirecting(true);
            router.replace(target);
          }
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "fetch error");
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, expectedMode, router]);

  return { redirecting, status, error, isTest };
}
