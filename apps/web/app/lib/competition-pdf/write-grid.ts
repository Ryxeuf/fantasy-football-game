/**
 * Grille « à remplir au stylo » dessinée à la main : en-tête sombre, lignes
 * vides (ou pré-remplies) de hauteur fixe. Plus prévisible qu'autotable pour
 * deux petites grilles côte à côte sur une même page.
 */

import type jsPDF from "jspdf";
import { fitText } from "./tables";
import { PDF_COLORS, pdfSafe, setDraw, setFill, setText } from "./theme";

export interface GridColumn {
  label: string;
  /** Largeur relative (répartie sur la largeur totale). */
  weight: number;
  align?: "left" | "center";
}

export interface WriteGridOptions {
  x: number;
  y: number;
  width: number;
  columns: GridColumn[];
  /** Lignes pré-remplies (texte par colonne). */
  rows?: string[][];
  /** Nombre minimal de lignes (complété par des lignes vides). */
  minRows: number;
  rowHeight?: number;
  headHeight?: number;
  fontSize?: number;
}

/** Dessine la grille ; renvoie l'ordonnée sous la dernière ligne. */
export function drawWriteGrid(doc: jsPDF, opts: WriteGridOptions): number {
  const rowH = opts.rowHeight ?? 6;
  const headH = opts.headHeight ?? 5;
  const fontSize = opts.fontSize ?? 7.5;
  const total = opts.columns.reduce((n, c) => n + c.weight, 0);
  const widths = opts.columns.map((c) => (c.weight / total) * opts.width);
  const rows = opts.rows ?? [];
  const n = Math.max(opts.minRows, rows.length);

  // En-tête.
  setFill(doc, PDF_COLORS.HEAD_FILL);
  doc.rect(opts.x, opts.y, opts.width, headH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.6);
  setText(doc, PDF_COLORS.WHITE);
  let cx = opts.x;
  opts.columns.forEach((c, i) => {
    const w = widths[i];
    const label = fitText(doc, pdfSafe(c.label), w - 1.5);
    if (c.align === "left") doc.text(label, cx + 1.2, opts.y + headH - 1.5);
    else doc.text(label, cx + w / 2, opts.y + headH - 1.5, { align: "center" });
    cx += w;
  });

  // Corps.
  let y = opts.y + headH;
  setDraw(doc, PDF_COLORS.RULE);
  doc.setLineWidth(0.2);
  for (let r = 0; r < n; r++) {
    if (r % 2 === 1) {
      setFill(doc, PDF_COLORS.ZEBRA);
      doc.rect(opts.x, y, opts.width, rowH, "F");
    }
    const values = rows[r];
    if (values) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
      setText(doc, PDF_COLORS.INK);
      let vx = opts.x;
      opts.columns.forEach((c, i) => {
        const w = widths[i];
        const v = fitText(doc, pdfSafe(values[i] ?? ""), w - 2);
        if (c.align === "left") doc.text(v, vx + 1.2, y + rowH / 2 + 1.1);
        else doc.text(v, vx + w / 2, y + rowH / 2 + 1.1, { align: "center" });
        vx += w;
      });
    }
    y += rowH;
    setDraw(doc, PDF_COLORS.RULE);
    doc.line(opts.x, y, opts.x + opts.width, y);
  }
  // Séparateurs verticaux + cadre.
  cx = opts.x;
  widths.slice(0, -1).forEach((w) => {
    cx += w;
    doc.line(cx, opts.y + headH, cx, y);
  });
  setDraw(doc, PDF_COLORS.INK_SOFT);
  doc.setLineWidth(0.3);
  doc.rect(opts.x, opts.y, opts.width, y - opts.y);
  return y;
}
