/**
 * Sprint 1.G.3 — Hook auto-redirect entre `/live` et `/replay`.
 *
 * Logique :
 *  - Mode `live` est valide quand `match.status === 'in_progress'`.
 *  - Mode `replay` est valide quand `match.status === 'completed'`.
 *  - Si l'utilisateur arrive sur le mauvais mode, on `router.replace()`
 *    vers le bon URL pour ne pas polluer l'historique.
 *  - Sur un `scheduled` / `ready` / `failed` on redirige vers la page
 *    parent `/pro-league/matches/:id` (info pre-match / erreur).
 *
 * Le hook fait sa propre fetch leger sur `/pro-league/matches/:id` (la
 * route hub renvoie deja le status).
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { apiRequest } from "./api-client";

export type MatchMode = "live" | "replay";

interface MinimalMatch {
  readonly id: string;
  readonly status: string;
}

export interface MatchModeRedirectResult {
  readonly redirecting: boolean;
  readonly status: string | null;
  readonly error: string | null;
}

function targetPathFor(matchId: string, status: string): string | null {
  if (status === "in_progress") return `/pro-league/matches/${matchId}/live`;
  if (status === "completed") return `/pro-league/matches/${matchId}/replay`;
  // scheduled / ready / failed -> page parent (info pre-match / erreur).
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

  useEffect(() => {
    let cancelled = false;
    apiRequest<MinimalMatch>(
      `/pro-league/matches/${encodeURIComponent(matchId)}`,
    )
      .then((m) => {
        if (cancelled) return;
        setStatus(m.status);
        const expected =
          expectedMode === "live" ? "in_progress" : "completed";
        if (m.status !== expected) {
          const target = targetPathFor(matchId, m.status);
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

  return { redirecting, status, error };
}
