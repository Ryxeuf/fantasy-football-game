"use client";

/**
 * Contexte partage entre toutes les pages /admin/nfl-fantasy/* :
 * liste des NflSeason seedees + saison selectionnee (persistee en URL
 * ?season=YYYY). Charge la liste une fois via
 * `GET /admin/nfl-fantasy/explore/seasons`.
 *
 * Phase 3.C — C.0.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ApiClientError, apiRequest } from "../../../lib/api-client";

export interface AdminSeasonRow {
  readonly id: string;
  readonly status: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly weeksCount: number;
  readonly gamesCount: number;
  readonly playersCount: number;
}

interface SeasonContextValue {
  readonly seasons: ReadonlyArray<AdminSeasonRow>;
  readonly selectedSeasonId: string | null;
  readonly setSelectedSeasonId: (id: string | null) => void;
  readonly loading: boolean;
  readonly error: string | null;
}

const SeasonContext = createContext<SeasonContextValue | null>(null);

interface SeasonsResponse {
  readonly seasons: ReadonlyArray<AdminSeasonRow>;
}

function pickDefaultSeason(
  seasons: ReadonlyArray<AdminSeasonRow>,
): AdminSeasonRow | null {
  if (seasons.length === 0) return null;
  return (
    seasons.find((s) => s.status === "in_progress") ??
    seasons[0]!
  );
}

export function NflFantasySeasonProvider({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSeason = searchParams?.get("season") ?? null;

  const [seasons, setSeasons] = useState<ReadonlyArray<AdminSeasonRow>>([]);
  const [selectedSeasonId, setSelectedSeasonIdState] = useState<string | null>(
    urlSeason,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiRequest<SeasonsResponse>("/admin/nfl-fantasy/explore/seasons")
      .then((d) => {
        if (cancelled) return;
        setSeasons(d.seasons);
        if (!urlSeason) {
          const fallback = pickDefaultSeason(d.seasons);
          if (fallback) setSelectedSeasonIdState(fallback.id);
        }
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiClientError) {
          setError(`${e.message}${e.status ? ` (HTTP ${e.status})` : ""}`);
        } else {
          setError(e instanceof Error ? e.message : "Erreur");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // urlSeason intentionnellement omis : initial uniquement, change via setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSelectedSeasonId = useCallback(
    (id: string | null) => {
      setSelectedSeasonIdState(id);
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      if (id) next.set("season", id);
      else next.delete("season");
      const qs = next.toString();
      router.replace((qs ? `?${qs}` : "?") as never, { scroll: false });
    },
    [router, searchParams],
  );

  const value = useMemo<SeasonContextValue>(
    () => ({
      seasons,
      selectedSeasonId,
      setSelectedSeasonId,
      loading,
      error,
    }),
    [seasons, selectedSeasonId, setSelectedSeasonId, loading, error],
  );

  return (
    <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
  );
}

export function useNflFantasySeason(): SeasonContextValue {
  const ctx = useContext(SeasonContext);
  if (!ctx) {
    throw new Error(
      "useNflFantasySeason doit etre appele dans <NflFantasySeasonProvider>",
    );
  }
  return ctx;
}
