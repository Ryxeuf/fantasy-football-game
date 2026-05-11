"use client";

import { useEffect, useState } from "react";

/**
 * Lot P.B.4 — Modal pour bannir un utilisateur. Selection rapide de
 * la duree (1j / 7j / 30j / permanent) via boutons + champ raison.
 *
 * Cote serveur : POST /admin/users/:id/ban avec { reason, durationDays? }.
 * durationDays = 0 ou omis ⇒ ban permanent (server resolve a year 9999).
 */

const PRESET_DURATIONS: Array<{ label: string; days: number }> = [
  { label: "1 jour", days: 1 },
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "Permanent", days: 0 },
];

const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 500;

interface BanUserModalProps {
  open: boolean;
  userId: string | null;
  userLabel: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string; durationDays: number }) => void | Promise<void>;
}

export default function BanUserModal({
  open,
  userId,
  userLabel,
  loading,
  onClose,
  onConfirm,
}: BanUserModalProps) {
  const [reason, setReason] = useState("");
  const [durationDays, setDurationDays] = useState<number>(7);

  useEffect(() => {
    if (open) {
      setReason("");
      setDurationDays(7);
    }
  }, [open, userId]);

  if (!open) return null;

  const canSubmit =
    reason.trim().length >= MIN_REASON_LENGTH &&
    reason.length <= MAX_REASON_LENGTH &&
    !loading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({ reason: reason.trim(), durationDays });
  };

  return (
    <div
      data-testid="ban-user-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ban-user-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h2
              id="ban-user-modal-title"
              className="text-lg font-heading font-bold text-nuffle-anthracite"
            >
              Bannir un utilisateur
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {userLabel}{" "}
              <span className="font-mono">
                ({userId?.slice(0, 8)}…)
              </span>
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">
              Duree
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_DURATIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  data-testid={`ban-duration-${opt.days}`}
                  onClick={() => setDurationDays(opt.days)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    durationDays === opt.days
                      ? "bg-red-600 text-white border-red-700"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Raison ({MIN_REASON_LENGTH}–{MAX_REASON_LENGTH} caracteres)
            </span>
            <textarea
              data-testid="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={MAX_REASON_LENGTH}
              rows={4}
              required
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:outline-none"
              placeholder="Ex: comportement toxique repete signale par 3 coachs"
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
              data-testid="ban-submit"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
            >
              {loading ? "Envoi…" : "Bannir"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
