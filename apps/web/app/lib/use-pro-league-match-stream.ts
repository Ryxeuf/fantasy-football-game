/**
 * Hook React qui consomme l'endpoint SSE
 * `/pro-league/matches/:id/stream` (sprint Pro League lot 1.B.2) et
 * accumule les `MatchEvent[]` reçus.
 *
 * Sprint Pro League — lot 1.B.4 (ticker textuel mobile-friendly).
 *
 * Le navigateur gère nativement la reconnexion via `Last-Event-ID`
 * tant que la `EventSource` n'est pas explicitement fermée. On expose
 * néanmoins un état `connectionState` lisible pour permettre à l'UI
 * d'afficher un badge "live" / "reconnecting" / "ended".
 */

"use client";

import { useEffect, useRef, useState } from "react";

import type { MatchEvent } from "@bb/shared-types";

import { API_BASE } from "../auth-client";

export type ConnectionState = "connecting" | "open" | "error" | "closed";

export interface UseProLeagueMatchStreamResult {
  readonly events: readonly MatchEvent[];
  readonly connectionState: ConnectionState;
  /** Erreur runtime (parse, fetch). null en bon état. */
  readonly error: string | null;
}

const ENDED_EVENT_TYPES = new Set(["END"]);

/**
 * Subscribe au stream SSE d'un match Pro League. Le hook ferme
 * automatiquement la connexion à l'unmount + lorsqu'un event `END`
 * est reçu (le match est terminé, plus rien à streamer).
 */
export function useProLeagueMatchStream(
  matchId: string | null | undefined,
): UseProLeagueMatchStreamResult {
  const [events, setEvents] = useState<readonly MatchEvent[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("connecting");
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!matchId) {
      setConnectionState("closed");
      return;
    }
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      // SSR / environnement sans EventSource : no-op.
      return;
    }

    const url = `${API_BASE}/pro-league/matches/${encodeURIComponent(matchId)}/stream`;
    const source = new EventSource(url);
    sourceRef.current = source;
    setConnectionState("connecting");
    setError(null);
    setEvents([]);

    source.onopen = () => {
      setConnectionState("open");
      setError(null);
    };

    source.onerror = () => {
      // EventSource va automatiquement retry. On expose juste l'état.
      setConnectionState("error");
    };

    const handleEvent = (raw: MessageEvent): void => {
      try {
        const parsed = JSON.parse(raw.data) as MatchEvent;
        setEvents((prev) => [...prev, parsed]);
        if (ENDED_EVENT_TYPES.has(parsed.type)) {
          source.close();
          setConnectionState("closed");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "parse failed";
        setError(msg);
      }
    };

    // Le serveur émet event: <TYPE> + data: <JSON>. EventSource expose
    // `addEventListener(type, …)` par event named, ou `onmessage` pour
    // les events sans type. On wire les types connus + un fallback.
    const KNOWN_EVENT_TYPES = [
      "KICKOFF",
      "TURN_START",
      "BLOCK",
      "DODGE",
      "PASS",
      "TD",
      "KO",
      "CASUALTY",
      "TURNOVER",
      "NUFFLE",
      "HALFTIME",
      "END",
    ] as const;
    for (const t of KNOWN_EVENT_TYPES) {
      source.addEventListener(t, handleEvent as EventListener);
    }
    source.onmessage = handleEvent;

    return () => {
      source.close();
      sourceRef.current = null;
      setConnectionState("closed");
    };
  }, [matchId]);

  return { events, connectionState, error };
}
