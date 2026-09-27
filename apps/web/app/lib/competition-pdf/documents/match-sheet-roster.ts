/**
 * Feuille de rencontre — page d'équipe : chaque joueur avec son profil
 * (poste, caractéristiques, compétences, PSP) et une case par évènement de
 * jeu à cocher au fil du match (TD, passes, sorties, blessure…).
 */

import type { MatchSheetDocument, PdfSheetPlayer, PdfSheetTeam } from "../types";
import { contentWidth, drawSectionTitle, type PdfPage } from "../layout";
import { BODY_STYLES, HEAD_STYLES, drawTable, lastTableBottom } from "../tables";
import { PDF_COLORS, formatGoldPdf, hexToRgb, pdfSafe, setText } from "../theme";

/** Lignes vides en bas de liste : journalier, Star Player, relevé… */
export const EXTRA_ROSTER_ROWS = 3;

interface TallyColumn {
  key: keyof NonNullable<PdfSheetPlayer["tally"]>;
  label: string;
  legend: string;
  width: number;
}

const TALLY_COLUMNS: TallyColumn[] = [
  { key: "td", label: "TD", legend: "Touchdown", width: 8 },
  { key: "pass", label: "Pas", legend: "Passe réussie", width: 8 },
  { key: "rec", label: "Réc", legend: "Réception (passe)", width: 8 },
  { key: "int", label: "Int", legend: "Interception", width: 8 },
  { key: "cas", label: "Sor", legend: "Élimination sur blocage", width: 8 },
  { key: "agg", label: "Agr", legend: "Agression", width: 8 },
  { key: "ttm", label: "Lan", legend: "Lancer de coéquipier", width: 8 },
  { key: "land", label: "Att", legend: "Atterrissage réussi", width: 8 },
  { key: "exp", label: "Exp", legend: "Expulsé", width: 7.5 },
  { key: "motm", label: "JDM", legend: "Joueur du Match", width: 8 },
  { key: "injury", label: "Blessure", legend: "C / A / BP / S(carac.) / M", width: 15 },
];

function tallyValue(p: PdfSheetPlayer, key: TallyColumn["key"]): string {
  const v = p.tally?.[key];
  if (v === undefined || v === null || v === false || v === 0) return "";
  if (v === true) return "X";
  return String(v);
}

function statCell(v: number | null | undefined, suffix = ""): string {
  if (v === null || v === undefined) return "-";
  return `${v}${suffix}`;
}

function identityLine(team: PdfSheetTeam): string {
  const parts = [
    team.team.rosterName,
    team.team.coach ? `Coach : ${team.team.coach}` : null,
    team.teamValue ? `VE ${formatGoldPdf(team.teamValue)}` : null,
    team.currentValue ? `VEA ${formatGoldPdf(team.currentValue)}` : null,
    team.staff ? `Relances ${team.staff.rerolls}` : null,
    team.staff ? `Apothicaire ${team.staff.apothecary ? "oui" : "non"}` : null,
  ].filter(Boolean);
  return parts.map((s) => pdfSafe(s)).join("   |   ");
}

export function drawRosterPage(
  page: PdfPage,
  y: number,
  doc: MatchSheetDocument,
  side: "home" | "away",
): number {
  const team = side === "home" ? doc.home : doc.away;
  const { doc: pdf } = page;
  const sideLabel = side === "home" ? "Domicile" : "Extérieur";
  y = drawSectionTitle(page, y, `${sideLabel} - ${team.team.name}`, {
    right: doc.rules.spp ? "Cochez un trait par action : IIII" : null,
  });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  setText(pdf, PDF_COLORS.INK_SOFT);
  pdf.text(identityLine(team), page.margin, y);
  y += 3;

  const tally = TALLY_COLUMNS;
  const withSpp = doc.rules.spp;
  const fixed = 7 + 22 + 7 * 5; // # + poste + M F AG CP AR
  const tallyW = tally.reduce((n, c) => n + c.width, 0) + (withSpp ? 9 + 9 : 0);
  const width = contentWidth(page);
  const flex = width - fixed - tallyW;
  const nameW = Math.max(30, flex * 0.36);
  const skillsW = flex - nameW;

  const head = [
    [
      "N°",
      "Nom",
      "Poste",
      "M",
      "F",
      "AG",
      "CP",
      "AR",
      "Compétences",
      ...(withSpp ? ["PSP"] : []),
      ...tally.map((c) => c.label),
      ...(withSpp ? ["+PSP"] : []),
    ],
  ];

  const players = team.players;
  const body: string[][] = players.map((p) => [
    p.number !== null ? String(p.number) : "",
    pdfSafe(p.note ? `${p.name} (${p.note})` : p.name),
    pdfSafe(p.position),
    statCell(p.stats?.ma),
    statCell(p.stats?.st),
    statCell(p.stats?.ag, "+"),
    p.stats ? (p.stats.pa === null ? "-" : `${p.stats.pa}+`) : "-",
    statCell(p.stats?.av, "+"),
    pdfSafe(p.skills),
    ...(withSpp ? [p.spp !== null && p.spp !== undefined ? String(p.spp) : ""] : []),
    ...tally.map((c) => (p.unavailable ? "" : tallyValue(p, c.key))),
    ...(withSpp ? [p.tally?.spp ? String(p.tally.spp) : ""] : []),
  ]);
  const blank = head[0].map(() => "");
  for (let i = 0; i < EXTRA_ROSTER_ROWS; i++) body.push([...blank]);

  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: 7, halign: "center", fontStyle: "bold" },
    1: { cellWidth: nameW, fontStyle: "bold" },
    2: { cellWidth: 22, fontSize: 7 },
    3: { cellWidth: 7, halign: "center" },
    4: { cellWidth: 7, halign: "center" },
    5: { cellWidth: 7, halign: "center" },
    6: { cellWidth: 7, halign: "center" },
    7: { cellWidth: 7, halign: "center" },
    8: { cellWidth: skillsW, fontSize: 6.4, textColor: hexToRgb(PDF_COLORS.INK_SOFT) },
  };
  let col = 9;
  if (withSpp) {
    columnStyles[col++] = { cellWidth: 9, halign: "center", textColor: hexToRgb(PDF_COLORS.INK_SOFT) };
  }
  for (const c of tally) {
    columnStyles[col++] = {
      cellWidth: c.width,
      halign: "center",
      fontStyle: "bold",
      lineColor: hexToRgb(PDF_COLORS.INK_FAINT),
    };
  }
  if (withSpp) {
    columnStyles[col++] = {
      cellWidth: 9,
      halign: "center",
      fontStyle: "bold",
      fillColor: hexToRgb(PDF_COLORS.ACCENT_TINT),
    };
  }
  const firstTallyCol = 9 + (withSpp ? 1 : 0);

  drawTable(pdf, {
    startY: y,
    margin: { left: page.margin, right: page.margin, top: 20, bottom: 16 },
    head,
    body,
    theme: "grid",
    headStyles: { ...HEAD_STYLES, fontSize: 6.8 },
    bodyStyles: { ...BODY_STYLES, fontSize: 7.8, minCellHeight: 7, cellPadding: 1 },
    columnStyles,
    didParseCell: (d: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { styles: Record<string, unknown> };
    }) => {
      if (d.section === "head" && d.column.index >= firstTallyCol) {
        d.cell.styles.fillColor = hexToRgb(PDF_COLORS.ACCENT_DARK);
      }
      if (d.section !== "body") return;
      const p = players[d.row.index];
      if (!p) return; // ligne vierge
      if (p.unavailable) {
        d.cell.styles.fillColor = hexToRgb(PDF_COLORS.MUTED_ROW);
        d.cell.styles.textColor = hexToRgb(PDF_COLORS.INK_FAINT);
      }
    },
    didDrawCell: (d: {
      section: string;
      row: { index: number };
      column: { index: number };
      cell: { x: number; y: number; width: number; height: number };
      doc: typeof pdf;
    }) => {
      // Cases d'un absent barrées : il ne jouera pas ce match.
      if (d.section !== "body" || d.column.index < firstTallyCol) return;
      const p = players[d.row.index];
      if (!p?.unavailable) return;
      const { x, y: cy, width: w, height: h } = d.cell;
      d.doc.setDrawColor(...hexToRgb(PDF_COLORS.INK_FAINT));
      d.doc.setLineWidth(0.15);
      d.doc.line(x + 1, cy + h - 1, x + w - 1, cy + 1);
    },
  });
  let end = lastTableBottom(pdf, y + 20) + 3.5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6.6);
  setText(pdf, PDF_COLORS.INK_SOFT);
  const legend = [
    ...tally.filter((c) => c.key !== "injury").map((c) => `${c.label} = ${c.legend}`),
    ...(withSpp ? ["+PSP = PSP gagnés ce match"] : []),
  ].join("  -  ");
  const wrapped = pdf.splitTextToSize(legend, width) as string[];
  pdf.text(wrapped, page.margin, end);
  end += wrapped.length * 3;
  pdf.text(
    "Blessure : C = Commotion, A = Amoché (rate le prochain match), BP = Blessure persistante, S = Séquelle (préciser M/F/AG/CP/AR), M = Mort.   Lignes vierges : journaliers, Star Players engagés, joueur relevé.",
    page.margin,
    end,
  );
  return end + 4;
}
