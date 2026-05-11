"use client";

import { useEffect, useState } from "react";

/**
 * Lot P.B.1 — Modal d'ajustement manuel d'un solde Crowns par un admin.
 *
 * Champ `delta` signe (positif = credit / negatif = debit). Bornes
 * +/-10M Crowns coherents avec le schema Zod server. Raison min 3 chars
 * pour tracabilite audit.
 */

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;
const MAX_ABS_DELTA = 10_000_000;

interface BalanceAdjustModalProps {
  open: boolean;
  userId: string | null;
  userLabel: string;
  currentBalance: number;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: { delta: number; reason: string }) => void | Promise<void>;
}

export default function BalanceAdjustModal({
  open,
  userId,
  userLabel,
  currentBalance,
  loading,
  onClose,
  onConfirm,
}: BalanceAdjustModalProps) {
  const [deltaStr, setDeltaStr] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setDeltaStr("");
      setReason("");
    }
  }, [open, userId]);

  if (!open) return null;

  const deltaParsed = Number.parseInt(deltaStr, 10);
  const deltaValid =
    Number.isInteger(deltaParsed) &&
    deltaParsed !== 0 &&
    Math.abs(deltaParsed) <= MAX_ABS_DELTA;
  const reasonValid =
    reason.trim().length >= MIN_REASON_LENGTH &&
    reason.length <= MAX_REASON_LENGTH;
  const canSubmit = deltaValid && reasonValid && !loading;
  const newBalancePreview = deltaValid ? currentBalance + deltaParsed : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({ delta: deltaParsed, reason: reason.trim() });
  };

  return (
    <div
      data-testid="balance-adjust-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="balance-adjust-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h2
              id="balance-adjust-modal-title"
              className="text-lg font-heading font-bold text-nuffle-anthracite"
            >
              Ajuster le solde
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {userLabel}{" "}
              <span className="font-mono">({userId?.slice(0, 8)}…)</span>
            </p>
            <p className="text-sm text-gray-700 mt-2">
              Solde actuel :{" "}
              <span className="font-bold">
                {currentBalance.toLocaleString("fr-FR")} Crowns
              </span>
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Delta (positif = credit, negatif = debit)
            </span>
            <input
              type="number"
              data-testid="balance-delta"
              value={deltaStr}
              onChange={(e) => setDeltaStr(e.target.value)}
              max={MAX_ABS_DELTA}
              min={-MAX_ABS_DELTA}
              step={1}
              required
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:outline-none"
              placeholder="Ex: 500 ou -200"
            />
            {newBalancePreview !== null && (
              <span
                data-testid="new-balance-preview"
                className="text-xs text-gray-600 mt-1 inline-block"
              >
                Nouveau solde : {newBalancePreview.toLocaleString("fr-FR")} Crowns
              </span>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Raison ({MIN_REASON_LENGTH}–{MAX_REASON_LENGTH} caracteres)
            </span>
            <textarea
              data-testid="balance-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON_LENGTH}
              rows={3}
              required
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:outline-none"
              placeholder="Ex: compensation bug spectator finale, correction farming detection"
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
              data-testid="balance-submit"
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                deltaParsed < 0
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {loading ? "Envoi…" : "Appliquer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
