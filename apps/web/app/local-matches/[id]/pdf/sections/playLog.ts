/**
 * Play-by-play log: tableau autotable plein cadre, multi-pages.
 * Colonnes: H | T | TEAM | ICON | EVENEMENT (wrap) | RESULTAT.
 */

import type jsPDF from "jspdf";
import autoTable, { type CellHookData } from "jspdf-autotable";
import { getTeamColors } from "@bb/game-engine";
import {
  PALETTE,
  parseHex,
  resolveTeamColors,
  setDrawHex,
  setFillHex,
  setTextHex,
} from "../colors";
import { drawIcon, type IconKind } from "../icons";
import { CONTENT_WIDTH_MM, MARGIN_MM, PAGE_HEIGHT_MM, PAGE_WIDTH_MM } from "../chrome";
import type { ActionType, PdfAction, PdfMatch } from "../types";

const ACTION_LABELS: Record<ActionType, string> = {
  passe: "Passe",
  reception: "Reception",
  td: "Touchdown",
  blocage: "Blocage",
  blitz: "Blitz",
  transmission: "Transmission",
  aggression: "Agression",
  sprint: "Sprint",
  esquive: "Esquive",
  apothicaire: "Apothicaire",
  interception: "Interception",
};

function eventDescription(action: PdfAction, teamAName: string, teamBName: string): string {
  const teamName = action.playerTeam === "A" ? teamAName : teamBName;
  const oppTeamName = action.playerTeam === "A" ? teamBName : teamAName;
  let desc = `${ACTION_LABELS[action.actionType]} — ${action.playerName} (${teamName})`;
  if (action.opponentName) {
    desc += ` vs ${action.opponentName} (${oppTeamName})`;
  }
  if (action.diceResult !== null) {
    desc += ` — De ${action.diceResult}`;
  }
  if (action.actionType === "passe" && action.passType) {
    desc += ` — ${action.passType}`;
  }
  return desc;
}

function resultLabel(action: PdfAction): { text: string; color: string } {
  if (action.fumble) {
    return {
      text: action.playerState ? `ECHEC — ${action.playerState.toUpperCase()}` : "ECHEC",
      color: PALETTE.LOSS_RED,
    };
  }
  if (action.actionType === "blocage" || action.actionType === "blitz" || action.actionType === "aggression") {
    if (action.armorBroken) {
      const state = (action.opponentState || "").toUpperCase();
      if (state === "ELIMINE") return { text: "CASUALTY", color: PALETTE.BLOOD };
      if (state === "KO") return { text: "KO", color: PALETTE.GOLD_DARK };
      if (state === "SONNE") return { text: "SONNE", color: PALETTE.IRON };
      return { text: "ARMURE BRISEE", color: PALETTE.GOLD_DARK };
    }
    return { text: "ARMURE TENUE", color: PALETTE.INK_SOFT };
  }
  if (action.actionType === "td") return { text: "TOUCHDOWN", color: PALETTE.WIN_GREEN };
  if (action.actionType === "interception") return { text: "INTERCEPTION", color: PALETTE.WIN_GREEN };
  return { text: "OK", color: PALETTE.INK_SOFT };
}

/**
 * Footer alternatif pour les pages de continuation creees par autotable.
 * Ne dessine PAS de rect parchemin (qui masquerait la table) — uniquement
 * le filet dore + le losange + le texte. Le numero de page est laisse au
 * placeholder pour etre remplace en post par paginate().
 */
function drawContinuationFooter(doc: jsPDF, matchName: string): void {
  const y = PAGE_HEIGHT_MM - 10;
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.4);
  doc.line(MARGIN_MM, y - 2, MARGIN_MM + CONTENT_WIDTH_MM, y - 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setTextHex(doc, PALETTE.INK_SOFT);
  const truncated = matchName.length > 50 ? matchName.slice(0, 47) + "..." : matchName;
  doc.text(truncated, MARGIN_MM, y + 1.5);
  doc.setFont("helvetica", "bold");
  doc.setCharSpace(0.6);
  doc.text("NUFFLE BE PRAISED", PAGE_WIDTH_MM / 2, y + 2.4, { align: "center" });
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");
  // Placeholder identique a celui pose par drawFooter — paginate() s'en occupe.
  doc.text("__PAGE_NUMBER__", PAGE_WIDTH_MM - MARGIN_MM, y + 1.5, { align: "right" });
}

function drawTitleBand(doc: jsPDF, y: number): number {
  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;
  const h = 7;
  setFillHex(doc, PALETTE.BLOOD);
  doc.rect(x, y, w, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  setTextHex(doc, PALETTE.BONE);
  doc.setCharSpace(2);
  doc.text("OFFICIAL PLAY-BY-PLAY LOG", x + w / 2, y + h / 2 + 1.4, { align: "center" });
  doc.setCharSpace(0);
  return y + h;
}

export interface PlayLogResult {
  bottomY: number;
}

function ensurePageHeader(doc: jsPDF, decoratePage: () => void): number {
  doc.addPage();
  decoratePage();
  return drawTitleBand(doc, 14);
}

interface RowMeta {
  team: "A" | "B";
  iconKind: IconKind;
  failed: boolean;
  resultColor: string;
}

export function drawPlayLog(
  doc: jsPDF,
  match: PdfMatch,
  actions: ReadonlyArray<PdfAction>,
  startY: number,
  decoratePage: () => void,
): PlayLogResult {
  if (actions.length === 0) {
    return { bottomY: startY };
  }

  // Si on n'a pas la place pour le bandeau + au moins 3 lignes, on saute en page suivante.
  let tableStartY: number;
  let firstTablePage: number;
  if (startY + 30 > PAGE_HEIGHT_MM - 18) {
    tableStartY = ensurePageHeader(doc, decoratePage);
    firstTablePage = doc.getCurrentPageInfo().pageNumber;
  } else {
    tableStartY = drawTitleBand(doc, startY + 4);
    firstTablePage = doc.getCurrentPageInfo().pageNumber;
  }

  const teamAName = match.teamA.name;
  const teamBName = match.teamB.name;

  const colorsA = resolveTeamColors(
    match.teamA.roster ? getTeamColors(match.teamA.roster).primary : undefined,
    match.teamA.roster ? getTeamColors(match.teamA.roster).secondary : undefined,
  );
  const colorsB = resolveTeamColors(
    match.teamB.roster ? getTeamColors(match.teamB.roster).primary : undefined,
    match.teamB.roster ? getTeamColors(match.teamB.roster).secondary : undefined,
  );

  const inkRgb = parseHex(PALETTE.INK);
  const boneRgb = parseHex(PALETTE.BONE);
  const lineRgb = parseHex(PALETTE.INK_SOFT);
  const parchmentRgb = parseHex(PALETTE.PARCHMENT);
  const parchmentDarkRgb = parseHex(PALETTE.PARCHMENT_DARK);

  const sorted = [...actions].sort((a, b) => {
    if (a.half !== b.half) return a.half - b.half;
    if (a.turn !== b.turn) return a.turn - b.turn;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const rowMetas: RowMeta[] = sorted.map((a) => {
    const iconKind: IconKind = a.fumble
      ? a.actionType
      : (a.actionType === "blocage" || a.actionType === "blitz" || a.actionType === "aggression") &&
          a.armorBroken &&
          (a.opponentState || "").toLowerCase() === "elimine"
        ? "casualty"
        : a.actionType;
    return {
      team: a.playerTeam,
      iconKind,
      failed: a.fumble,
      resultColor: resultLabel(a).color,
    };
  });

  const body = sorted.map((a) => {
    const r = resultLabel(a);
    return [
      String(a.half),
      String(a.turn),
      a.playerTeam === "A" ? "A" : "B",
      "", // icone dessinee en didDrawCell
      eventDescription(a, teamAName, teamBName),
      r.text,
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN_MM, right: MARGIN_MM, top: 14, bottom: 14 },
    head: [["MT", "T", "EQ", "", "EVENEMENT", "RESULTAT"]],
    body,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: inkRgb,
      lineColor: lineRgb,
      lineWidth: 0.1,
      cellPadding: { top: 1.4, right: 1.6, bottom: 1.4, left: 1.6 },
      valign: "middle",
    },
    headStyles: {
      fillColor: inkRgb,
      textColor: boneRgb,
      fontStyle: "bold",
      halign: "center",
      fontSize: 8,
    },
    bodyStyles: {
      fillColor: parchmentRgb,
    },
    alternateRowStyles: {
      fillColor: parchmentDarkRgb,
    },
    tableWidth: CONTENT_WIDTH_MM,
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { halign: "center", cellWidth: 8 },
      2: { halign: "center", cellWidth: 9, fontStyle: "bold" },
      3: { halign: "center", cellWidth: 8 },
      4: { halign: "left" },
      5: { halign: "center", cellWidth: 32, fontStyle: "bold" },
    },
    didParseCell: (data: CellHookData) => {
      if (data.section !== "body") return;
      const meta = rowMetas[data.row.index];
      if (!meta) return;
      if (data.column.index === 2) {
        const tint = meta.team === "A" ? colorsA.tint : colorsB.tint;
        data.cell.styles.fillColor = parseHex(tint);
      }
      if (data.column.index === 5) {
        data.cell.styles.textColor = parseHex(meta.resultColor);
      }
    },
    didDrawCell: (data: CellHookData) => {
      if (data.section !== "body" || data.column.index !== 3) return;
      const meta = rowMetas[data.row.index];
      if (!meta) return;
      const size = 4.6;
      const px = data.cell.x + (data.cell.width - size) / 2;
      const py = data.cell.y + (data.cell.height - size) / 2;
      drawIcon(doc, meta.iconKind, px, py, PALETTE.INK, size, meta.failed);
    },
    didDrawPage: () => {
      // didDrawPage est appele APRES que la table de la page ait ete dessinee.
      // On ne peut donc pas redessiner le parchemin par-dessus sans masquer
      // les rangees. Sur les pages de continuation creees par autotable, on
      // ajoute juste le bandeau titre (qui occupe la zone reservee par
      // margin.top) et un footer leger (filet + texte) sans repeindre le fond.
      const current = doc.getCurrentPageInfo().pageNumber;
      if (current === firstTablePage) return;
      drawTitleBand(doc, 6);
      drawContinuationFooter(doc, match.name?.trim() || "Match Blood Bowl");
    },
  });

  // @ts-expect-error lastAutoTable is added by autotable plugin
  const finalY = (doc.lastAutoTable?.finalY ?? tableStartY + 80) as number;
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.2);
  return { bottomY: finalY };
}
