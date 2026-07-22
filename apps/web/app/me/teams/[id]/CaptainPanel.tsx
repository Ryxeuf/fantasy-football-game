"use client";
/**
 * Règle spéciale d'équipe "Capitaine" (Saison 3) — panneau de désignation.
 *
 * Composant section autonome (pattern Q.B.2/Q.B.3) : fetch interne de
 * `GET /team/:id/captain`, rendu UNIQUEMENT si le roster possède la règle.
 * Trois états :
 *  - capitaine actif → affichage badge + rappel des effets ;
 *  - capitaine perdu (mort/licencié en ligue) → alerte + sélecteur de
 *    successeur ;
 *  - aucun capitaine (création) → sélecteur de désignation.
 *
 * Après un `POST /team/:id/captain` réussi, `onDesignated` prévient le
 * parent (rechargement de la fiche : le capitaine gagne la compétence Pro).
 */

import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../../../lib/api-client";

interface CaptainPlayerView {
  id: string;
  name: string;
  number: number;
  position: string;
}

interface CaptainStatusResponse {
  hasCaptainRule: boolean;
  captain: CaptainPlayerView | null;
  lostCaptain: (CaptainPlayerView & { dead: boolean; fired: boolean }) | null;
  canDesignate: boolean;
  frozen: boolean;
  eligiblePlayers: CaptainPlayerView[];
}

interface Props {
  teamId: string;
  /** Appelé après une désignation réussie (recharger la fiche équipe). */
  onDesignated?: () => void;
}

export default function CaptainPanel({ teamId, onDesignated }: Props) {
  const [status, setStatus] = useState<CaptainStatusResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await apiRequest<CaptainStatusResponse>(
        `/team/${teamId}/captain`,
      );
      setStatus(s);
    } catch {
      // Section non-critique : on la masque en cas d'erreur réseau.
      setStatus(null);
    }
  }, [teamId]);

  useEffect(() => {
    if (!teamId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await apiRequest<CaptainStatusResponse>(
          `/team/${teamId}/captain`,
        );
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (!status?.hasCaptainRule) return null;

  const designate = async () => {
    if (!selectedId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest(`/team/${teamId}/captain`, {
        method: "POST",
        body: JSON.stringify({ playerId: selectedId }),
      });
      setSelectedId("");
      await refresh();
      onDesignated?.();
    } catch (e) {
      setError(
        e instanceof ApiClientError
          ? e.message
          : "Erreur lors de la désignation du capitaine",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const showPicker = status.canDesignate && status.eligiblePlayers.length > 0;

  return (
    <div
      data-testid="captain-panel"
      className="bg-white rounded-lg border overflow-hidden"
    >
      <div className="bg-gray-50 px-4 sm:px-6 py-3 border-b flex items-center gap-2">
        <span aria-hidden>🎖️</span>
        <h2 className="text-base sm:text-lg font-semibold">
          Capitaine d&apos;équipe
        </h2>
      </div>
      <div className="p-4 sm:p-6 space-y-3">
        {status.captain ? (
          <div
            data-testid="captain-current"
            className="flex items-center gap-2 text-sm sm:text-base"
          >
            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5">
              C
            </span>
            <span className="font-semibold">
              #{status.captain.number} {status.captain.name}
            </span>
            <span className="text-gray-500 text-xs sm:text-sm">
              — Pro offerte (sans hausse de VE)
            </span>
          </div>
        ) : null}

        {status.lostCaptain ? (
          <div
            data-testid="captain-lost-banner"
            className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm"
          >
            Votre capitaine #{status.lostCaptain.number}{" "}
            {status.lostCaptain.name} est{" "}
            {status.lostCaptain.dead ? "mort" : "licencié"}. Désignez un
            nouveau capitaine.
          </div>
        ) : null}

        {showPicker ? (
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              data-testid="captain-select"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border rounded px-3 py-2 text-sm flex-1"
            >
              <option value="">
                {status.captain
                  ? "Changer de capitaine…"
                  : "Choisir un capitaine…"}
              </option>
              {status.eligiblePlayers.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.name}
                </option>
              ))}
            </select>
            <button
              data-testid="captain-designate-btn"
              onClick={designate}
              disabled={!selectedId || submitting}
              className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submitting ? "Désignation…" : "Désigner capitaine"}
            </button>
          </div>
        ) : null}

        {!status.captain && !showPicker ? (
          <div className="text-sm text-gray-500">
            Aucun joueur éligible pour la désignation.
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        ) : null}

        <p className="text-xs text-gray-500">
          Le capitaine gagne la compétence Pro sans augmenter la valeur
          d&apos;équipe. S&apos;il est sur le terrain, chaque relance
          d&apos;équipe est gratuite sur un 6 naturel. Il doit être aligné au
          placement si possible et ne peut être licencié que s&apos;il a subi
          une blessure réduisant une caractéristique (hors Gros Bras).
        </p>
      </div>
    </div>
  );
}
