"use client";

import { useEffect, useState } from "react";

/**
 * Lot P.B.3 — Modal de clone d'une saison Pro League.
 *
 * Inputs : year cible (entier 2020..2100, unique). Le service refuse
 * cote serveur si DUPLICATE_YEAR.
 */

interface CloneSeasonModalProps {
  open: boolean;
  sourceSeasonId: string | null;
  sourceSeasonLabel: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: { year: number; driverKind?: "hybrid" | "full" }) => void | Promise<void>;
}

export default function CloneSeasonModal({
  open,
  sourceSeasonId,
  sourceSeasonLabel,
  loading,
  onClose,
  onConfirm,
}: CloneSeasonModalProps) {
  const [yearStr, setYearStr] = useState("");
  const [driverKind, setDriverKind] = useState<"inherit" | "hybrid" | "full">(
    "inherit",
  );

  useEffect(() => {
    if (open) {
      const next = new Date().getFullYear() + 1;
      setYearStr(String(next));
      setDriverKind("inherit");
    }
  }, [open, sourceSeasonId]);

  if (!open) return null;

  const yearParsed = Number.parseInt(yearStr, 10);
  const yearValid =
    Number.isInteger(yearParsed) && yearParsed >= 2020 && yearParsed <= 2100;
  const canSubmit = yearValid && !loading;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({
      year: yearParsed,
      driverKind:
        driverKind === "inherit" ? undefined : driverKind,
    });
  };

  return (
    <div
      data-testid="clone-season-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-nuffle-anthracite">
              Cloner une saison
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Source : {sourceSeasonLabel}{" "}
              <span className="font-mono">
                ({sourceSeasonId?.slice(0, 8)}…)
              </span>
            </p>
            <p className="text-sm text-gray-700 mt-2">
              Cree une nouvelle saison avec les memes equipes et standings a
              zero. Le schedule n&apos;est <strong>pas</strong> clone — utilise
              ensuite &laquo;Regenerer le calendrier&raquo;.
            </p>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Annee cible
            </span>
            <input
              type="number"
              data-testid="clone-year"
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
            <div className="grid grid-cols-3 gap-2">
              {(["inherit", "hybrid", "full"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  data-testid={`clone-driver-${opt}`}
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
              data-testid="clone-submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {loading ? "Clone…" : "Cloner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
