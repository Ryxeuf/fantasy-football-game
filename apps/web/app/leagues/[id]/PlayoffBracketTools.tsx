"use client";
/**
 * Outils du commissaire sur un bracket de play-offs DÉJÀ généré (montés par
 * `PlayoffBracketView`) : réinitialiser le bracket tant que rien n'est joué.
 */

import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";

interface ResetProps {
  seasonId: string;
  /** Une rencontre est engagée : le serveur refuserait, on grise. */
  disabled: boolean;
  onDone: () => void;
}

/**
 * « Réinitialiser le bracket » : supprime tous les tours de play-off pour
 * rouvrir la taille du bracket et relancer. Confirmation en deux temps,
 * comme les retraits d'équipe de la liste des participants.
 */
export function PlayoffBracketResetButton({
  seasonId,
  disabled,
  onDone,
}: ResetProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/seasons/${seasonId}/playoff-bracket/reset`, {
        method: "POST",
      });
      setConfirming(false);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }, [seasonId, onDone]);

  return (
    <div data-testid="playoff-reset" className="space-y-1 text-sm">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-900">
          <span>
            Supprimer tout le bracket ? Tu pourras changer la taille des
            play-offs puis le relancer.
          </span>
          <button
            type="button"
            data-testid="playoff-reset-confirm"
            onClick={reset}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Oui, réinitialiser
          </button>
          <button
            type="button"
            data-testid="playoff-reset-cancel"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-gray-700 hover:bg-gray-50"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="playoff-reset-button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={disabled}
          title={
            disabled
              ? "Une rencontre de play-off est déjà jouée ou en cours de saisie"
              : undefined
          }
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          ♻️ Réinitialiser le bracket
        </button>
      )}
      {error ? (
        <p data-testid="playoff-reset-error" className="text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
