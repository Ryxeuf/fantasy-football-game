"use client";
/**
 * L2.B.5 — Bouton "Coup de mecene" affiche sur la page detail de
 * ligue quand :
 *   - la saison est `in_progress`
 *   - le coach courant possede un participant actif
 *   - ce participant n'a pas encore joue son coup de mecene
 *
 * L'API credite +100k po a la treasury de l'equipe (1x par saison).
 */

import { useState } from "react";
import { apiRequest } from "../../lib/api-client";
import type { LeagueParticipantDetail } from "./types";

interface MeceneButtonProps {
  seasonId: string;
  participant: LeagueParticipantDetail;
  /**
   * Callback declenche apres un succes pour permettre au parent de
   * recharger la saison et refleter le flag `mecenePlayed=true`.
   */
  onPlayed?: () => void;
}

export function MeceneButton({
  seasonId,
  participant,
  onPlayed,
}: MeceneButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  const alreadyPlayed = participant.mecenePlayed === true;

  async function handleConfirm(): Promise<void> {
    try {
      setBusy(true);
      setError(null);
      await apiRequest(
        `/leagues/seasons/${seasonId}/teams/${participant.teamId}/mecene`,
        { method: "POST" },
      );
      setConfirmation(false);
      onPlayed?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (alreadyPlayed) {
    return (
      <div
        data-testid="mecene-already-played"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-100 border border-gray-200 text-gray-600 text-sm"
      >
        💰 Coup de mecene deja joue cette saison
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        data-testid="open-mecene-modal"
        onClick={() => setConfirmation(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-sm font-medium hover:bg-amber-200"
      >
        💰 Jouer le coup de mecene (+100k po)
      </button>

      {confirmation ? (
        <div
          data-testid="mecene-modal"
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
          onClick={() => !busy && setConfirmation(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Coup de mecene</h2>
            <p className="text-sm text-gray-600">
              Tu peux declencher ton coup de mecene une seule fois par
              saison ligue. Cela credite immediatement{" "}
              <strong>+100 000 po</strong> dans la tresorerie de ton
              equipe.
            </p>
            {error ? (
              <p
                data-testid="mecene-error"
                className="text-sm text-red-600"
              >
                {error}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="confirm-mecene"
                onClick={handleConfirm}
                disabled={busy}
                className="px-3 py-1.5 rounded-md bg-amber-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {busy ? "Validation…" : "Confirmer"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmation(false)}
                disabled={busy}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
