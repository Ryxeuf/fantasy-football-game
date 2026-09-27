/**
 * Rencontres : journée à venir (feuille d'affichage avec cases de score) et
 * calendrier complet (toutes les journées, scores connus).
 */

import type jsPDF from "jspdf";
import type {
  CalendarDocument,
  MatchdayDocument,
  PdfFixture,
  PdfRound,
} from "../types";
import {
  addPage,
  bottomLimit,
  contentWidth,
  createPage,
  drawDocumentHeader,
  drawSectionTitle,
  ensureSpace,
  finalizePages,
  type PdfPage,
} from "../layout";
import {
  BODY_STYLES,
  HEAD_STYLES,
  ZEBRA_STYLES,
  drawTable,
  lastTableBottom,
  teamCell,
  teamCellHooks,
} from "../tables";
import { PDF_COLORS, hexToRgb, pdfSafe, setDraw, setFill, setText } from "../theme";

type Mode = "matchday" | "calendar";

function scoreText(f: PdfFixture): string {
  if (f.score) return `${f.score.home} - ${f.score.away}`;
  return "";
}

/** Deux cases vides « [ ] - [ ] » à remplir au stylo. */
function drawScoreBoxes(doc: jsPDF, cx: number, cy: number): void {
  const w = 7.5;
  const h = 6.5;
  setDraw(doc, PDF_COLORS.INK);
  doc.setLineWidth(0.3);
  setFill(doc, PDF_COLORS.WHITE);
  doc.rect(cx - w - 2.2, cy - h / 2, w, h, "FD");
  doc.rect(cx + 2.2, cy - h / 2, w, h, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(doc, PDF_COLORS.INK_SOFT);
  doc.text("-", cx, cy + 1, { align: "center" });
}

function drawGroupTable(
  page: PdfPage,
  y: number,
  fixtures: PdfFixture[],
  mode: Mode,
): number {
  const { doc } = page;
  const width = contentWidth(page);
  const showDate = fixtures.some((f) => f.scheduledLabel);
  const scoreBoxes = mode === "matchday";

  const head = [
    [
      "#",
      "Domicile",
      "Score",
      "Extérieur",
      ...(showDate ? ["Date prévue"] : []),
      "Statut",
    ],
  ];
  const body = fixtures.map((f, i) => [
    String(i + 1),
    teamCell(f.home, "right", "À déterminer"),
    scoreBoxes && !f.score && f.away ? "" : scoreText(f) || (f.away ? "" : "-"),
    f.away ? teamCell(f.away, "left") : "Exempt",
    ...(showDate ? [pdfSafe(f.scheduledLabel ?? "")] : []),
    pdfSafe(f.statusLabel),
  ]);

  const dateW = showDate ? 26 : 0;
  const statusW = 26;
  const scoreW = scoreBoxes ? 26 : 16;
  const numW = 7;
  const teamW = (width - dateW - statusW - scoreW - numW) / 2;
  const hooks = teamCellHooks();

  const columnStyles: Record<number, Record<string, unknown>> = {
    0: { cellWidth: numW, halign: "center", textColor: hexToRgb(PDF_COLORS.INK_FAINT) },
    1: { cellWidth: teamW, halign: "right" },
    2: { cellWidth: scoreW, halign: "center", fontStyle: "bold", fontSize: 11 },
    3: { cellWidth: teamW, halign: "left" },
  };
  let col = 4;
  if (showDate) {
    columnStyles[col] = { cellWidth: dateW, halign: "center", fontSize: 7.5 };
    col++;
  }
  columnStyles[col] = {
    cellWidth: statusW,
    halign: "center",
    fontSize: 7.5,
    textColor: hexToRgb(PDF_COLORS.INK_SOFT),
  };

  drawTable(doc, {
    startY: y,
    margin: { left: page.margin, right: page.margin, top: 20, bottom: 16 },
    head,
    body,
    theme: "grid",
    headStyles: { ...HEAD_STYLES },
    bodyStyles: {
      ...BODY_STYLES,
      minCellHeight: scoreBoxes ? 11 : 9,
    },
    alternateRowStyles: { ...ZEBRA_STYLES },
    columnStyles,
    willDrawCell: hooks.willDrawCell,
    didDrawCell: (data: Parameters<typeof hooks.didDrawCell>[0]) => {
      hooks.didDrawCell(data);
      const fixture = fixtures[data.row.index];
      if (
        scoreBoxes &&
        data.section === "body" &&
        data.column.index === 2 &&
        fixture &&
        fixture.away &&
        !fixture.score
      ) {
        const cell = data.cell;
        drawScoreBoxes(doc, cell.x + cell.width / 2, cell.y + cell.height / 2);
      }
    },
  });
  return lastTableBottom(doc, y + 20) + 4;
}

function drawRound(page: PdfPage, y: number, round: PdfRound, mode: Mode): number {
  const fixtureCount = round.groups.reduce((n, g) => n + g.fixtures.length, 0);
  if (mode === "calendar") {
    // Titre + au moins deux rencontres sur la même page que leur journée.
    y = ensureSpace(page, y, 34);
    const right = [round.subtitle, round.statusLabel].filter(Boolean).join(" - ");
    y = drawSectionTitle(page, y, round.title, { right: right || null });
  }
  if (fixtureCount === 0) {
    const { doc } = page;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text("Aucune rencontre programmée.", page.margin, y + 2);
    return y + 8;
  }
  for (const group of round.groups) {
    if (group.fixtures.length === 0) continue;
    if (group.label) {
      y = ensureSpace(page, y, 24);
      const { doc } = page;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      setText(doc, PDF_COLORS.INK);
      setFill(doc, PDF_COLORS.ACCENT);
      doc.rect(page.margin, y - 2.8, 1.2, 3.6, "F");
      doc.text(pdfSafe(group.label), page.margin + 2.8, y);
      y += 2.5;
    }
    y = drawGroupTable(page, y, group.fixtures, mode);
  }
  return y + 2;
}

/** Feuille de la journée à venir : cases de score à remplir. */
export function renderMatchday(doc: jsPDF, data: MatchdayDocument): void {
  const page = createPage(doc, data.meta, "Journée");
  const subtitle = [data.round.title, data.round.subtitle].filter(Boolean).join("\n");
  let y = drawDocumentHeader(page, subtitle);
  y = drawRound(page, y, data.round, "matchday");

  // Encadré de rappel en bas : utile affiché au mur du club.
  y = ensureSpace(page, y + 2, 26);
  const { doc: d } = page;
  setDraw(d, PDF_COLORS.RULE);
  setFill(d, PDF_COLORS.ACCENT_TINT);
  d.setLineWidth(0.2);
  d.roundedRect(page.margin, y, contentWidth(page), 20, 1.5, 1.5, "FD");
  d.setFont("helvetica", "bold");
  d.setFontSize(8.5);
  setText(d, PDF_COLORS.ACCENT_DARK);
  d.text("RAPPEL", page.margin + 4, y + 5.5);
  d.setFont("helvetica", "normal");
  setText(d, PDF_COLORS.INK);
  d.text(
    [
      "Chaque rencontre se consigne sur sa feuille de match (Nuffle Arena ou feuille imprimée),",
      "signée par les deux coachs puis validée par le commissaire. Reportez ici le score final.",
    ],
    page.margin + 4,
    y + 10.5,
  );
  finalizePages(page);
}

/** Calendrier complet : toutes les journées à la suite. */
export function renderCalendar(doc: jsPDF, data: CalendarDocument): void {
  const page = createPage(doc, data.meta, "Calendrier");
  const played = data.rounds.reduce(
    (n, r) => n + r.groups.reduce((m, g) => m + g.fixtures.filter((f) => f.score).length, 0),
    0,
  );
  const total = data.rounds.reduce(
    (n, r) => n + r.groups.reduce((m, g) => m + g.fixtures.filter((f) => f.away).length, 0),
    0,
  );
  let y = drawDocumentHeader(
    page,
    `${data.rounds.length} ${data.meta.competitionKind === "cup" ? "rondes" : "journées"} - ${played}/${total} rencontres jouées`,
  );
  if (data.rounds.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    setText(doc, PDF_COLORS.INK_FAINT);
    doc.text("Le calendrier n'a pas encore été généré.", page.margin, y + 4);
  }
  for (const round of data.rounds) {
    if (y > bottomLimit(page) - 10) y = addPage(page);
    y = drawRound(page, y, round, "calendar");
  }
  finalizePages(page);
}
