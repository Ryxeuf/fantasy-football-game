/**
 * Tops : une carte par catégorie (meilleurs marqueurs, cogneurs…), deux
 * cartes par rangée, section joueurs puis section équipes.
 */

import type jsPDF from "jspdf";
import type { LeaderboardsDocument, PdfLeaderCategory } from "../types";
import {
  contentWidth,
  createPage,
  drawDocumentHeader,
  drawSectionTitle,
  ensureSpace,
  finalizePages,
  type PdfPage,
} from "../layout";
import { fitText } from "../tables";
import { PDF_COLORS, pdfSafe, setDraw, setFill, setText } from "../theme";

const CARD_GAP = 5;
const CARD_HEAD_H = 11;
const ROW_H = 7;
const MEDALS = ["#C9A24A", "#A8A29E", "#A0673A"];

function cardHeight(cat: PdfLeaderCategory, maxRows: number): number {
  return CARD_HEAD_H + Math.max(1, Math.min(cat.rows.length, maxRows)) * ROW_H + 2;
}

function drawCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  cat: PdfLeaderCategory,
  maxRows: number,
): void {
  setDraw(doc, PDF_COLORS.RULE);
  doc.setLineWidth(0.25);
  setFill(doc, PDF_COLORS.WHITE);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  setFill(doc, PDF_COLORS.ACCENT_TINT);
  doc.rect(x + 0.2, y + 0.2, w - 0.4, CARD_HEAD_H - 1, "F");
  setFill(doc, PDF_COLORS.ACCENT);
  doc.rect(x, y + 0.2, 1.3, CARD_HEAD_H - 1, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, PDF_COLORS.INK);
  doc.text(fitText(doc, pdfSafe(cat.label), w - 8), x + 4, y + 4.6);
  if (cat.description) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(fitText(doc, pdfSafe(cat.description), w - 8), x + 4, y + 8.3);
  }

  let ry = y + CARD_HEAD_H + 1;
  if (cat.rows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text("Personne pour l'instant.", x + 4, ry + 4.3);
    return;
  }
  for (const row of cat.rows.slice(0, maxRows)) {
    // Pastille de rang : médaille pour le podium.
    const cx = x + 5.5;
    const cy = ry + ROW_H / 2;
    const medal = MEDALS[row.rank - 1];
    if (medal) {
      setFill(doc, medal);
      doc.circle(cx, cy, 2.3, "F");
      setText(doc, PDF_COLORS.WHITE);
    } else {
      setDraw(doc, PDF_COLORS.RULE);
      doc.circle(cx, cy, 2.3, "S");
      setText(doc, PDF_COLORS.INK_SOFT);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(String(row.rank), cx, cy + 0.9, { align: "center" });

    const valueStr = pdfSafe(row.value);
    doc.setFontSize(10);
    const valueW = doc.getTextWidth(valueStr);
    setText(doc, PDF_COLORS.INK);
    doc.text(valueStr, x + w - 4, cy + 1.3, { align: "right" });

    const textW = w - 13 - valueW - 6;
    doc.setFontSize(8);
    doc.text(fitText(doc, pdfSafe(row.name), textW), x + 10, row.detail ? cy - 0.4 : cy + 1);
    if (row.detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      setText(doc, PDF_COLORS.INK_SOFT);
      doc.text(fitText(doc, pdfSafe(row.detail), textW), x + 10, cy + 2.6);
    }
    ry += ROW_H;
    setDraw(doc, PDF_COLORS.ZEBRA);
    doc.setLineWidth(0.2);
    if (ry < y + h - 2) doc.line(x + 3, ry, x + w - 3, ry);
  }
}

function drawCategoryGrid(
  page: PdfPage,
  y: number,
  categories: PdfLeaderCategory[],
  maxRows: number,
): number {
  const { doc } = page;
  const colW = (contentWidth(page) - CARD_GAP) / 2;
  for (let i = 0; i < categories.length; i += 2) {
    const pair = categories.slice(i, i + 2);
    const h = Math.max(...pair.map((c) => cardHeight(c, maxRows)));
    y = ensureSpace(page, y, h + CARD_GAP);
    pair.forEach((cat, j) => {
      drawCard(doc, page.margin + j * (colW + CARD_GAP), y, colW, h, cat, maxRows);
    });
    y += h + CARD_GAP;
  }
  return y;
}

export function renderLeaderboards(doc: jsPDF, data: LeaderboardsDocument): void {
  const page = createPage(doc, data.meta, "Tops");
  const maxRows = Math.max(
    1,
    ...data.sections.flatMap((s) => s.categories.map((c) => c.rows.length)),
  );
  let y = drawDocumentHeader(page, `Top ${Math.min(maxRows, 10)} par catégorie`);
  const nonEmpty = data.sections.filter((s) => s.categories.length > 0);
  if (nonEmpty.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text("Aucune statistique pour l'instant.", page.margin, y + 4);
  }
  for (const section of nonEmpty) {
    y = ensureSpace(page, y, 50);
    y = drawSectionTitle(page, y, section.title);
    y = drawCategoryGrid(page, y, section.categories, Math.min(maxRows, 10));
    y += 2;
  }
  finalizePages(page);
}
