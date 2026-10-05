"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import {
  seasonPredictionLeaderboardPath,
  seasonPredictionsPath,
  type SeasonPredictionLeaderboardView,
  type SeasonPredictionsView,
} from "./predictions";

/**
 * Vue des pronostics d'une saison + son classement, partagée par la fiche
 * de ligue (résumé + boutons du calendrier), la page de saison et la page
 * d'une journée.
 *
 * - le classement est secondaire : son échec n'empêche pas de pronostiquer ;
 * - seule la DERNIÈRE requête écrit (un rechargement lent n'écrase pas un
 *   état plus récent) ;
 * - changer de saison vide l'état avant de recharger, pour ne jamais
 *   afficher la saison précédente étiquetée comme la nouvelle, alors que
 *   `reload` (après un pronostic) garde l'affichage pour ne pas clignoter.
 */
export interface SeasonPredictionsState {
  readonly view: SeasonPredictionsView | null;
  readonly board: SeasonPredictionLeaderboardView | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly reload: () => Promise<void>;
}

export function useSeasonPredictions(
  seasonId: string | null | undefined,
): SeasonPredictionsState {
  const [view, setView] = useState<SeasonPredictionsView | null>(null);
  const [board, setBoard] = useState<SeasonPredictionLeaderboardView | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const requestRef = useRef(0);

  const reload = useCallback(async () => {
    if (!seasonId) return;
    const request = ++requestRef.current;
    try {
      const [v, b] = await Promise.all([
        apiRequest<SeasonPredictionsView>(seasonPredictionsPath(seasonId)),
        apiRequest<SeasonPredictionLeaderboardView>(
          seasonPredictionLeaderboardPath(seasonId),
        ).catch(() => null),
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
  }, [seasonId]);

  useEffect(() => {
    setView(null);
    setBoard(null);
    setError(null);
    if (!seasonId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    reload();
  }, [seasonId, reload]);

  return { view, board, error, loading, reload };
}
