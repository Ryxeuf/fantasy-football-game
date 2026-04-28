/**
 * Drive chart par mi-temps: une bande horizontale par tour avec les pictogrammes
 * d'actions, code-couleur sur la team active et indicateur d'echec.
 */

import type jsPDF from "jspdf";
import { getTeamColors } from "@bb/game-engine";
import {
  PALETTE,
  resolveTeamColors,
  setDrawHex,
  setFillHex,
  setTextHex,
} from "../colors";
import { drawIcon, type IconKind } from "../icons";
import { CONTENT_WIDTH_MM, MARGIN_MM, PAGE_HEIGHT_MM } from "../chrome";
import type { PdfAction, PdfMatch } from "../types";

const TURN_HEIGHT = 9;
const ICON_SIZE = 5.4;
const ICON_GAP = 1.4;

interface ActionsByHalfTurn {
  half: number;
  turn: number;
  actions: PdfAction[];
}

function groupActions(actions: ReadonlyArray<PdfAction>): ActionsByHalfTurn[] {
  const map = new Map<string, ActionsByHalfTurn>();
  for (const a of actions) {
    const key = `${a.half}-${a.turn}`;
    const cur = map.get(key);
    if (cur) cur.actions.push(a);
    else map.set(key, { half: a.half, turn: a.turn, actions: [a] });
  }
  return Array.from(map.values()).sort((x, y) =>
    x.half !== y.half ? x.half - y.half : x.turn - y.turn,
  );
}

function actionToIcon(a: PdfAction): { kind: IconKind; failed: boolean } {
  if (a.fumble) return { kind: a.actionType, failed: true };
  if (
    (a.actionType === "blocage" ||
      a.actionType === "blitz" ||
      a.actionType === "aggression") &&
    a.armorBroken &&
    (a.opponentState || "").toLowerCase() === "elimine"
  ) {
    return { kind: "casualty", failed: false };
  }
  return { kind: a.actionType, failed: false };
}

function drawHalfBand(doc: jsPDF, y: number, label: string): number {
  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;
  const h = 7;
  setFillHex(doc, PALETTE.INK);
  doc.rect(x, y, w, h, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setTextHex(doc, PALETTE.GOLD);
  doc.setCharSpace(2);
  doc.text(label, x + w / 2, y + h / 2 + 1.4, { align: "center" });
  doc.setCharSpace(0);
  return y + h;
}

function ensureSpace(
  doc: jsPDF,
  needed: number,
  currentY: number,
  decorate: () => void,
): number {
  if (currentY + needed > PAGE_HEIGHT_MM - 18) {
    doc.addPage();
    decorate();
    return 18;
  }
  return currentY;
}

export interface DriveChartResult {
  bottomY: number;
}

export function drawDriveChart(
  doc: jsPDF,
  match: PdfMatch,
  actions: ReadonlyArray<PdfAction>,
  startY: number,
  decoratePage: () => void,
): DriveChartResult {
  const grouped = groupActions(actions);
  if (grouped.length === 0) {
    return { bottomY: startY };
  }

  const colorsA = resolveTeamColors(
    match.teamA.roster ? getTeamColors(match.teamA.roster).primary : undefined,
    match.teamA.roster ? getTeamColors(match.teamA.roster).secondary : undefined,
  );
  const colorsB = resolveTeamColors(
    match.teamB.roster ? getTeamColors(match.teamB.roster).primary : undefined,
    match.teamB.roster ? getTeamColors(match.teamB.roster).secondary : undefined,
  );

  let y = startY;
  let lastHalf = -1;

  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;

  for (const group of grouped) {
    if (group.half !== lastHalf) {
      y = ensureSpace(doc, 28, y, decoratePage);
      const label = group.half === 1 ? "PREMIERE MI-TEMPS" : `MI-TEMPS ${group.half}`;
      y = drawHalfBand(doc, y + 2, label) + 2;
      lastHalf = group.half;
    }

    y = ensureSpace(doc, TURN_HEIGHT + 2, y, decoratePage);

    // Determiner la team dominante du tour
    const aCount = group.actions.filter((a) => a.playerTeam === "A").length;
    const bCount = group.actions.length - aCount;
    const dominant = aCount >= bCount ? colorsA : colorsB;

    // Stripe team
    setFillHex(doc, dominant.tint);
    doc.rect(x, y, w, TURN_HEIGHT, "F");
    setFillHex(doc, dominant.primary);
    doc.rect(x, y, 2, TURN_HEIGHT, "F");

    // Badge tour
    setFillHex(doc, PALETTE.INK);
    doc.rect(x + 3, y + 1, 14, TURN_HEIGHT - 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setTextHex(doc, PALETTE.BONE);
    doc.text(`T${group.turn}`, x + 10, y + TURN_HEIGHT / 2 + 1.4, { align: "center" });

    // Icones
    const iconsStart = x + 19;
    const iconsMaxWidth = w - 36;
    const maxIconsPerRow = Math.floor(iconsMaxWidth / (ICON_SIZE + ICON_GAP));
    const total = group.actions.length;
    const visible = Math.min(total, maxIconsPerRow);
    for (let i = 0; i < visible; i++) {
      const a = group.actions[i];
      const tint = a.playerTeam === "A" ? colorsA.primary : colorsB.primary;
      const ix = iconsStart + i * (ICON_SIZE + ICON_GAP);
      const iy = y + (TURN_HEIGHT - ICON_SIZE) / 2;
      // mini fond colore d'equipe pour rappel visuel
      setFillHex(doc, a.playerTeam === "A" ? colorsA.tint : colorsB.tint);
      setDrawHex(doc, tint);
      doc.setLineWidth(0.2);
      doc.rect(ix - 0.4, iy - 0.4, ICON_SIZE + 0.8, ICON_SIZE + 0.8, "FD");
      const icon = actionToIcon(a);
      drawIcon(doc, icon.kind, ix, iy, PALETTE.INK, ICON_SIZE, icon.failed);
    }
    if (total > visible) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      setTextHex(doc, PALETTE.INK_SOFT);
      doc.text(
        `+${total - visible}`,
        iconsStart + visible * (ICON_SIZE + ICON_GAP) + 1,
        y + TURN_HEIGHT / 2 + 1.5,
      );
    }

    // Repartition droite
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setTextHex(doc, PALETTE.INK);
    doc.text(`${aCount} / ${bCount}`, x + w - 4, y + TURN_HEIGHT / 2 + 1.5, {
      align: "right",
    });

    y += TURN_HEIGHT + 1;
  }

  return { bottomY: y };
}

