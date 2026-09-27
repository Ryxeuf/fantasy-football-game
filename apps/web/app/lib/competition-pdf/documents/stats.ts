/**
 * Statistiques : chiffres clés, palmarès (awards) et totaux par équipe.
 */

import type jsPDF from "jspdf";
import type { StatsDocument } from "../types";
import {
  contentWidth,
  createPage,
  drawDocumentHeader,
  drawSectionTitle,
  ensureSpace,
  finalizePages,
  type PdfPage,
} from "../layout";
import { BODY_STYLES, HEAD_STYLES, ZEBRA_STYLES, drawTable, fitText, lastTableBottom } from "../tables";
import { PDF_COLORS, hexToRgb, pdfSafe, setDraw, setFill, setText } from "../theme";
import { drawColumnLegend, drawStandingsTable } from "./standings";

function drawKeyFigures(page: PdfPage, y: number, data: StatsDocument): number {
  const { doc } = page;
  const figures = data.keyFigures;
  if (figures.length === 0) return y;
  const perRow = Math.min(figures.length, 6);
  const gap = 3;
  const w = (contentWidth(page) - gap * (perRow - 1)) / perRow;
  const h = 17;
  figures.forEach((f, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const x = page.margin + col * (w + gap);
    const ty = y + row * (h + gap);
    setFill(doc, PDF_COLORS.ACCENT_TINT);
    setDraw(doc, PDF_COLORS.RULE);
    doc.setLineWidth(0.2);
    doc.roundedRect(x, ty, w, h, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    setText(doc, PDF_COLORS.INK);
    doc.text(pdfSafe(f.value), x + w / 2, ty + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(fitText(doc, pdfSafe(f.label), w - 3), x + w / 2, ty + 13.2, { align: "center" });
  });
  const rows = Math.ceil(figures.length / perRow);
  return y + rows * (h + gap) + 4;
}

function drawAwards(page: PdfPage, y: number, data: StatsDocument): number {
  if (data.awards.length === 0) return y;
  const { doc } = page;
  y = ensureSpace(page, y, 30);
  y = drawSectionTitle(page, y, "Palmarès");
  const width = contentWidth(page);
  drawTable(doc, {
    startY: y,
    margin: { left: page.margin, right: page.margin, top: 20, bottom: 16 },
    head: [["Distinction", "Lauréat(s)", "Valeur"]],
    body: data.awards.map((a) => [
      {
        content: a.description ? `${pdfSafe(a.label)}\n${pdfSafe(a.description)}` : pdfSafe(a.label),
      },
      pdfSafe(a.winners) || "-",
      pdfSafe(a.value),
    ]),
    theme: "grid",
    headStyles: { ...HEAD_STYLES },
    bodyStyles: { ...BODY_STYLES },
    alternateRowStyles: { ...ZEBRA_STYLES },
    columnStyles: {
      0: { cellWidth: width * 0.38 },
      1: { cellWidth: width * 0.48, fontStyle: "bold" },
      2: { cellWidth: width * 0.14, halign: "center", fontStyle: "bold", fillColor: hexToRgb(PDF_COLORS.ACCENT_TINT) },
    },
    didParseCell: (d: { section: string; column: { index: number }; cell: { styles: Record<string, unknown> } }) => {
      if (d.section === "body" && d.column.index === 0) d.cell.styles.fontSize = 8;
    },
  });
  return lastTableBottom(doc, y + 20) + 7;
}

export function renderStats(doc: jsPDF, data: StatsDocument): void {
  const page = createPage(doc, data.meta, "Statistiques");
  let y = drawDocumentHeader(page, `${data.teamTable.rows.length} équipes`);
  y = drawKeyFigures(page, y, data);
  y = drawAwards(page, y, data);
  y = ensureSpace(page, y, 40);
  y = drawSectionTitle(page, y, "Totaux par équipe");
  y = drawStandingsTable(page, y, { ...data.teamTable, title: null });
  drawColumnLegend(page, y, data.teamTable.columns);
  finalizePages(page);
}
