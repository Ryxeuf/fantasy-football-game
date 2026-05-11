"use client";

import { useEffect, useState } from "react";

/**
 * Modal de creation d'une saison Pro League from scratch.
 *
 * Inputs : year (2020..2100, unique), driverKind (hybrid|full),
 * autoSchedule (cocher pour enchainer la generation du calendrier
 * immediatement apres la creation — utile pour les saisons rapides
 * de tests).
 */

interface CreateSeasonModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    year: number;
    driverKind?: "hybrid" | "full";
    autoSchedule: boolean;
  }) => void | Promise<void>;
}

export default function CreateSeasonModal({
  open,
  loading,
  onClose,
  onConfirm,
}: CreateSeasonModalProps) {
  const [yearStr, setYearStr] = useState("");
  const [driverKind, setDriverKind] = useState<"hybrid" | "full">("hybrid");
  const [autoSchedule, setAutoSchedule] = useState(true);

  useEffect(() => {
    if (open) {
      setYearStr(String(new Date().getFullYear()));
      setDriverKind("hybrid");
      setAutoSchedule(true);
    }
  }, [open]);

  if (!open) return null;

  const yearParsed = Number.parseInt(yearStr, 10);
  const yearValid =
    Number.isInteger(yearParsed) && yearParsed >= 2020 && yearParsed <= 2100;
  const canSubmit = yearValid && !loading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({ year: yearParsed, driverKind, autoSchedule });
  };

  return (
    <div
      data-testid="create-season-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-nuffle-anthracite">
              Creer une saison Pro League
            </h2>
            <p className="text-sm text-gray-700 mt-2">
              Initialise une nouvelle saison avec les 16 equipes seedees.
              Standings a zero. Le calendrier (15 rounds × 8 matches) est
              genere automatiquement si la case est cochee.
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Annee</span>
            <input
              type="number"
              data-testid="create-year"
              value={yearStr}
              onChange={(e) => setYearStr(e.target.value)}
              min={2020}
              max={2100}
              required
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-nuffle-gold focus:outline-none"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700">
              Driver de simulation
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(["hybrid", "full"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  data-testid={`create-driver-${opt}`}
                  onClick={() => setDriverKind(opt)}
                  className={`px-3 py-2 rounded-lg border text-sm ${
                    driverKind === opt
                      ? "bg-nuffle-gold text-white border-nuffle-gold"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              data-testid="create-auto-schedule"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.checked)}
            />
            <span>
              Generer le calendrier immediatement (15 rounds, premier
              mardi 21h UTC)
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
              data-testid="create-submit"
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              {loading ? "Creation…" : "Creer la saison"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
