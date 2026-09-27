/**
 * Play-offs : arbre d'élimination directe en paysage (quarts → finale →
 * vainqueur), cases de score vides tant qu'une rencontre n'est pas jouée.
 */

import type jsPDF from "jspdf";
import type { BracketDocument, PdfFixture, PdfTeamRef } from "../types";
import { createPage, drawDocumentHeader, finalizePages, teamDetail } from "../layout";
import { fitText } from "../tables";
import { PDF_COLORS, pdfSafe, setDraw, setFill, setText } from "../theme";

const BOX_H = 21;
const LINE_H = BOX_H / 2;
const SCORE_W = 9;
const COL_GAP = 12;

/**
 * Centres verticaux de chaque match, tour par tour : le premier tour se
 * répartit sur la hauteur, chaque tour suivant se centre entre ses deux
 * rencontres d'origine. Si un tour ne compte pas la moitié du précédent
 * (bracket incomplet), il se répartit lui aussi uniformément.
 */
export function bracketCenters(
  counts: number[],
  top: number,
  height: number,
): number[][] {
  const centers: number[][] = [];
  counts.forEach((n, k) => {
    const prev = centers[k - 1];
    if (k > 0 && prev && prev.length === n * 2) {
      centers.push(
        Array.from({ length: n }, (_, j) => (prev[2 * j] + prev[2 * j + 1]) / 2),
      );
      return;
    }
    const slot = height / Math.max(1, n);
    centers.push(Array.from({ length: n }, (_, j) => top + slot * (j + 0.5)));
  });
  return centers;
}

function winnerSide(f: PdfFixture): "home" | "away" | null {
  if (!f.score) return null;
  if (f.score.home > f.score.away) return "home";
  if (f.score.away > f.score.home) return "away";
  return null;
}

function drawTeamLine(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  team: PdfTeamRef | null,
  score: number | null,
  isWinner: boolean,
): void {
  if (isWinner) {
    setFill(doc, PDF_COLORS.QUALIFIED);
    doc.rect(x + 0.2, y + 0.2, w - SCORE_W - 0.4, LINE_H - 0.4, "F");
  }
  const textW = w - SCORE_W - 5;
  if (team) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    setText(doc, PDF_COLORS.INK);
    doc.text(fitText(doc, pdfSafe(team.name), textW), x + 2.5, y + 4.4);
    const detail = teamDetail(team);
    if (detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      setText(doc, PDF_COLORS.INK_SOFT);
      doc.text(fitText(doc, detail, textW), x + 2.5, y + 7.9);
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text("À déterminer", x + 2.5, y + 6);
  }
  // Case de score.
  setDraw(doc, PDF_COLORS.INK_SOFT);
  doc.setLineWidth(0.25);
  doc.line(x + w - SCORE_W, y, x + w - SCORE_W, y + LINE_H);
  if (score !== null) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(doc, PDF_COLORS.INK);
    doc.text(String(score), x + w - SCORE_W / 2, y + 6.6, { align: "center" });
  }
}

function drawMatchBox(doc: jsPDF, x: number, cy: number, w: number, f: PdfFixture): void {
  const y = cy - BOX_H / 2;
  setFill(doc, PDF_COLORS.WHITE);
  setDraw(doc, PDF_COLORS.INK);
  doc.setLineWidth(0.35);
  doc.rect(x, y, w, BOX_H, "FD");
  setDraw(doc, PDF_COLORS.RULE);
  doc.setLineWidth(0.2);
  doc.line(x, cy, x + w, cy);
  const win = winnerSide(f);
  const away = f.placeholder ? null : f.away;
  drawTeamLine(doc, x, y, w, f.home, f.score?.home ?? null, win === "home");
  drawTeamLine(doc, x, cy, w, away, f.score?.away ?? null, win === "away");
  if (f.scheduledLabel && !f.score) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(pdfSafe(f.scheduledLabel), x, y + BOX_H + 3.2);
  }
}

export function renderBracket(doc: jsPDF, data: BracketDocument): void {
  const page = createPage(doc, data.meta, "Play-offs");
  const top0 = drawDocumentHeader(page, data.note ?? null);
  const stages = data.stages.filter((s) => s.fixtures.length > 0);

  if (stages.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text("Le tableau des play-offs n'est pas encore connu.", page.margin, top0 + 6);
    finalizePages(page);
    return;
  }

  const columns = stages.length + 1; // + colonne du vainqueur
  const usableW = page.width - page.margin * 2;
  const colW = (usableW - COL_GAP * (columns - 1)) / columns;
  const top = top0 + 8;
  const height = page.height - 22 - top;
  const centers = bracketCenters(
    stages.map((s) => s.fixtures.length),
    top,
    height,
  );

  stages.forEach((stage, k) => {
    const x = page.margin + k * (colW + COL_GAP);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, PDF_COLORS.ACCENT_DARK);
    doc.text(pdfSafe(stage.label).toUpperCase(), x + colW / 2, top0 + 2, { align: "center" });
    stage.fixtures.forEach((f, j) => {
      const cy = centers[k][j];
      drawMatchBox(doc, x, cy, colW, f);
      // Connecteur vers le tour suivant.
      const next = centers[k + 1];
      if (next && next.length * 2 === stage.fixtures.length) {
        const ny = next[Math.floor(j / 2)];
        const x1 = x + colW;
        const xm = x1 + COL_GAP / 2;
        setDraw(doc, PDF_COLORS.INK_SOFT);
        doc.setLineWidth(0.3);
        doc.line(x1, cy, xm, cy);
        doc.line(xm, cy, xm, ny);
        doc.line(xm, ny, x1 + COL_GAP, ny);
      }
    });
  });

  // Vainqueur.
  const lastK = stages.length - 1;
  const finalCy = centers[lastK][0];
  const wx = page.margin + stages.length * (colW + COL_GAP);
  const lastStageX = page.margin + lastK * (colW + COL_GAP) + colW;
  setDraw(doc, PDF_COLORS.INK_SOFT);
  doc.setLineWidth(0.3);
  doc.line(lastStageX, finalCy, wx, finalCy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, PDF_COLORS.ACCENT_DARK);
  doc.text("VAINQUEUR", wx + colW / 2, top0 + 2, { align: "center" });
  setFill(doc, PDF_COLORS.ACCENT_TINT);
  setDraw(doc, PDF_COLORS.ACCENT);
  doc.setLineWidth(0.6);
  const bh = 16;
  doc.roundedRect(wx, finalCy - bh / 2, colW, bh, 2, 2, "FD");
  if (data.champion) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setText(doc, PDF_COLORS.INK);
    doc.text(fitText(doc, pdfSafe(data.champion.name), colW - 6), wx + colW / 2, finalCy - 0.3, { align: "center" });
    const detail = teamDetail(data.champion);
    if (detail) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      setText(doc, PDF_COLORS.INK_SOFT);
      doc.text(fitText(doc, detail, colW - 6), wx + colW / 2, finalCy + 4, { align: "center" });
    }
  } else {
    doc.setLineDashPattern([0.6, 0.8], 0);
    setDraw(doc, PDF_COLORS.INK_FAINT);
    doc.setLineWidth(0.2);
    doc.line(wx + 5, finalCy + 3, wx + colW - 5, finalCy + 3);
    doc.setLineDashPattern([], 0);
  }
  finalizePages(page);
}
