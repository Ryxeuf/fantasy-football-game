/**
 * Mise en page commune : en-tête de document, bandeau courant des pages
 * suivantes, pied de page numéroté, titres de section et saut de page.
 *
 * Le pied de page (« Page i / N ») et le bandeau courant sont posés en
 * DERNIER (`finalizePages`), une fois le nombre de pages connu : jsPDF sait
 * revenir sur une page, pas effacer un texte déjà écrit.
 */

import type jsPDF from "jspdf";
import type { PdfMeta } from "./types";
import { PDF_COLORS, pdfSafe, setDraw, setFill, setText } from "./theme";

export type Orientation = "portrait" | "landscape";

export interface PdfPage {
  doc: jsPDF;
  width: number;
  height: number;
  margin: number;
  meta: PdfMeta;
  /** Titre du document (« Classement », « Feuille de rencontre »). */
  title: string;
  /** Pages portant déjà l'en-tête complet : pas de bandeau courant. */
  fullHeaderPages: Set<number>;
}

export const MARGIN_MM = 12;
/** Haut de contenu d'une page de continuation (sous le bandeau courant). */
export const CONTINUATION_TOP_MM = 20;
/** Réserve basse pour le pied de page. */
export const FOOTER_RESERVE_MM = 14;

export function createPage(
  doc: jsPDF,
  meta: PdfMeta,
  title: string,
): PdfPage {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  return {
    doc,
    width,
    height,
    margin: MARGIN_MM,
    meta,
    title,
    fullHeaderPages: new Set<number>(),
  };
}

export function contentWidth(page: PdfPage): number {
  return page.width - page.margin * 2;
}

export function bottomLimit(page: PdfPage): number {
  return page.height - FOOTER_RESERVE_MM;
}

function kindLabel(meta: PdfMeta): string {
  return meta.competitionKind === "cup" ? "COUPE" : "LIGUE";
}

/**
 * En-tête complet de la première page. Renvoie l'ordonnée sous le filet.
 * `subtitle` : journée, poule, date… imprimé sous le titre du document.
 */
export function drawDocumentHeader(
  page: PdfPage,
  subtitle?: string | null,
): number {
  const { doc, margin, width, meta } = page;
  const pageNo = doc.getCurrentPageInfo().pageNumber;
  page.fullHeaderPages.add(pageNo);

  // Pastille « LIGUE » / « COUPE ».
  const tag = kindLabel(meta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  // getTextWidth ignore l'espacement des lettres appliqué juste après.
  const tagW = doc.getTextWidth(tag) + tag.length * 0.4 + 4;
  setFill(doc, PDF_COLORS.ACCENT);
  doc.roundedRect(margin, 9, tagW, 4.6, 0.8, 0.8, "F");
  setText(doc, PDF_COLORS.WHITE);
  doc.setCharSpace(0.4);
  doc.text(tag, margin + 2, 12.2);
  doc.setCharSpace(0);

  // Nom de la compétition + saison.
  setText(doc, PDF_COLORS.INK);
  doc.setFontSize(16);
  const name = pdfSafe(meta.competitionName);
  const maxNameW = width - margin * 2 - 70;
  const nameLines = doc.splitTextToSize(name, maxNameW) as string[];
  doc.text(nameLines[0] ?? "", margin, 20.5);
  if (meta.seasonName) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(pdfSafe(meta.seasonName), margin, 25.5);
  }

  // Titre du document, à droite.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, PDF_COLORS.ACCENT_DARK);
  doc.text(pdfSafe(page.title).toUpperCase(), width - margin, 14, {
    align: "right",
  });
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    setText(doc, PDF_COLORS.INK_SOFT);
    const sub = doc.splitTextToSize(pdfSafe(subtitle), 95) as string[];
    doc.text(sub.slice(0, 2), width - margin, 19.5, { align: "right" });
  }

  const ruleY = meta.seasonName ? 29 : 27;
  setDraw(doc, PDF_COLORS.ACCENT);
  doc.setLineWidth(0.6);
  doc.line(margin, ruleY, width - margin, ruleY);
  setDraw(doc, PDF_COLORS.RULE);
  doc.setLineWidth(0.2);
  doc.line(margin, ruleY + 1, width - margin, ruleY + 1);
  return ruleY + 6;
}

/** Nouvelle page ; renvoie l'ordonnée de départ du contenu. */
export function addPage(page: PdfPage): number {
  const orientation = page.width > page.height ? "landscape" : "portrait";
  page.doc.addPage("a4", orientation);
  return CONTINUATION_TOP_MM;
}

/**
 * Garantit `needed` mm de place sous `y` ; sinon ouvre une page et renvoie
 * le nouveau haut de contenu.
 */
export function ensureSpace(page: PdfPage, y: number, needed: number): number {
  if (y + needed <= bottomLimit(page)) return y;
  return addPage(page);
}

/** Titre de section : texte en capitales + filet bronze. */
export function drawSectionTitle(
  page: PdfPage,
  y: number,
  label: string,
  opts: { x?: number; width?: number; right?: string | null } = {},
): number {
  const { doc } = page;
  const x = opts.x ?? page.margin;
  const w = opts.width ?? contentWidth(page);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setText(doc, PDF_COLORS.ACCENT_DARK);
  doc.setCharSpace(0.3);
  doc.text(pdfSafe(label).toUpperCase(), x, y);
  doc.setCharSpace(0);
  if (opts.right) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(pdfSafe(opts.right), x + w, y, { align: "right" });
  }
  setDraw(doc, PDF_COLORS.ACCENT);
  doc.setLineWidth(0.35);
  doc.line(x, y + 1.6, x + w, y + 1.6);
  return y + 6;
}

function formatStamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/**
 * Dernière passe : bandeau courant sur les pages de continuation, pied de
 * page numéroté partout.
 */
export function finalizePages(page: PdfPage): void {
  const { doc, width, height, margin, meta } = page;
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const w = pw || width;
    const h = ph || height;

    if (!page.fullHeaderPages.has(i)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setText(doc, PDF_COLORS.INK);
      const left = [meta.competitionName, meta.seasonName]
        .filter(Boolean)
        .map((s) => pdfSafe(s))
        .join(" - ");
      doc.text(left, margin, 11);
      setText(doc, PDF_COLORS.ACCENT_DARK);
      doc.text(pdfSafe(page.title).toUpperCase(), w - margin, 11, {
        align: "right",
      });
      setDraw(doc, PDF_COLORS.ACCENT);
      doc.setLineWidth(0.4);
      doc.line(margin, 13.5, w - margin, 13.5);
    }

    const fy = h - 8;
    setDraw(doc, PDF_COLORS.RULE);
    doc.setLineWidth(0.2);
    doc.line(margin, fy - 3.5, w - margin, fy - 3.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text(
      `Nuffle Arena - imprimé le ${formatStamp(meta.generatedAt)}`,
      margin,
      fy,
    );
    doc.text(`Page ${i} / ${total}`, w - margin, fy, { align: "right" });
  }
}

/** Petite case à cocher (côté `size` mm), cochée si `checked`. */
export function drawCheckbox(
  doc: jsPDF,
  x: number,
  y: number,
  size = 3,
  checked = false,
): void {
  setDraw(doc, PDF_COLORS.INK_SOFT);
  doc.setLineWidth(0.25);
  doc.rect(x, y, size, size);
  if (checked) {
    doc.setLineWidth(0.5);
    setDraw(doc, PDF_COLORS.INK);
    doc.line(x + 0.6, y + size / 2, x + size * 0.42, y + size - 0.6);
    doc.line(x + size * 0.42, y + size - 0.6, x + size - 0.5, y + 0.5);
  }
}

/** Ligne d'écriture pointillée (champ à remplir à la main). */
export function drawWriteLine(
  doc: jsPDF,
  x1: number,
  x2: number,
  y: number,
): void {
  setDraw(doc, PDF_COLORS.INK_FAINT);
  doc.setLineWidth(0.2);
  doc.setLineDashPattern([0.6, 0.8], 0);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
}

/**
 * Champ « Libellé : ______ » (valeur pré-remplie si connue). Renvoie
 * l'abscisse de fin.
 */
export function drawField(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  label: string,
  value?: string | number | null,
): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(doc, PDF_COLORS.INK_SOFT);
  const l = `${pdfSafe(label)} :`;
  doc.text(l, x, y);
  const lx = x + doc.getTextWidth(l) + 1.5;
  drawWriteLine(doc, lx, x + width, y + 0.8);
  if (value !== null && value !== undefined && String(value) !== "") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setText(doc, PDF_COLORS.INK);
    doc.text(pdfSafe(value), lx + 1, y);
  }
}

/** Boîte vide à remplir (score, jet de dé). */
export function drawBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  value?: string | number | null,
  fontSize = 12,
): void {
  setDraw(doc, PDF_COLORS.INK);
  doc.setLineWidth(0.35);
  setFill(doc, PDF_COLORS.WHITE);
  doc.rect(x, y, w, h, "FD");
  if (value !== null && value !== undefined && String(value) !== "") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    setText(doc, PDF_COLORS.INK);
    doc.text(pdfSafe(value), x + w / 2, y + h / 2, {
      align: "center",
      baseline: "middle",
    });
  }
}

/** « Équipe (Coach) · Roster » sur une ligne, pour les tableaux denses. */
export function teamLine(team: {
  name: string;
  coach?: string | null;
  rosterName?: string | null;
}): string {
  return pdfSafe(team.name);
}

export function teamDetail(team: {
  coach?: string | null;
  rosterName?: string | null;
}): string {
  return [team.rosterName, team.coach ? `coach ${team.coach}` : null]
    .filter(Boolean)
    .map((s) => pdfSafe(s))
    .join(" - ");
}
