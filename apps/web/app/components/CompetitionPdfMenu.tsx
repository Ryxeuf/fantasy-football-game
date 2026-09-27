"use client";

import { useEffect, useRef, useState } from "react";
import {
  downloadCompetitionPdf,
  type CompetitionPdfRequest,
} from "../lib/competition-pdf/download";

/**
 * Menu « Exports PDF » d'une ligue ou d'une coupe : chaque entrée construit
 * son document AU CLIC (certaines chargent des données supplémentaires —
 * tops, palmarès, bracket) puis déclenche le téléchargement.
 */

export interface CompetitionPdfMenuItem {
  key: string;
  label: string;
  /** Petite aide sous le libellé. */
  hint?: string;
  /** Entrée grisée (ex. aucun bracket). */
  disabled?: boolean;
  build: () => Promise<{ request: CompetitionPdfRequest; filename: string }>;
}

interface CompetitionPdfMenuProps {
  items: readonly CompetitionPdfMenuItem[];
  label?: string;
  testId?: string;
}

export default function CompetitionPdfMenu({
  items,
  label = "Exports PDF",
  testId = "competition-pdf-menu",
}: CompetitionPdfMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (item: CompetitionPdfMenuItem) => {
    setBusy(item.key);
    setError(null);
    try {
      const { request, filename } = await item.build();
      await downloadCompetitionPdf(request, filename);
      setOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div ref={rootRef} className="relative inline-block" data-testid={testId}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={`${testId}-toggle`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10"
      >
        🖨️ {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute z-40 mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg py-1 right-0 sm:left-0 sm:right-auto"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              data-testid={`${testId}-${item.key}`}
              disabled={item.disabled || busy !== null}
              onClick={() => run(item)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-nuffle-gold/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="font-medium text-nuffle-anthracite">
                {busy === item.key ? "Génération…" : item.label}
              </span>
              {item.hint ? (
                <span className="block text-[11px] text-gray-500">{item.hint}</span>
              ) : null}
            </button>
          ))}
          {error ? (
            <p role="alert" className="px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
