"use client";

import { useState } from "react";
import {
  downloadCompetitionPdf,
  pdfFilename,
} from "../../../../../lib/competition-pdf/download";
import {
  matchSheetToPdf,
  type SheetPdfInput,
} from "../../../../../lib/competition-pdf/adapters/match-sheet";

/**
 * « Feuille imprimable (PDF) » : la feuille de rencontre papier, à remplir
 * au stylo autour de la table. Reprend ce qui est déjà saisi ici (avant-match,
 * évènements, JDM) ; une feuille vierge donne une feuille vierge.
 */
export function MatchSheetPdfButton({ data }: { data: SheetPdfInput }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const doc = matchSheetToPdf(data);
      const suffix = `${doc.home.team.name} vs ${doc.away.team.name}`;
      await downloadCompetitionPdf(
        { kind: "match-sheet", data: doc },
        pdfFilename("match-sheet", suffix),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        data-testid="match-sheet-pdf"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-nuffle-gold bg-white px-3 py-1.5 text-sm font-medium text-nuffle-bronze hover:bg-nuffle-gold/10 disabled:opacity-50"
      >
        🖨️ {busy ? "Génération…" : "Feuille imprimable (PDF)"}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
