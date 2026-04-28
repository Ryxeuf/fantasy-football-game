/**
 * Chrome de page: fond parchemin, footer ornemente, numerotation finale.
 *
 * Le fond et le footer sont appeles a chaque page. Le footer est dessine
 * sans le numero "Page i/N" qui est applique en post-traitement (une fois
 * que le total de pages est connu) via `paginate(doc, matchName)`.
 */

import type jsPDF from "jspdf";
import { PALETTE, setDrawHex, setFillHex, setTextHex } from "./colors";
import { drawClosedPath } from "./icons";

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const MARGIN_MM = 12;
export const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2;

const PAGE_FOOTER_PLACEHOLDER = "__PAGE_NUMBER__";

/**
 * Fond parchemin avec mouchetures deterministes.
 */
export function drawParchment(doc: jsPDF): void {
  setFillHex(doc, PALETTE.PARCHMENT);
  doc.rect(0, 0, PAGE_WIDTH_MM, PAGE_HEIGHT_MM, "F");
  setFillHex(doc, PALETTE.PARCHMENT_DARK);
  for (let i = 0; i < 80; i++) {
    const x = ((i * 73) % 200) + 5;
    const y = ((i * 109) % 285) + 6;
    const r = 0.25 + ((i * 17) % 5) * 0.08;
    doc.circle(x, y, r, "F");
  }
  // Coins ornementes
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.3);
  const corners: Array<[number, number, number, number]> = [
    [4, 4, 14, 4],
    [4, 4, 4, 14],
    [PAGE_WIDTH_MM - 14, 4, PAGE_WIDTH_MM - 4, 4],
    [PAGE_WIDTH_MM - 4, 4, PAGE_WIDTH_MM - 4, 14],
    [4, PAGE_HEIGHT_MM - 14, 4, PAGE_HEIGHT_MM - 4],
    [4, PAGE_HEIGHT_MM - 4, 14, PAGE_HEIGHT_MM - 4],
    [PAGE_WIDTH_MM - 14, PAGE_HEIGHT_MM - 4, PAGE_WIDTH_MM - 4, PAGE_HEIGHT_MM - 4],
    [PAGE_WIDTH_MM - 4, PAGE_HEIGHT_MM - 14, PAGE_WIDTH_MM - 4, PAGE_HEIGHT_MM - 4],
  ];
  for (const [x1, y1, x2, y2] of corners) {
    doc.line(x1, y1, x2, y2);
  }
}

/**
 * Footer + filet decoratif. Le numero de page est laisse en placeholder, a
 * remplacer apres generation complete (cf. paginate).
 */
export function drawFooter(doc: jsPDF, matchName: string): void {
  const y = PAGE_HEIGHT_MM - 10;
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_MM, y - 2, PAGE_WIDTH_MM - MARGIN_MM, y - 2);

  // Losange dore central
  setFillHex(doc, PALETTE.GOLD);
  const cx = PAGE_WIDTH_MM / 2;
  drawClosedPath(
    doc,
    [
      [cx, y - 4],
      [cx + 1.5, y - 2],
      [cx, y],
      [cx - 1.5, y - 2],
    ],
    "F",
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextHex(doc, PALETTE.INK_SOFT);

  const truncated = matchName.length > 50 ? matchName.slice(0, 47) + "..." : matchName;
  doc.text(truncated, MARGIN_MM, y + 1.5);

  doc.setFont("helvetica", "bold");
  doc.setCharSpace(0.6);
  doc.text("NUFFLE BE PRAISED", cx, y + 2.4, { align: "center" });
  doc.setCharSpace(0);

  doc.setFont("helvetica", "normal");
  doc.text(PAGE_FOOTER_PLACEHOLDER, PAGE_WIDTH_MM - MARGIN_MM, y + 1.5, { align: "right" });
}

/** Decore une nouvelle page: parchemin + footer (sans numero). */
export function decoratePage(doc: jsPDF, matchName: string): void {
  drawParchment(doc);
  drawFooter(doc, matchName);
}

/**
 * Remplace le placeholder __PAGE_NUMBER__ par "Page i/N" sur chaque page.
 * Doit etre appele en derniere etape de generation.
 */
export function paginate(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const y = PAGE_HEIGHT_MM - 10;
    // jsPDF n'a pas d'API pour effacer du texte: on masque la zone du
    // placeholder en redessinant un rect parchemin local avant d'imprimer
    // "Page i / N" par-dessus.
    setFillHex(doc, PALETTE.PARCHMENT);
    doc.rect(PAGE_WIDTH_MM - MARGIN_MM - 30, y - 0.5, 30, 5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextHex(doc, PALETTE.INK_SOFT);
    doc.text(`Page ${i} / ${total}`, PAGE_WIDTH_MM - MARGIN_MM, y + 1.5, { align: "right" });
  }
}
