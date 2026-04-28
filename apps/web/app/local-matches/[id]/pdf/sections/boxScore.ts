/**
 * Box score: tableau Stat | Team A | Team B avec mise en avant du leader.
 * Utilise jspdf-autotable.
 */

import type jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PALETTE, parseHex, setDrawHex, setFillHex, setTextHex } from "../colors";
import { drawClosedPath } from "../icons";
import { CONTENT_WIDTH_MM, MARGIN_MM } from "../chrome";
import type { MatchAggregates, PdfMatch, TeamAggregateStats } from "../types";

interface StatRow {
  label: string;
  a: number;
  b: number;
}

function buildRows(agg: MatchAggregates): StatRow[] {
  const rows: Array<[string, keyof TeamAggregateStats]> = [
    ["Touchdowns", "touchdowns"],
    ["Passes completees", "completions"],
    ["Receptions", "receptions"],
    ["Blitz", "blitzes"],
    ["Blocages", "blocks"],
    ["Agressions", "fouls"],
    ["Sprints", "sprints"],
    ["Esquives", "dodges"],
    ["Interceptions", "interceptions"],
    ["Armures cassees", "armorBreaks"],
    ["Casualties", "casualties"],
    ["KO", "kos"],
    ["Sonnes", "stuns"],
    ["Echecs (fumbles)", "fumbles"],
    ["Total actions", "totalActions"],
  ];
  return rows.map(([label, key]) => ({
    label,
    a: agg.teamA[key],
    b: agg.teamB[key],
  }));
}

export interface BoxScoreResult {
  bottomY: number;
}

function drawTitleBand(doc: jsPDF, y: number, label: string): number {
  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;
  const h = 7;
  setFillHex(doc, PALETTE.BLOOD);
  doc.rect(x, y, w, h, "F");
  setFillHex(doc, PALETTE.GOLD);
  drawClosedPath(
    doc,
    [
      [x + 4, y + h / 2 - 1.5],
      [x + 8, y + h / 2],
      [x + 4, y + h / 2 + 1.5],
    ],
    "F",
  );
  drawClosedPath(
    doc,
    [
      [x + w - 4, y + h / 2 - 1.5],
      [x + w - 8, y + h / 2],
      [x + w - 4, y + h / 2 + 1.5],
    ],
    "F",
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextHex(doc, PALETTE.BONE);
  doc.setCharSpace(1.8);
  doc.text(label, x + w / 2, y + h / 2 + 1.4, { align: "center" });
  doc.setCharSpace(0);
  return y + h;
}

export function drawBoxScore(
  doc: jsPDF,
  match: PdfMatch,
  agg: MatchAggregates,
  startY: number,
): BoxScoreResult {
  const tableStartY = drawTitleBand(doc, startY, "BOX SCORE — STATISTIQUES PAR EQUIPE");
  const rows = buildRows(agg);

  const inkRgb = parseHex(PALETTE.INK);
  const boneRgb = parseHex(PALETTE.BONE);
  const lineRgb = parseHex(PALETTE.INK_SOFT);
  const parchmentDarkRgb = parseHex(PALETTE.PARCHMENT_DARK);
  const highlightRgb = parseHex(PALETTE.PARCHMENT_HIGHLIGHT);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN_MM, right: MARGIN_MM },
    head: [["STATISTIQUE", match.teamA.name, match.teamB.name]],
    body: rows.map((r) => [r.label, String(r.a), String(r.b)]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      textColor: inkRgb,
      lineColor: lineRgb,
      lineWidth: 0.1,
      cellPadding: { top: 1.6, right: 2, bottom: 1.6, left: 2 },
    },
    headStyles: {
      fillColor: inkRgb,
      textColor: boneRgb,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
    },
    bodyStyles: {
      fillColor: parseHex(PALETTE.PARCHMENT),
    },
    alternateRowStyles: {
      fillColor: parchmentDarkRgb,
    },
    tableWidth: CONTENT_WIDTH_MM,
    columnStyles: {
      0: { fontStyle: "bold", halign: "left" },
      1: { halign: "center" },
      2: { halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const idx = data.row.index;
      const row = rows[idx];
      if (!row) return;
      if (data.column.index === 1 && row.a > row.b) {
        data.cell.styles.fillColor = highlightRgb;
        data.cell.styles.fontStyle = "bold";
      }
      if (data.column.index === 2 && row.b > row.a) {
        data.cell.styles.fillColor = highlightRgb;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  // @ts-expect-error lastAutoTable is added by autotable plugin
  const finalY = (doc.lastAutoTable?.finalY ?? tableStartY + 80) as number;
  return { bottomY: finalY };
}
