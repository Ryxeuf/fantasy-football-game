/**
 * Scoreboard hero: emblemes des deux equipes, score geant central,
 * chips de resultat et stats compactes (TD / CAS) sous chaque equipe.
 */

import type jsPDF from "jspdf";
import { getTeamColors, getTeamLogo } from "@bb/game-engine";
import {
  PALETTE,
  ensureContrast,
  resolveTeamColors,
  setDrawHex,
  setFillHex,
  setTextHex,
} from "../colors";
import { drawBadge, drawEmblem } from "../icons";
import { CONTENT_WIDTH_MM, MARGIN_MM } from "../chrome";
import type { MatchAggregates, PdfMatch } from "../types";

const HEIGHT = 70;

export interface ScoreboardResult {
  bottomY: number;
}

function teamLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + "…";
}

export function drawScoreboard(
  doc: jsPDF,
  match: PdfMatch,
  agg: MatchAggregates,
  startY: number,
): ScoreboardResult {
  const x = MARGIN_MM;
  const w = CONTENT_WIDTH_MM;

  // Conteneur principal
  setFillHex(doc, PALETTE.PARCHMENT_DARK);
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, startY, w, HEIGHT, 2, 2, "FD");
  setDrawHex(doc, PALETTE.INK_SOFT);
  doc.setLineWidth(0.3);
  doc.roundedRect(x + 1.5, startY + 1.5, w - 3, HEIGHT - 3, 1.5, 1.5, "D");

  const colorsA = resolveTeamColors(
    match.teamA.roster ? getTeamColors(match.teamA.roster).primary : undefined,
    match.teamA.roster ? getTeamColors(match.teamA.roster).secondary : undefined,
  );
  const colorsB = resolveTeamColors(
    match.teamB.roster ? getTeamColors(match.teamB.roster).primary : undefined,
    match.teamB.roster ? getTeamColors(match.teamB.roster).secondary : undefined,
  );

  // Stripes verticales aux extremites
  setFillHex(doc, colorsA.primary);
  doc.rect(x + 3, startY + 3, 5, HEIGHT - 6, "F");
  setFillHex(doc, colorsA.secondary);
  doc.rect(x + 8, startY + 3, 1.5, HEIGHT - 6, "F");

  setFillHex(doc, colorsB.primary);
  doc.rect(x + w - 8, startY + 3, 5, HEIGHT - 6, "F");
  setFillHex(doc, colorsB.secondary);
  doc.rect(x + w - 9.5, startY + 3, 1.5, HEIGHT - 6, "F");

  // Emblemes
  const logoA = match.teamA.roster ? getTeamLogo(match.teamA.roster) : { shape: "circle" as const, glyph: "A" };
  const logoB = match.teamB.roster ? getTeamLogo(match.teamB.roster) : { shape: "circle" as const, glyph: "B" };

  const emblemSize = 32;
  const emblemY = startY + 26;
  drawEmblem(
    doc,
    logoA.shape,
    colorsA.primary,
    ensureContrast(colorsA.secondary, colorsA.primary),
    logoA.glyph,
    x + 26,
    emblemY,
    emblemSize,
  );
  drawEmblem(
    doc,
    logoB.shape,
    colorsB.primary,
    ensureContrast(colorsB.secondary, colorsB.primary),
    logoB.glyph,
    x + w - 26,
    emblemY,
    emblemSize,
  );

  // Noms d'equipes au-dessus des emblemes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setTextHex(doc, PALETTE.INK);
  doc.text(teamLabel(match.teamA.name), x + 26, startY + 9, { align: "center" });
  doc.text(teamLabel(match.teamB.name), x + w - 26, startY + 9, { align: "center" });

  // Score geant centre
  const scoreA = match.scoreTeamA ?? 0;
  const scoreB = match.scoreTeamB ?? 0;
  const cx = x + w / 2;
  const cy = startY + 38;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(54);
  setTextHex(doc, PALETTE.INK);
  doc.text(String(scoreA), cx - 14, cy + 4, { align: "right" });
  doc.text(String(scoreB), cx + 14, cy + 4, { align: "left" });

  // Tiret central
  setDrawHex(doc, PALETTE.GOLD);
  doc.setLineWidth(2.2);
  doc.line(cx - 6, cy - 4, cx + 6, cy - 4);
  setDrawHex(doc, PALETTE.GOLD_DARK);
  doc.setLineWidth(0.6);
  doc.line(cx - 6, cy - 2.5, cx + 6, cy - 2.5);

  // Chip resultat: le badge designe TOUJOURS le vainqueur (vert), ou DRAW gris.
  const resultLabel =
    agg.outcome === "DRAW"
      ? "MATCH NUL"
      : `VICTOIRE — ${teamLabel(agg.outcome === "A" ? match.teamA.name : match.teamB.name, 24).toUpperCase()}`;
  const resultColor = agg.outcome === "DRAW" ? PALETTE.DRAW_GREY : PALETTE.WIN_GREEN;
  drawBadge(doc, cx - 45, startY + 50, 90, 9, resultLabel, resultColor, PALETTE.BONE, 8.5);

  // Mini stats sous chaque emblem
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setTextHex(doc, PALETTE.INK_SOFT);
  const statsLineA = `${agg.teamA.touchdowns} TD · ${agg.teamA.casualties} CAS`;
  const statsLineB = `${agg.teamB.touchdowns} TD · ${agg.teamB.casualties} CAS`;
  doc.text(statsLineA, x + 26, startY + 64, { align: "center" });
  doc.text(statsLineB, x + w - 26, startY + 64, { align: "center" });

  return { bottomY: startY + HEIGHT };
}
