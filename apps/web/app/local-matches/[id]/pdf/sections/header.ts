/**
 * En-tete cartouche de la page 1: bandeau "BLOOD BOWL — GAME SUMMARY"
 * + sous-bandeau coupe & date avec sceau circulaire.
 */

import type jsPDF from "jspdf";
import { PALETTE, setDrawHex, setFillHex, setTextHex } from "../colors";
import { drawSeal } from "../icons";
import { CONTENT_WIDTH_MM, MARGIN_MM } from "../chrome";
import type { PdfMatch } from "../types";

const BANNER_HEIGHT = 28;
const SUB_BANNER_HEIGHT = 8;

export interface HeaderRenderResult {
  /** Y en mm immediatement sous l'en-tete (utile pour chainer la section suivante). */
  bottomY: number;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function drawHeader(doc: jsPDF, match: PdfMatch, startY = 12): HeaderRenderResult {
  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;

  // Bandeau principal sang
  setFillHex(doc, PALETTE.BLOOD);
  doc.rect(x, startY, w, BANNER_HEIGHT, "F");

  // Double filet dore
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.8);
  doc.rect(x + 1.5, startY + 1.5, w - 3, BANNER_HEIGHT - 3, "D");
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.3);
  doc.rect(x + 3, startY + 3, w - 6, BANNER_HEIGHT - 6, "D");

  // Titre principal
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setTextHex(doc, PALETTE.BONE);
  doc.setCharSpace(1.4);
  doc.text("BLOOD BOWL", x + 8, startY + 16);
  doc.setCharSpace(0);

  // Sous-titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextHex(doc, PALETTE.GOLD);
  doc.setCharSpace(2);
  doc.text("OFFICIAL GAME SUMMARY", x + 8, startY + 23);
  doc.setCharSpace(0);

  // Sceau circulaire
  drawSeal(doc, x + w - 18, startY + BANNER_HEIGHT / 2, 10);

  // Sous-bandeau ink: nom de match / coupe / date
  const subY = startY + BANNER_HEIGHT;
  setFillHex(doc, PALETTE.INK);
  doc.rect(x, subY, w, SUB_BANNER_HEIGHT, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextHex(doc, PALETTE.BONE);

  const matchName = match.name?.trim() || "Match amical";
  const cup = match.cup?.name?.trim() || null;
  const dateStr = formatDate(match.completedAt ?? match.startedAt);

  // Gauche : nom du match (+ coupe inline avec separateur losange)
  let leftLabel = matchName;
  if (cup) leftLabel += `  ◆  ${cup.toUpperCase()}`;
  const maxLeftWidth = w / 2 - 4;
  const leftLines = doc.splitTextToSize(leftLabel.toUpperCase(), maxLeftWidth);
  doc.text(leftLines[0] ?? "", x + 4, subY + SUB_BANNER_HEIGHT / 2 + 1.4);

  // Droite : date
  if (dateStr) {
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, x + w - 4, subY + SUB_BANNER_HEIGHT / 2 + 1.4, { align: "right" });
  }

  return { bottomY: subY + SUB_BANNER_HEIGHT };
}
