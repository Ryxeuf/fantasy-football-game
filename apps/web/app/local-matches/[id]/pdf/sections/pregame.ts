/**
 * Encart "PRE-GAME CONDITIONS": meteo + fan factor sur deux colonnes.
 * Si rien n'est disponible, retourne immediatement le bottomY = startY.
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
import { drawWeatherIcon } from "../icons";
import { CONTENT_WIDTH_MM, MARGIN_MM } from "../chrome";
import type { PdfMatch } from "../types";

const HEIGHT = 36;

export interface PregameResult {
  bottomY: number;
  drawn: boolean;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

export function drawPregame(doc: jsPDF, match: PdfMatch, startY: number): PregameResult {
  const preMatch = match.gameState?.preMatch;
  if (!preMatch || (!preMatch.weather && !preMatch.fanFactor)) {
    return { bottomY: startY, drawn: false };
  }

  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;

  // Conteneur
  setFillHex(doc, PALETTE.PARCHMENT);
  setDrawHex(doc, PALETTE.INK_SOFT);
  doc.setLineWidth(0.4);
  doc.rect(x, startY, w, HEIGHT, "FD");

  // Bandeau titre
  setFillHex(doc, PALETTE.INK);
  doc.rect(x, startY, w, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  setTextHex(doc, PALETTE.BONE);
  doc.setCharSpace(1.6);
  doc.text("PRE-GAME CONDITIONS", x + w / 2, startY + 4.2, { align: "center" });
  doc.setCharSpace(0);

  const colY = startY + 11;
  const colHeight = HEIGHT - 11;
  const colWidth = w / 2;

  // Separateur central
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.3);
  doc.line(x + colWidth, startY + 9, x + colWidth, startY + HEIGHT - 3);

  // Colonne gauche : Weather
  const weather = preMatch.weather;
  if (weather) {
    drawWeatherIcon(doc, x + 12, colY + colHeight / 2 - 2, 10, weather.condition);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setTextHex(doc, PALETTE.INK);
    doc.text(weather.condition, x + 22, colY + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setTextHex(doc, PALETTE.INK_SOFT);
    const desc = truncate(weather.description, 80);
    const lines = doc.splitTextToSize(desc, colWidth - 28);
    doc.text(lines.slice(0, 2), x + 22, colY + 10);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setCharSpace(0.6);
    setTextHex(doc, PALETTE.GOLD_DARK);
    doc.text(`2D6 = ${weather.total}`, x + 22, colY + colHeight - 4);
    doc.setCharSpace(0);
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    setTextHex(doc, PALETTE.INK_SOFT);
    doc.text("Meteo non enregistree", x + 6, colY + colHeight / 2);
  }

  // Colonne droite : Fan Factor
  const fanFactor = preMatch.fanFactor;
  if (fanFactor) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    setTextHex(doc, PALETTE.INK);
    doc.setCharSpace(1.4);
    doc.text("FAN FACTOR", x + colWidth + 4, colY + 3);
    doc.setCharSpace(0);

    // Plancher minimal pour eviter une barre quasi-invisible quand les deux
    // equipes ont un fan factor faible.
    const FAN_FACTOR_BAR_MIN = 6;
    const max = Math.max(fanFactor.teamA.total, fanFactor.teamB.total, FAN_FACTOR_BAR_MIN);
    const barX = x + colWidth + 4;
    const barW = colWidth - 18;

    const colorsA = resolveTeamColors(
      match.teamA.roster ? getTeamColors(match.teamA.roster).primary : undefined,
      match.teamA.roster ? getTeamColors(match.teamA.roster).secondary : undefined,
    );
    const colorsB = resolveTeamColors(
      match.teamB.roster ? getTeamColors(match.teamB.roster).primary : undefined,
      match.teamB.roster ? getTeamColors(match.teamB.roster).secondary : undefined,
    );

    // Bar A
    const yA = colY + 8;
    setFillHex(doc, PALETTE.PARCHMENT_DARK);
    doc.rect(barX, yA, barW, 4, "F");
    setFillHex(doc, colorsA.primary);
    doc.rect(barX, yA, (barW * fanFactor.teamA.total) / max, 4, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setTextHex(doc, PALETTE.INK);
    doc.text(
      `${truncate(match.teamA.name, 18)}  •  ${fanFactor.teamA.total}  (D3 ${fanFactor.teamA.d3} + Fans ${fanFactor.teamA.dedicatedFans})`,
      barX,
      yA - 1,
    );

    // Bar B
    const yB = colY + 18;
    setFillHex(doc, PALETTE.PARCHMENT_DARK);
    doc.rect(barX, yB, barW, 4, "F");
    setFillHex(doc, colorsB.primary);
    doc.rect(barX, yB, (barW * fanFactor.teamB.total) / max, 4, "F");
    doc.text(
      `${truncate(match.teamB.name, 18)}  •  ${fanFactor.teamB.total}  (D3 ${fanFactor.teamB.d3} + Fans ${fanFactor.teamB.dedicatedFans})`,
      barX,
      yB - 1,
    );
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    setTextHex(doc, PALETTE.INK_SOFT);
    doc.text("Fan factor non enregistre", x + colWidth + 6, colY + colHeight / 2);
  }

  return { bottomY: startY + HEIGHT, drawn: true };
}
