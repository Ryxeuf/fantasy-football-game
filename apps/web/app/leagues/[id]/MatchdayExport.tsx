"use client";
import { useCallback, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useLanguage } from "../../contexts/LanguageContext";
import type { LeagueRoundDetail } from "./types";

// Export d'une journee (W-C). Feuille imprimable (window.print scope via
// `.matchday-print-area` dans globals.css) + telechargement PDF structure
// (jsPDF + autotable, deja en deps — pas de rasterisation). Pour imprimer ou
// diffuser aux joueurs (ligue offline facon tabletop / mordorbihan).

interface MatchdayExportProps {
  round: LeagueRoundDetail;
  leagueName?: string;
  /** Libelle de statut d'un pairing (memo SeasonCalendar). */
  statusLabel: (status: string) => string;
}

function formatDate(iso: string | null, language: string): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function MatchdayExport({
  round,
  leagueName,
  statusLabel,
}: MatchdayExportProps) {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const pairings = round.pairings ?? [];
  const roundTitle = `J${round.roundNumber}${
    round.name ? ` — ${round.name}` : ""
  }`;
  const date = formatDate(round.startDate, language);

  const exportPdf = useCallback(() => {
    const doc = new jsPDF();
    let y = 18;
    if (leagueName) {
      doc.setFontSize(11);
      doc.setTextColor(120);
      doc.text(leagueName, 14, y);
      y += 7;
    }
    doc.setFontSize(16);
    doc.setTextColor(20);
    doc.text(roundTitle, 14, y);
    y += 7;
    if (date) {
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(date, 14, y);
      y += 4;
    }
    autoTable(doc, {
      startY: y + 4,
      head: [
        [
          t.leagues.exportHome,
          "",
          t.leagues.exportAway,
          t.leagues.exportStatus,
        ],
      ],
      body: pairings.map((p) => [
        p.homeParticipant.team.name,
        "vs",
        p.awayParticipant.team.name,
        statusLabel(p.status),
      ]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [40, 40, 40] },
    });
    doc.save(`journee-${round.roundNumber}.pdf`);
  }, [
    leagueName,
    roundTitle,
    date,
    pairings,
    round.roundNumber,
    statusLabel,
    t.leagues.exportHome,
    t.leagues.exportAway,
    t.leagues.exportStatus,
  ]);

  const print = useCallback(() => {
    window.print();
  }, []);

  return (
    <>
      <button
        type="button"
        data-testid={`round-export-${round.id}`}
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
      >
        {t.leagues.exportMatchday}
      </button>

      {open ? (
        <div
          data-testid={`matchday-export-modal-${round.id}`}
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-lg p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Feuille imprimable */}
            <div ref={sheetRef} className="matchday-print-area space-y-3">
              {leagueName ? (
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  {leagueName}
                </div>
              ) : null}
              <h2 className="text-lg font-semibold text-nuffle-anthracite">
                {roundTitle}
              </h2>
              {date ? (
                <div className="text-sm text-gray-500">{date}</div>
              ) : null}
              {pairings.length === 0 ? (
                <div className="text-sm text-gray-400">
                  {t.leagues.pairingsEmpty}
                </div>
              ) : (
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300 text-gray-600">
                      <th className="text-left py-1 pr-2 font-semibold">
                        {t.leagues.exportHome}
                      </th>
                      <th className="py-1 px-2" />
                      <th className="text-left py-1 px-2 font-semibold">
                        {t.leagues.exportAway}
                      </th>
                      <th className="text-right py-1 pl-2 font-semibold">
                        {t.leagues.exportStatus}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pairings.map((p) => (
                      <tr
                        key={p.id}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="py-1 pr-2 text-nuffle-anthracite">
                          {p.homeParticipant.team.name}
                        </td>
                        <td className="py-1 px-2 text-center text-gray-400">
                          vs
                        </td>
                        <td className="py-1 px-2 text-nuffle-anthracite">
                          {p.awayParticipant.team.name}
                        </td>
                        <td className="py-1 pl-2 text-right text-gray-500">
                          {statusLabel(p.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="no-print flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm"
              >
                {t.leagues.recordResultCancel}
              </button>
              <button
                type="button"
                data-testid={`matchday-export-pdf-${round.id}`}
                onClick={exportPdf}
                className="px-4 py-2 rounded-md border border-nuffle-gold text-nuffle-anthracite text-sm font-medium hover:bg-nuffle-gold/10"
              >
                {t.leagues.exportPdf}
              </button>
              <button
                type="button"
                data-testid={`matchday-export-print-${round.id}`}
                onClick={print}
                className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium"
              >
                {t.leagues.exportPrint}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
