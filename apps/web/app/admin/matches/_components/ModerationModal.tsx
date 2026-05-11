"use client";

import { useState, useEffect } from "react";

/**
 * Lot P.B.4 — Modal de moderation pour forfait force ou annulation
 * d'un match humain. Bouton "Confirmer" desactive tant que la raison
 * n'a pas atteint le min server (3 chars).
 *
 * Cote serveur : POST /admin/matches/:id/forfeit ou /cancel avec
 * { winnerSide, reason } ou { reason }.
 */

export type ModerationMode = "forfeit" | "cancel";

interface ModerationModalProps {
  open: boolean;
  mode: ModerationMode;
  matchId: string | null;
  teamALabel: string;
  teamBLabel: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    reason: string;
    winnerSide?: "A" | "B";
  }) => void | Promise<void>;
}

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

export default function ModerationModal({
  open,
  mode,
  matchId,
  teamALabel,
  teamBLabel,
  loading,
  onClose,
  onConfirm,
}: ModerationModalProps) {
  const [reason, setReason] = useState("");
  const [winnerSide, setWinnerSide] = useState<"A" | "B">("A");

  useEffect(() => {
    if (open) {
      setReason("");
      setWinnerSide("A");
    }
  }, [open, matchId]);

  if (!open) return null;

  const canSubmit =
    reason.trim().length >= MIN_REASON_LENGTH &&
    reason.length <= MAX_REASON_LENGTH &&
    !loading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (mode === "forfeit") {
      onConfirm({ reason: reason.trim(), winnerSide });
    } else {
      onConfirm({ reason: reason.trim() });
    }
  };

  const title =
    mode === "forfeit"
      ? "Forcer un forfait administratif"
      : "Annuler le match";
  const cta = mode === "forfeit" ? "Confirmer le forfait" : "Annuler le match";

  return (
    <div
      data-testid="moderation-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h2
              id="moderation-modal-title"
              className="text-lg font-heading font-bold text-nuffle-anthracite"
            >
              {title}
            </h2>
            <p className="text-xs text-gray-500 font-mono mt-1">
              Match #{matchId?.slice(0, 8)}…
            </p>
          </div>

          {mode === "forfeit" && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-gray-700">
                Vainqueur declare
              </legend>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="winnerSide"
                  value="A"
                  checked={winnerSide === "A"}
                  onChange={() => setWinnerSide("A")}
                  data-testid="winner-side-A"
                />
                <span>{teamALabel}</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="winnerSide"
                  value="B"
                  checked={winnerSide === "B"}
                  onChange={() => setWinnerSide("B")}
                  data-testid="winner-side-B"
                />
                <span>{teamBLabel}</span>
              </label>
            </fieldset>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Raison ({MIN_REASON_LENGTH}–{MAX_REASON_LENGTH} caracteres)
            </span>
            <textarea
              data-testid="moderation-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON_LENGTH}
              required
              rows={4}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:outline-none"
              placeholder={
                mode === "forfeit"
                  ? "Ex: no-show de 30 minutes, comportement toxique en chat"
                  : "Ex: exploit de bug, partie inutilisable"
              }
            />
            <span className="text-xs text-gray-400">
              {reason.length}/{MAX_REASON_LENGTH}
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              data-testid="moderation-submit"
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                mode === "forfeit"
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Envoi…" : cta}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
