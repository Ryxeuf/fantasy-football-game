"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import type { RoundPredictionsView } from "./predictions";

/**
 * Clôture manuelle des pronostics d'une journée entière (commissaire).
 * Le serveur re-tranche le droit ; le parent recharge la vue ensuite.
 */
export function RoundPredictionsCloseButton({
  round,
  onChanged,
}: {
  round: RoundPredictionsView;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/rounds/${round.id}/predictions/close`, {
        method: "POST",
      });
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Clôture impossible");
    } finally {
      setBusy(false);
    }
  }, [round.id, onChanged]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        data-testid={`prediction-round-close-${round.id}`}
        disabled={busy}
        onClick={handleClose}
        className="text-xs text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
      >
        Clore les pronostics de la journée
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
