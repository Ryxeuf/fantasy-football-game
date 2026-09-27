/**
 * Aides autour de jspdf-autotable : cellule d'équipe sur deux lignes (nom en
 * gras, roster + coach en petit), styles communs, ordonnée de fin de table.
 */

import type jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PdfTeamRef } from "./types";
import { PDF_COLORS, hexToRgb, pdfSafe, setText } from "./theme";
import { teamDetail } from "./layout";

/** Marqueur d'une cellule dessinée à la main (cf. `teamCellHooks`). */
interface TeamCellRaw {
  __team: true;
  name: string;
  detail: string;
  align: "left" | "right";
}

export function teamCell(
  team: PdfTeamRef | null,
  align: "left" | "right" = "left",
  emptyLabel = "",
): { content: string; raw?: TeamCellRaw } | string {
  if (!team) return emptyLabel;
  const name = pdfSafe(team.name);
  const detail = teamDetail(team);
  return {
    content: detail ? `${name}\n${detail}` : name,
    raw: { __team: true, name, detail, align },
  } as { content: string; raw: TeamCellRaw };
}

function isTeamRaw(raw: unknown): raw is TeamCellRaw {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as { __team?: unknown }).__team === true
  );
}

/** autotable garde l'objet de cellule saisi dans `cell.raw` : on y relit l'équipe. */
function extractTeam(raw: unknown): TeamCellRaw | null {
  if (isTeamRaw(raw)) return raw;
  const nested = (raw as { raw?: unknown } | null)?.raw;
  return isTeamRaw(nested) ? nested : null;
}

interface HookCell {
  raw: unknown;
  text: string[];
  x: number;
  y: number;
  width: number;
  height: number;
  padding: (side: "left" | "right" | "top" | "bottom") => number;
  styles: { fontStyle?: string; textColor?: unknown };
}

interface HookData {
  cell: HookCell;
  section: "head" | "body" | "foot";
  column: { index: number };
  row: { index: number; raw: unknown };
  doc: jsPDF;
}

/**
 * Hooks à brancher sur un autoTable qui contient des `teamCell` : la hauteur
 * est calculée sur le texte à deux lignes, puis le texte est redessiné avec
 * deux graisses (autotable n'en gère qu'une par cellule).
 */
export function teamCellHooks(opts: { muted?: (rowIndex: number) => boolean } = {}) {
  return {
    willDrawCell: (data: HookData) => {
      if (data.section === "body" && extractTeam(data.cell.raw)) {
        data.cell.text = [];
      }
    },
    didDrawCell: (data: HookData) => {
      if (data.section !== "body") return;
      const team = extractTeam(data.cell.raw);
      if (!team) return;
      const { doc, cell } = data;
      const muted = opts.muted?.(data.row.index) ?? false;
      const padL = cell.padding("left");
      const padR = cell.padding("right");
      const x = team.align === "right" ? cell.x + cell.width - padR : cell.x + padL;
      const hasDetail = team.detail.length > 0;
      const midY = cell.y + cell.height / 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(doc, muted ? PDF_COLORS.INK_FAINT : PDF_COLORS.INK);
      const maxW = cell.width - padL - padR;
      const name = fitText(doc, team.name, maxW);
      doc.text(name, x, hasDetail ? midY - 0.6 : midY + 1.1, { align: team.align });
      if (hasDetail) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        setText(doc, PDF_COLORS.INK_SOFT);
        doc.text(fitText(doc, team.detail, maxW), x, midY + 2.9, { align: team.align });
      }
    },
  };
}

/** Tronque avec « … » pour tenir dans `maxW` mm à la police courante. */
export function fitText(doc: jsPDF, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}...`) > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/** Ordonnée sous la dernière table dessinée. */
export function lastTableBottom(doc: jsPDF, fallback: number): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } })
    .lastAutoTable;
  return typeof last?.finalY === "number" ? last.finalY : fallback;
}

export const HEAD_STYLES = {
  fillColor: hexToRgb(PDF_COLORS.HEAD_FILL),
  textColor: hexToRgb(PDF_COLORS.WHITE),
  fontStyle: "bold",
  fontSize: 7.5,
  halign: "center",
  valign: "middle",
  cellPadding: { top: 1.6, bottom: 1.6, left: 1.2, right: 1.2 },
} as const;

export const BODY_STYLES = {
  font: "helvetica",
  fontSize: 8.5,
  textColor: hexToRgb(PDF_COLORS.INK),
  lineColor: hexToRgb(PDF_COLORS.RULE),
  lineWidth: 0.15,
  valign: "middle",
  cellPadding: { top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
} as const;

export const ZEBRA_STYLES = {
  fillColor: hexToRgb(PDF_COLORS.ZEBRA),
} as const;

/**
 * autotable avec des hooks typés localement : ses propres types de hooks
 * (`CellHookData`) ne recoupent pas ceux déclarés dans `types/`, d'où un
 * seul point de conversion plutôt qu'un cast à chaque appel.
 */
export function drawTable(doc: jsPDF, options: Record<string, unknown>): void {
  autoTable(doc, options as unknown as Parameters<typeof autoTable>[1]);
}
