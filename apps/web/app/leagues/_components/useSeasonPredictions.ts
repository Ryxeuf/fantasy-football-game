"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import {
  cupPredictionLeaderboardPath,
  cupPredictionsPath,
  seasonPredictionLeaderboardPath,
  seasonPredictionsPath,
  type CupPredictionLeaderboardView,
  type CupPredictionsView,
  type SeasonPredictionLeaderboardView,
  type SeasonPredictionsView,
} from "./predictions";

/**
 * Vue des pronostics d'une saison (ou d'une coupe) + son classement,
 * partagée par la fiche de la compétition (résumé + boutons du calendrier),
 * la page des pronostics et la page d'une journée.
 *
 * - le classement est secondaire : son échec n'empêche pas de pronostiquer ;
 * - seule la DERNIÈRE requête écrit (un rechargement lent n'écrase pas un
 *   état plus récent) ;
 * - changer de saison vide l'état avant de recharger, pour ne jamais
 *   afficher la saison précédente étiquetée comme la nouvelle, alors que
 *   `reload` (après un pronostic) garde l'affichage pour ne pas clignoter.
 */
export interface PredictionsState<V, B> {
  readonly view: V | null;
  readonly board: B | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly reload: () => Promise<void>;
}

export type SeasonPredictionsState = PredictionsState<
  SeasonPredictionsView,
  SeasonPredictionLeaderboardView
>;

function usePredictions<V, B>(
  viewPath: string | null,
  boardPath: string | null,
): PredictionsState<V, B> {
  const [view, setView] = useState<V | null>(null);
  const [board, setBoard] = useState<B | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    if (!viewPath || !boardPath) return;
    const request = ++requestRef.current;
    try {
      const [v, b] = await Promise.all([
        apiRequest<V>(viewPath),
        apiRequest<B>(boardPath).catch(() => null),
      ]);
      if (request !== requestRef.current) return;
      setView(v);
      setBoard(b);
      setError(null);
    } catch (e: unknown) {
      if (request !== requestRef.current) return;
      setError(e instanceof Error ? e.message : "Pronostics indisponibles");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [viewPath, boardPath]);

  useEffect(() => {
    setView(null);
    setBoard(null);
    setError(null);
    if (!viewPath) {
      setLoading(false);
      return;
    }
    setLoading(true);
    reload();
  }, [viewPath, reload]);

  return { view, board, error, loading, reload };
}

export function useSeasonPredictions(
  seasonId: string | null | undefined,
): SeasonPredictionsState {
  return usePredictions<SeasonPredictionsView, SeasonPredictionLeaderboardView>(
    seasonId ? seasonPredictionsPath(seasonId) : null,
    seasonId ? seasonPredictionLeaderboardPath(seasonId) : null,
  );
}

/** Même chose pour une coupe : ses rondes et son classement. */
export function useCupPredictions(
  cupId: string | null | undefined,
): PredictionsState<CupPredictionsView, CupPredictionLeaderboardView> {
  return usePredictions<CupPredictionsView, CupPredictionLeaderboardView>(
    cupId ? cupPredictionsPath(cupId) : null,
    cupId ? cupPredictionLeaderboardPath(cupId) : null,
  );
}
