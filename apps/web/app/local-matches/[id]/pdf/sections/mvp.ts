/**
 * Section "STAR OF THE MATCH": ruban diagonal + carte MVP avec medaillon
 * et grille de stats (TD / CAS / PASS / INT).
 */

import type jsPDF from "jspdf";
import { getTeamColors } from "@bb/game-engine";
import {
  PALETTE,
  ensureContrast,
  resolveTeamColors,
  setDrawHex,
  setFillHex,
  setTextHex,
} from "../colors";
import { drawClosedPath, drawIcon, drawRibbon } from "../icons";
import { CONTENT_WIDTH_MM, MARGIN_MM } from "../chrome";
import type { MatchAggregates, PdfMatch } from "../types";

const RIBBON_HEIGHT = 14;
const CARD_HEIGHT = 56;

function drawMedallion(doc: jsPDF, cx: number, cy: number, radius: number): void {
  setFillHex(doc, PALETTE.GOLD);
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.8);
  doc.circle(cx, cy, radius, "FD");
  setDrawHex(doc, PALETTE.INK);
  doc.setLineWidth(0.5);
  doc.circle(cx, cy, radius * 0.83, "D");

  // Etoile 5 branches
  const points: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius * 0.62 : radius * 0.27;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  setFillHex(doc, PALETTE.BLOOD);
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.4);
  drawClosedPath(doc, points, "FD");
}

export interface MvpResult {
  bottomY: number;
}

export function drawMvpSection(
  doc: jsPDF,
  match: PdfMatch,
  agg: MatchAggregates,
  startY: number,
): MvpResult {
  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;

  // Ruban
  drawRibbon(doc, x, startY, w, RIBBON_HEIGHT, "STAR OF THE MATCH");

  const cardY = startY + RIBBON_HEIGHT + 4;
  // Carte
  setFillHex(doc, PALETTE.PARCHMENT_DARK);
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, cardY, w, CARD_HEIGHT, 2, 2, "FD");
  setDrawHex(doc, PALETTE.INK_SOFT);
  doc.setLineWidth(0.3);
  doc.roundedRect(x + 1.5, cardY + 1.5, w - 3, CARD_HEIGHT - 3, 1.5, 1.5, "D");

  if (!agg.mvp) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    setTextHex(doc, PALETTE.INK_SOFT);
    doc.text("Aucun MVP designe pour ce match", x + w / 2, cardY + CARD_HEIGHT / 2, {
      align: "center",
    });
    return { bottomY: cardY + CARD_HEIGHT };
  }

  // Medaillon a gauche
  const mcx = x + 24;
  const mcy = cardY + CARD_HEIGHT / 2;
  drawMedallion(doc, mcx, mcy, 18);

  // Bloc texte au centre
  const textX = x + 50;
  const mvp = agg.mvp;
  const teamMeta = mvp.team === "A" ? match.teamA : match.teamB;
  const teamColors = resolveTeamColors(
    teamMeta.roster ? getTeamColors(teamMeta.roster).primary : undefined,
    teamMeta.roster ? getTeamColors(teamMeta.roster).secondary : undefined,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  setTextHex(doc, PALETTE.INK);
  const numberPart = mvp.number !== null ? `#${mvp.number}  ` : "";
  doc.text(`${numberPart}${mvp.playerName}`, textX, cardY + 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setTextHex(doc, ensureContrast(teamColors.primary, PALETTE.PARCHMENT_DARK));
  const teamLine = `${teamMeta.name}${mvp.position ? `  •  ${mvp.position}` : ""}`;
  doc.text(teamLine, textX, cardY + 21);

  // Badge SPP
  const badgeW = 32;
  const badgeH = 9;
  const badgeX = textX;
  const badgeY = cardY + 26;
  setFillHex(doc, PALETTE.INK);
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.5);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setTextHex(doc, PALETTE.GOLD);
  doc.setCharSpace(0.6);
  doc.text(`PERFORMANCE  ${mvp.spp} SPP`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.4, {
    align: "center",
  });
  doc.setCharSpace(0);

  // Grille de stats a droite
  const stats: Array<{ key: "td" | "casualty" | "passe" | "interception"; label: string; value: number }> = [
    { key: "td", label: "TD", value: mvp.touchdowns },
    { key: "casualty", label: "CAS", value: mvp.casualties },
    { key: "passe", label: "PASS", value: mvp.completions },
    { key: "interception", label: "INT", value: mvp.interceptions },
  ];

  const cellW = 22;
  const cellH = 24;
  const gridX = x + w - cellW * 4 - 6;
  const gridY = cardY + (CARD_HEIGHT - cellH) / 2;

  stats.forEach((s, i) => {
    const cx = gridX + i * cellW;
    setFillHex(doc, PALETTE.PARCHMENT);
    setDrawHex(doc, PALETTE.GOLD_DARK);
    doc.setLineWidth(0.3);
    doc.rect(cx, gridY, cellW - 1.2, cellH, "FD");
    drawIcon(doc, s.key === "casualty" ? "casualty" : s.key, cx + (cellW - 1.2) / 2 - 3, gridY + 2.5, PALETTE.INK, 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setTextHex(doc, PALETTE.INK);
    doc.text(String(s.value), cx + (cellW - 1.2) / 2, gridY + 16, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    setTextHex(doc, PALETTE.INK_SOFT);
    doc.setCharSpace(0.6);
    doc.text(s.label, cx + (cellW - 1.2) / 2, gridY + 21, { align: "center" });
    doc.setCharSpace(0);
  });

  return { bottomY: cardY + CARD_HEIGHT };
}
