"use client";

import { useEffect, useState } from "react";

/**
 * Lot P.B.1 — Modal de refund d'un pari par un admin. Raison obligatoire
 * (min 3 chars). Affiche le warning post-settlement si le bet est `won`
 * ou `lost` car cela peut creer un double-credit (le payout reste).
 */

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

interface BetRefundModalProps {
  open: boolean;
  bet: {
    id: string;
    stake: number;
    status: string;
    selection: string;
  } | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string }) => void | Promise<void>;
}

export default function BetRefundModal({
  open,
  bet,
  loading,
  onClose,
  onConfirm,
}: BetRefundModalProps) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open, bet?.id]);

  if (!open || !bet) return null;

  const canSubmit =
    reason.trim().length >= MIN_REASON_LENGTH &&
    reason.length <= MAX_REASON_LENGTH &&
    !loading;
  const isPostSettlement = bet.status === "won" || bet.status === "lost";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({ reason: reason.trim() });
  };

  return (
    <div
      data-testid="bet-refund-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bet-refund-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h2
              id="bet-refund-modal-title"
              className="text-lg font-heading font-bold text-nuffle-anthracite"
            >
              Refund d'un pari
            </h2>
            <div className="mt-2 space-y-1 text-sm">
              <div>
                <span className="text-gray-600">Pari :</span>{" "}
                <span className="font-mono text-xs">{bet.id.slice(0, 12)}…</span>
              </div>
              <div>
                <span className="text-gray-600">Selection :</span>{" "}
                <span className="font-mono">{bet.selection}</span>
              </div>
              <div>
                <span className="text-gray-600">Stake :</span>{" "}
                <span className="font-bold">{bet.stake.toLocaleString("fr-FR")} Crowns</span>
              </div>
              <div>
                <span className="text-gray-600">Statut actuel :</span>{" "}
                <span
                  className={`font-semibold ${
                    isPostSettlement ? "text-orange-700" : "text-blue-700"
                  }`}
                >
                  {bet.status}
                </span>
              </div>
            </div>
          </div>

          {isPostSettlement && (
            <div
              data-testid="post-settlement-warning"
              className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800"
            >
              <strong>Attention :</strong> ce pari est deja settled (
              {bet.status}). Le refund creditera le stake initial mais le
              payout precedent reste. Verifiez l'impact financier.
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Raison ({MIN_REASON_LENGTH}–{MAX_REASON_LENGTH} caracteres)
            </span>
            <textarea
              data-testid="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON_LENGTH}
              rows={3}
              required
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:outline-none"
              placeholder="Ex: market cree par erreur, settlement bug detecte"
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
              data-testid="refund-submit"
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50"
            >
              {loading ? "Envoi…" : "Confirmer le refund"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
