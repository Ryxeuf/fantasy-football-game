"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import {
  roundPredictionsClosePath,
  type PredictionCompetition,
  type RoundPredictionsView,
} from "./predictions";

/**
 * Clôture manuelle des pronostics d'une journée entière (commissaire).
 * Le serveur re-tranche le droit ; le parent recharge la vue ensuite.
 */
export function RoundPredictionsCloseButton({
  round,
  onChanged,
  competition = "league",
}: {
  round: Pick<RoundPredictionsView, "id">;
  onChanged: () => void;
  /** Ligue (défaut) ou coupe : la route et le libellé suivent. */
  competition?: PredictionCompetition;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(roundPredictionsClosePath(round.id, competition), {
        method: "POST",
      });
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clôture impossible");
    } finally {
      setBusy(false);
    }
  }, [round.id, competition, onChanged]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        data-testid={`prediction-round-close-${round.id}`}
        disabled={busy}
        onClick={handleClose}
        className="text-xs text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
      >
        {`Clore les pronostics de la ${competition === "cup" ? "ronde" : "journée"}`}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
