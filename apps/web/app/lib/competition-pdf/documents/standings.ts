/**
 * Classement (un tableau par poule, ou général) — et le tableau de totaux
 * par équipe des statistiques, qui a exactement la même forme.
 */

import type jsPDF from "jspdf";
import type { PdfColumn, PdfStandingsTable, StandingsDocument } from "../types";
import {
  contentWidth,
  createPage,
  drawDocumentHeader,
  drawSectionTitle,
  ensureSpace,
  finalizePages,
  type PdfPage,
} from "../layout";
import {
  BODY_STYLES,
  HEAD_STYLES,
  ZEBRA_STYLES,
  drawTable,
  lastTableBottom,
  teamCell,
  teamCellHooks,
} from "../tables";
import { PDF_COLORS, hexToRgb, pdfSafe, setFill, setText } from "../theme";

const RANK_W = 8;

/** Dessine un tableau de classement ; renvoie l'ordonnée sous la table. */
export function drawStandingsTable(
  page: PdfPage,
  y: number,
  table: PdfStandingsTable,
  opts: { titleFallback?: string } = {},
): number {
  const { doc } = page;
  const title = table.title ?? opts.titleFallback ?? null;
  // Titre + en-tête + 3 lignes sur la même page.
  y = ensureSpace(page, y, 40);
  if (title) {
    const right =
      table.qualifies > 0
        ? `${table.qualifies} qualifié${table.qualifies > 1 ? "s" : ""} pour les play-offs`
        : null;
    y = drawSectionTitle(page, y, title, { right });
  }

  const width = contentWidth(page);
  const statCols = table.columns.length;
  const statW = Math.min(11, (width - RANK_W - 52) / Math.max(1, statCols));
  const teamW = width - RANK_W - statW * statCols;
  const hooks = teamCellHooks({ muted: (i) => table.rows[i]?.muted === true });

  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: RANK_W, halign: "center", fontStyle: "bold" },
    1: { cellWidth: teamW, halign: "left" },
  };
  table.columns.forEach((c: PdfColumn, i) => {
    columnStyles[i + 2] = {
      cellWidth: statW,
      halign: "center",
      ...(c.emphasis
        ? { fontStyle: "bold", fillColor: hexToRgb(PDF_COLORS.ACCENT_TINT) }
        : {}),
    };
  });

  drawTable(doc, {
    startY: y,
    margin: { left: page.margin, right: page.margin, top: 20, bottom: 16 },
    head: [["#", "Équipe", ...table.columns.map((c) => pdfSafe(c.label))]],
    body: table.rows.map((row, i) => [
      String(i + 1),
      teamCell(row.team, "left"),
      ...row.cells.map((c) => pdfSafe(c)),
    ]),
    theme: "grid",
    headStyles: { ...HEAD_STYLES, fontSize: 7 },
    bodyStyles: { ...BODY_STYLES, fontSize: 8.5, minCellHeight: 9 },
    alternateRowStyles: { ...ZEBRA_STYLES },
    columnStyles,
    didParseCell: (data: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown> };
    }) => {
      if (data.section !== "body") return;
      const row = table.rows[data.row.index];
      if (row?.muted) {
        data.cell.styles.textColor = hexToRgb(PDF_COLORS.INK_FAINT);
      }
      // Rang des qualifiés sur fond vert pâle.
      if (data.column.index === 0 && data.row.index < table.qualifies) {
        data.cell.styles.fillColor = hexToRgb(PDF_COLORS.QUALIFIED);
        data.cell.styles.textColor = hexToRgb(PDF_COLORS.QUALIFIED_INK);
      }
    },
    willDrawCell: hooks.willDrawCell,
    didDrawCell: hooks.didDrawCell,
  });
  return lastTableBottom(doc, y + 20) + 6;
}

/** Légende des abréviations de colonnes, sur deux colonnes de texte. */
export function drawColumnLegend(
  page: PdfPage,
  y: number,
  columns: PdfColumn[],
  extra: string[] = [],
): number {
  const { doc } = page;
  const items = columns
    .filter((c) => c.legend)
    .map((c) => `${pdfSafe(c.label)} : ${pdfSafe(c.legend)}`);
  if (items.length === 0 && extra.length === 0) return y;
  const perCol = Math.ceil(items.length / 3);
  const lines = Math.max(perCol, 0) + extra.length;
  y = ensureSpace(page, y, 8 + lines * 3.6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, PDF_COLORS.INK_SOFT);
  const colW = contentWidth(page) / 3;
  items.forEach((item, i) => {
    const col = Math.floor(i / perCol);
    const row = i % perCol;
    doc.text(item, page.margin + col * colW, y + row * 3.4);
  });
  let ey = y + perCol * 3.4 + 1.5;
  for (const e of extra) {
    const wrapped = doc.splitTextToSize(pdfSafe(e), contentWidth(page)) as string[];
    doc.text(wrapped, page.margin, ey);
    ey += wrapped.length * 3.4;
  }
  return ey + 2;
}

function drawQualifiedKey(page: PdfPage, y: number): number {
  const { doc } = page;
  setFill(doc, PDF_COLORS.QUALIFIED);
  doc.rect(page.margin, y - 2.6, 4, 3.2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  setText(doc, PDF_COLORS.INK_SOFT);
  doc.text("Rang qualificatif pour les play-offs", page.margin + 5.5, y);
  return y + 5;
}

export function renderStandings(doc: jsPDF, data: StandingsDocument): void {
  const page = createPage(doc, data.meta, "Classement");
  const played = data.tables.flatMap((t) => t.rows);
  const subtitle =
    data.tables.length > 1
      ? `${data.tables.length} poules - ${played.length} équipes`
      : `${played.length} équipes`;
  let y = drawDocumentHeader(page, subtitle);

  if (data.tables.length === 0 || played.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text("Aucun classement disponible pour l'instant.", page.margin, y + 4);
    finalizePages(page);
    return;
  }

  for (const table of data.tables) {
    y = drawStandingsTable(page, y, table, { titleFallback: "Classement général" });
  }
  if (data.tables.some((t) => t.qualifies > 0)) y = drawQualifiedKey(page, y);
  const extra = [
    data.scoringNote ? `Barème : ${data.scoringNote}` : null,
    data.tieBreakNote ? `Départages, dans l'ordre : ${data.tieBreakNote}` : null,
  ].filter((s): s is string => !!s);
  drawColumnLegend(page, y + 1, data.tables[0].columns, extra);
  finalizePages(page);
}
