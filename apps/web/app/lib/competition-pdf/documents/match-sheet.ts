/**
 * Feuille de rencontre imprimable (A4 paysage) : tout ce que la feuille de
 * match du site permet de saisir, à remplir au stylo autour de la table.
 *
 *   1. Rencontre & avant-match — score, identité et staff des équipes,
 *      popularité, coups de pouce, prières, météo, toss, forfait.
 *   2-3. Une page par équipe — profil de chaque joueur et une case par
 *      évènement de jeu (cf. `match-sheet-roster`).
 *   4. Journal des évènements — une ligne par action, avec les légendes
 *      (types, blessures, table de coup d'envoi).
 *   5. Fin de match — la séquence du livre (p.68) : résultat et gains, fans
 *      dévoués, améliorations, embauches puis renvois, erreurs coûteuses ;
 *      signatures. Une coupe n'écrit ni or ni évolution : la page se réduit
 *      au résultat.
 *
 * Tout ce qui est déjà saisi sur le site (feuille entamée ou validée) est
 * pré-rempli ; le reste reste vierge.
 */

import type jsPDF from "jspdf";
import type { MatchSheetDocument, PdfSheetInducement, PdfSheetTeam } from "../types";
import {
  addPage,
  contentWidth,
  createPage,
  drawBox,
  drawCheckbox,
  drawDocumentHeader,
  drawField,
  drawSectionTitle,
  finalizePages,
  teamDetail,
  type PdfPage,
} from "../layout";
import { fitText } from "../tables";
import { PDF_COLORS, formatGoldPdf, pdfSafe, setDraw, setFill, setText } from "../theme";
import { drawWriteGrid } from "../write-grid";
import { drawRosterPage } from "./match-sheet-roster";
import { sheetEntryOf } from "./match-sheet-entry";

const COL_GAP = 6;
/** Bas du contenu de la page d'avant-match (A4 paysage, pied de page réservé). */
const PRE_MATCH_BOTTOM = 190;

/** Codes du journal — même vocabulaire que le sélecteur du site. */
export const EVENT_CODES: Array<{ code: string; label: string }> = [
  { code: "CE", label: "Coup d'envoi (résultat 2D6)" },
  { code: "TD", label: "Touchdown" },
  { code: "SOR", label: "Élimination sur blocage" },
  { code: "PAS", label: "Passe réussie (+ réceptionneur)" },
  { code: "INT", label: "Interception" },
  { code: "AGR", label: "Agression" },
  { code: "EXP", label: "Expulsion" },
  { code: "SP", label: "Sortie (public)" },
  { code: "TEM", label: "Temporisation" },
  { code: "LAN", label: "Lancer de coéquipier" },
  { code: "ATT", label: "Atterrissage réussi" },
  { code: "ASP", label: "Élimination sur action spéciale" },
  { code: "AEL", label: "Autre élimination" },
];

const INJURY_CODES: Array<{ code: string; label: string }> = [
  { code: "C", label: "Commotion" },
  { code: "A", label: "Amoché (rate le prochain match)" },
  { code: "BP", label: "Blessure persistante" },
  { code: "S", label: "Séquelle (préciser M, F, AG, CP ou AR)" },
  { code: "M", label: "Mort" },
];

function sideTeam(doc: MatchSheetDocument, side: "home" | "away"): PdfSheetTeam {
  return side === "home" ? doc.home : doc.away;
}

// ─── Page 1 : rencontre & avant-match ────────────────────────────────────────

function drawScoreboard(page: PdfPage, y: number, data: MatchSheetDocument): number {
  const { doc } = page;
  const w = contentWidth(page);
  const cx = page.margin + w / 2;
  const blockW = (w - 60) / 2;
  const score = data.prefill?.score ?? null;

  const drawTeam = (team: PdfSheetTeam, align: "left" | "right") => {
    const x = align === "left" ? page.margin : page.margin + w;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, PDF_COLORS.ACCENT_DARK);
    doc.text(align === "left" ? "DOMICILE" : "EXTÉRIEUR", x, y + 3, { align });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    setText(doc, PDF_COLORS.INK);
    doc.text(fitText(doc, pdfSafe(team.team.name), blockW), x, y + 10, { align });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(fitText(doc, teamDetail(team.team), blockW), x, y + 15, { align });
  };
  drawTeam(data.home, "left");
  drawTeam(data.away, "right");

  drawBox(doc, cx - 24, y + 1, 18, 16, score?.home ?? null, 20);
  drawBox(doc, cx + 6, y + 1, 18, 16, score?.away ?? null, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  setText(doc, PDF_COLORS.INK_SOFT);
  doc.text("-", cx, y + 11, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("SCORE FINAL", cx, y + 20.5, { align: "center" });
  return y + 25;
}

/** Bandeau d'identité figée : VE, VEA, trésorerie, fans, staff. */
function drawIdentityStrip(page: PdfPage, x: number, y: number, w: number, team: PdfSheetTeam): number {
  const { doc } = page;
  const items: Array<[string, string]> = [
    ["VE", formatGoldPdf(team.teamValue) || "____"],
    ["VEA", formatGoldPdf(team.currentValue) || "____"],
    ["Trésorerie", formatGoldPdf(team.treasury) || "____"],
    ["Fans dévoués", team.dedicatedFans != null ? String(team.dedicatedFans) : "__"],
    ["Relances", team.staff ? String(team.staff.rerolls) : "__"],
    ["Apothicaire", team.staff ? (team.staff.apothecary ? "Oui" : "Non") : "__"],
    ["Assistants", team.staff ? String(team.staff.assistants) : "__"],
    ["Pom-pom girls", team.staff ? String(team.staff.cheerleaders) : "__"],
  ];
  // Deux rangées de quatre : huit valeurs sur une seule ligne ne tiennent
  // pas dans une demi-page (« 1 150 k po » déborde).
  const perRow = 4;
  const rowH = 8.5;
  setFill(doc, PDF_COLORS.ACCENT_TINT);
  doc.rect(x, y, w, rowH * 2 + 1, "F");
  const cw = w / perRow;
  items.forEach(([label, value], i) => {
    const ix = x + (i % perRow) * cw + cw / 2;
    const iy = y + Math.floor(i / perRow) * rowH;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(label, ix, iy + 3.4, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setText(doc, PDF_COLORS.INK);
    doc.text(pdfSafe(value), ix, iy + 7.4, { align: "center" });
  });
  return y + rowH * 2 + 4;
}

function inducementRows(list: PdfSheetInducement[] | undefined): string[][] {
  return (list ?? []).map((i) => [pdfSafe(i.name), String(i.qty), formatGoldPdf(i.cost * i.qty)]);
}

function drawTeamPreMatch(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  data: MatchSheetDocument,
  side: "home" | "away",
): number {
  const { doc } = page;
  const team = sideTeam(data, side);
  y = drawSectionTitle(page, y, side === "home" ? "Avant-match - Domicile" : "Avant-match - Extérieur", { x, width: w });
  y = drawIdentityStrip(page, x, y - 1.5, w, team);
  if (sheetEntryOf(data).preMatch === "full") {
    y = drawTeamPreMatchEntries(page, x, y, w, data, side);
  }

  // Le reste de la colonne : notes libres (relances, rappels de règles…).
  const notesH = PRE_MATCH_BOTTOM - y;
  if (notesH > 12) {
    setDraw(doc, PDF_COLORS.RULE);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, notesH, 1.2, 1.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text("Notes d'avant-match", x + 2, y + 3.6);
    y += notesH;
  }
  return y;
}

/** Popularité, coups de pouce, prières, journaliers, absents (saisie complète). */
function drawTeamPreMatchEntries(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  data: MatchSheetDocument,
  side: "home" | "away",
): number {
  const { doc } = page;
  const p = data.prefill;
  const pop = side === "home" ? p?.popularityHome : p?.popularityAway;
  drawField(doc, x, y + 2, w * 0.55, "Popularité (D3 + fans dévoués)", pop ?? null);
  drawField(doc, x + w * 0.6, y + 2, w * 0.4, "Budget / caisse", null);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, PDF_COLORS.INK);
  doc.text("Coups de pouce (Star Players, pots-de-vin, mercenaires...)", x, y);
  y = drawWriteGrid(doc, {
    x,
    y: y + 1.5,
    width: w,
    columns: [
      { label: "Coup de pouce", weight: 6, align: "left" },
      { label: "Qté", weight: 1 },
      { label: "Coût", weight: 2 },
    ],
    rows: inducementRows(side === "home" ? p?.inducementsHome : p?.inducementsAway),
    minRows: 6,
    rowHeight: 6,
  });
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, PDF_COLORS.INK);
  doc.text("Prières à Nuffle (D16)", x, y);
  const prayers = (side === "home" ? p?.prayersHome : p?.prayersAway) ?? [];
  for (let i = 0; i < 3; i++) {
    drawBox(doc, x + 34 + i * 12, y - 3.8, 8, 5.5, prayers[i] ?? null, 8);
  }
  y += 6;
  drawField(doc, x, y, w, "Journaliers engagés (nombre, poste)", null);
  y += 6;
  drawField(doc, x, y, w, "Joueurs absents (blessés, suspendus)", null);
  return y + 5;
}

function drawCommonPreMatch(page: PdfPage, x: number, y: number, w: number, data: MatchSheetDocument): number {
  const { doc } = page;
  const p = data.prefill;
  y = drawSectionTitle(page, y, "Avant-match - Commun", { x, width: w });
  const forfeitOnly = sheetEntryOf(data).preMatch === "forfeit-only";
  const opt = (ox: number, oy: number, label: string, checked: boolean) => {
    drawCheckbox(doc, ox, oy - 2.6, 3, checked);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    setText(doc, PDF_COLORS.INK);
    doc.text(label, ox + 4, oy);
  };

  if (forfeitOnly) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(doc, PDF_COLORS.INK);
    doc.text("Forfait", x, y);
    opt(x + 24, y, "Domicile", p?.forfeitSide === "home");
    opt(x + 46, y, "Extérieur", p?.forfeitSide === "away");
    return y + 6;
  }

  // Toss.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, PDF_COLORS.INK);
  doc.text("Toss gagné par", x, y);
  opt(x + 24, y, "Domicile", p?.tossWinner === "home");
  opt(x + 46, y, "Extérieur", p?.tossWinner === "away");
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Il choisit de", x, y);
  opt(x + 24, y, "Engager", p?.tossChoice === "kick");
  opt(x + 46, y, "Recevoir", p?.tossChoice === "receive");
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.text("Forfait", x, y);
  opt(x + 24, y, "Domicile", p?.forfeitSide === "home");
  opt(x + 46, y, "Extérieur", p?.forfeitSide === "away");
  y += 6;

  // Météo.
  const table = data.weatherTable;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`Météo (2D6)${table ? ` - ${pdfSafe(table.name)}` : ""}`, x, y);
  y += 1.5;
  if (table && table.results.length > 0) {
    for (const r of table.results) {
      const checked = !!p?.weather && p.weather === r.condition;
      drawCheckbox(doc, x, y + 0.6, 2.8, checked);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      setText(doc, PDF_COLORS.INK);
      doc.text(pdfSafe(r.roll), x + 4, y + 2.9);
      doc.setFont("helvetica", "normal");
      doc.text(fitText(doc, pdfSafe(r.condition), w - 14), x + 12, y + 2.9);
      y += 4;
    }
  } else {
    drawField(doc, x, y + 3.5, w, "Résultat", p?.weather ?? null);
    y += 5;
  }
  y += 3;

  // Prières (légende D16).
  if (data.prayersTable && data.prayersTable.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(doc, PDF_COLORS.INK);
    doc.text("Table des Prières à Nuffle (D16)", x, y);
    y += 1;
    doc.setFontSize(6.4);
    const half = Math.ceil(data.prayersTable.length / 2);
    const colW = w / 2;
    data.prayersTable.forEach((pr, i) => {
      const col = i < half ? 0 : 1;
      const row = i < half ? i : i - half;
      const px = x + col * colW;
      const py = y + 3 + row * 3.3;
      doc.setFont("helvetica", "bold");
      setText(doc, PDF_COLORS.INK);
      doc.text(pdfSafe(pr.roll), px, py);
      doc.setFont("helvetica", "normal");
      setText(doc, PDF_COLORS.INK_SOFT);
      doc.text(fitText(doc, pdfSafe(pr.name), colW - 6), px + 4.5, py);
    });
    y += 3 + half * 3.3;
  }
  return y;
}

function drawPreMatchPage(page: PdfPage, y: number, data: MatchSheetDocument): void {
  y = drawScoreboard(page, y, data);
  const w = contentWidth(page);
  const centerW = 68;
  const teamW = (w - centerW - COL_GAP * 2) / 2;
  const top = y + 2;
  drawTeamPreMatch(page, page.margin, top, teamW, data, "home");
  drawCommonPreMatch(page, page.margin + teamW + COL_GAP, top, centerW, data);
  drawTeamPreMatch(page, page.margin + teamW + COL_GAP * 2 + centerW, top, teamW, data, "away");
}

// ─── Page 4 : journal des évènements ─────────────────────────────────────────

const LOG_ROWS = 24;

function drawLegendBlock(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  title: string,
  items: Array<{ code: string; label: string }>,
  codeW = 9,
): number {
  const { doc } = page;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, PDF_COLORS.ACCENT_DARK);
  doc.text(pdfSafe(title).toUpperCase(), x, y);
  setDraw(doc, PDF_COLORS.ACCENT);
  doc.setLineWidth(0.25);
  doc.line(x, y + 1, x + w, y + 1);
  y += 4.2;
  doc.setFontSize(6.8);
  for (const it of items) {
    doc.setFont("helvetica", "bold");
    setText(doc, PDF_COLORS.INK);
    doc.text(pdfSafe(it.code), x, y);
    doc.setFont("helvetica", "normal");
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(fitText(doc, pdfSafe(it.label), w - codeW), x + codeW, y);
    y += 3.3;
  }
  return y + 2.5;
}

function drawEventLogPage(page: PdfPage, y: number, data: MatchSheetDocument): void {
  const { doc } = page;
  const w = contentWidth(page);
  const legendW = 68;
  const gridW = w - legendW - COL_GAP;
  y = drawSectionTitle(page, y, "Journal des évènements", {
    width: gridW,
    right: "Une ligne par action - joueurs désignés par leur numéro",
  });
  const events = data.prefill?.events ?? [];
  const entry = sheetEntryOf(data);
  const sideCode = (s: "home" | "away" | null) => (s === "home" ? "D" : s === "away" ? "E" : "");
  // Colonnes retirées une à une selon le profil : la grille reste la même.
  type LogEvent = (typeof events)[number];
  const columns: Array<{
    label: string;
    weight: number;
    align?: "left";
    cell: (e: LogEvent) => string;
  }> = [
    ...(entry.halfAndTurn
      ? [
          { label: "MT", weight: 1, cell: (e: LogEvent) => (e.half ? String(e.half) : "") },
          { label: "Tour", weight: 1.2, cell: (e: LogEvent) => (e.turn ? String(e.turn) : "") },
        ]
      : []),
    { label: "Éq. (D/E)", weight: 1.6, cell: (e) => sideCode(e.side) },
    { label: "Évènement", weight: 2, cell: (e) => e.kind },
    { label: "Acteur n°", weight: 1.8, cell: (e) => e.actor ?? "" },
    {
      label: entry.passReceiver ? "Cible / réceptionneur n°" : "Cible n°",
      weight: 3.4,
      cell: (e) => e.target ?? "",
    },
    ...(entry.injuryDetails
      ? [{ label: "Blessure", weight: 1.8, cell: (e: LogEvent) => e.injury ?? "" }]
      : []),
    ...(entry.kickoffDetails || entry.injuryDetails
      ? [
          {
            label: "Détail (coup d'envoi, carac. perdue...)",
            weight: 7,
            align: "left" as const,
            cell: (e: LogEvent) => e.detail ?? "",
          },
        ]
      : []),
  ];
  drawWriteGrid(doc, {
    x: page.margin,
    y,
    width: gridW,
    columns: columns.map(({ label, weight, align }) => ({ label, weight, align })),
    rows: events.map((e) => columns.map((c) => c.cell(e))),
    minRows: Math.max(LOG_ROWS, events.length + 4),
    rowHeight: 6.2,
    headHeight: 5.5,
  });

  const lx = page.margin + gridW + COL_GAP;
  let ly = y - 4;
  ly = drawLegendBlock(page, lx, ly, legendW, "Évènements", entry.eventLegend ?? EVENT_CODES);
  if (entry.injuryDetails) {
    ly = drawLegendBlock(page, lx, ly, legendW, "Blessures", INJURY_CODES, 6);
  }
  if (entry.kickoffDetails) {
    drawLegendBlock(
      page,
      lx,
      ly,
      legendW,
      "Coup d'envoi (2D6)",
      data.kickoffTable.map((k) => ({ code: k.roll, label: k.name })),
      6,
    );
  }
}

// ─── Page 5 : fin de match ───────────────────────────────────────────────────

function drawResultBlock(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  data: MatchSheetDocument,
  side: "home" | "away",
): number {
  const { doc } = page;
  const team = sideTeam(data, side);
  y = drawSectionTitle(page, y, `${side === "home" ? "Domicile" : "Extérieur"} - ${team.team.name}`, { x, width: w });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setText(doc, PDF_COLORS.INK);
  doc.text("Résultat", x, y);
  const score = data.prefill?.score;
  const mine = score ? (side === "home" ? score.home : score.away) : null;
  const theirs = score ? (side === "home" ? score.away : score.home) : null;
  const res = mine === null || theirs === null ? null : mine > theirs ? "V" : mine < theirs ? "D" : "N";
  (["V", "N", "D"] as const).forEach((r, i) => {
    drawCheckbox(doc, x + 16 + i * 15, y - 2.6, 3, res === r);
    doc.setFont("helvetica", "normal");
    doc.text(r === "V" ? "Vict." : r === "N" ? "Nul" : "Déf.", x + 20 + i * 15, y);
  });
  const motm = data.prefill?.motm?.[side] ?? [];
  drawField(doc, x + 64, y, w - 64, "Joueur du Match (n°)", motm.join(", ") || null);
  y += 6;
  if (data.rules.economy) {
    drawField(doc, x, y, w * 0.48, "Gains (po)", null);
    drawField(doc, x + w * 0.52, y, w * 0.48, "Bonus de classement", null);
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(doc, PDF_COLORS.INK);
    doc.text("Fans dévoués", x, y);
    ["+1", "0", "-1"].forEach((l, i) => {
      drawCheckbox(doc, x + 22 + i * 13, y - 2.6, 3);
      doc.setFont("helvetica", "normal");
      doc.text(l, x + 26 + i * 13, y);
    });
    drawField(doc, x + 64, y, w - 64, "PSP bonus (n° : PSP)", null);
    y += 4;
  }
  return y;
}

function drawSequenceGrids(page: PdfPage, y: number, data: MatchSheetDocument): number {
  const { doc } = page;
  const w = contentWidth(page);
  const colW = (w - COL_GAP) / 2;
  const both = (fn: (x: number) => number): number => {
    const a = fn(page.margin);
    const b = fn(page.margin + colW + COL_GAP);
    return Math.max(a, b);
  };

  if (data.rules.advancements) {
    y = drawSectionTitle(page, y, "Étape 3 - Amélioration des joueurs");
    y = both((x) =>
      drawWriteGrid(doc, {
        x,
        y: y - 2,
        width: colW,
        columns: [
          { label: "N°", weight: 1 },
          { label: "Joueur", weight: 4, align: "left" },
          { label: "Aléat. / Choisie / Carac.", weight: 4 },
          { label: "Compétence ou carac. obtenue", weight: 6, align: "left" },
          { label: "PSP", weight: 1.3 },
        ],
        minRows: 4,
        rowHeight: 5.8,
      }),
    );
    y += 6;
  }
  if (data.rules.purchases || data.rules.firings) {
    y = drawSectionTitle(page, y, "Étape 4 - Embauches puis renvois");
    y = both((x) => {
      let gy = y - 2;
      if (data.rules.purchases) {
        gy = drawWriteGrid(doc, {
          x,
          y: gy,
          width: colW,
          columns: [
            { label: "Embauche (joueur, relance, staff, journalier)", weight: 8, align: "left" },
            { label: "Nom / poste", weight: 5, align: "left" },
            { label: "Coût", weight: 2.3 },
          ],
          minRows: 3,
          rowHeight: 5.8,
        });
        gy += 1.5;
      }
      if (data.rules.firings) {
        gy = drawWriteGrid(doc, {
          x,
          y: gy,
          width: colW,
          columns: [
            { label: "Renvoi : n° et nom du joueur licencié", weight: 1, align: "left" },
          ],
          minRows: 2,
          rowHeight: 5.8,
        });
      }
      return gy;
    });
    y += 6;
  }
  if (data.rules.economy) {
    y = drawSectionTitle(page, y, "Étape 5 - Erreurs coûteuses et trésorerie");
    both((x) => {
      drawField(doc, x, y, colW * 0.3, "Trésorerie", null);
      drawField(doc, x + colW * 0.34, y, colW * 0.2, "Jet D6", null);
      drawField(doc, x + colW * 0.58, y, colW * 0.42, "Trésorerie finale", null);
      return y;
    });
    y += 7;
  }
  return y;
}

function drawSignatures(page: PdfPage, y: number): void {
  const { doc } = page;
  const w = contentWidth(page);
  const cw = (w - COL_GAP * 2) / 3;
  ["Coach domicile", "Coach extérieur", "Commissaire"].forEach((label, i) => {
    const x = page.margin + i * (cw + COL_GAP);
    setDraw(doc, PDF_COLORS.RULE);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, y, cw, 16, 1.2, 1.2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    setText(doc, PDF_COLORS.INK_SOFT);
    doc.text(`Signature - ${label}`, x + 2.5, y + 4);
  });
}

function drawPostMatchPage(page: PdfPage, y: number, data: MatchSheetDocument): void {
  const w = contentWidth(page);
  const colW = (w - COL_GAP) / 2;
  const ha = drawResultBlock(page, page.margin, y, colW, data, "home");
  const hb = drawResultBlock(page, page.margin + colW + COL_GAP, y, colW, data, "away");
  y = Math.max(ha, hb) + 6;
  y = drawSequenceGrids(page, y, data);
  if (!data.rules.economy) {
    // Coupe : place libre pour les notes du commissaire.
    const { doc } = page;
    y = drawSectionTitle(page, y, "Notes");
    setDraw(doc, PDF_COLORS.RULE);
    doc.setLineWidth(0.25);
    const sigY = page.height - 36;
    doc.roundedRect(page.margin, y - 2, w, Math.max(30, sigY - y - 4), 1.2, 1.2);
    y = sigY;
  }
  drawSignatures(page, Math.max(y, page.height - 36));
}

// ─── Assemblage ──────────────────────────────────────────────────────────────

export function renderMatchSheet(doc: jsPDF, data: MatchSheetDocument): void {
  const page = createPage(doc, data.meta, "Feuille de rencontre");
  const subtitle = [data.roundLabel, data.scheduledLabel].filter(Boolean).join(" - ");
  let y = drawDocumentHeader(page, subtitle);
  drawPreMatchPage(page, y - 2, data);

  y = addPage(page);
  drawRosterPage(page, y + 2, data, "home");
  y = addPage(page);
  drawRosterPage(page, y + 2, data, "away");

  y = addPage(page);
  drawEventLogPage(page, y + 2, data);

  y = addPage(page);
  drawSectionTitleBanner(page, y + 2, data);
  drawPostMatchPage(page, y + 10, data);
  finalizePages(page);
}

function drawSectionTitleBanner(page: PdfPage, y: number, data: MatchSheetDocument): void {
  const { doc } = page;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, PDF_COLORS.INK);
  doc.text("FIN DE MATCH", page.margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  setText(doc, PDF_COLORS.INK_SOFT);
  doc.text(
    data.rules.economy
      ? "Dans l'ordre du livre : résultat et gains, fans dévoués, améliorations, embauches puis renvois, erreurs coûteuses."
      : "Coupe : aucun PSP, blessure, or ni évolution n'est conservé d'une ronde à l'autre.",
    page.margin + 32,
    y,
  );
}
