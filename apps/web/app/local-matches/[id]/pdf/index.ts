/**
 * Orchestrateur de l'export PDF de recap de match.
 *
 * Page 1: Header + Scoreboard + Pre-game + Box score
 * Page 2: Star of the Match + Drive Chart (1ere et 2eme mi-temps)
 * Page 3+: Play-by-Play log (autotable, multi-pages auto)
 *
 * Tous les modules de dessin sont purs cote PDF: aucun acces DOM/React. La
 * fonction est asynchrone car jsPDF/jspdf-autotable sont importes en lazy
 * pour ne pas alourdir le bundle initial.
 */

import { computeAggregates } from "./aggregations";
import { decoratePage, paginate, PAGE_HEIGHT_MM } from "./chrome";
import { drawHeader } from "./sections/header";
import { drawScoreboard } from "./sections/scoreboard";
import { drawPregame } from "./sections/pregame";
import { drawBoxScore } from "./sections/boxScore";
import { drawMvpSection } from "./sections/mvp";
import { drawDriveChart } from "./sections/driveChart";
import { drawPlayLog } from "./sections/playLog";
import type { PdfAction, PdfMatch } from "./types";

export type { PdfAction, PdfMatch } from "./types";

export interface GenerateMatchPdfResult {
  filename: string;
  save(): void;
}

export async function generateMatchPdf(
  match: PdfMatch,
  actions: ReadonlyArray<PdfAction>,
): Promise<GenerateMatchPdfResult> {
  const { default: jsPDFCtor } = await import("jspdf");
  // Charger le plugin autotable: il s'attache au prototype de jsPDF.
  await import("jspdf-autotable");

  const doc = new jsPDFCtor({ orientation: "portrait", unit: "mm", format: "a4" });
  const matchName = (match.name && match.name.trim()) || "Match Blood Bowl";
  const decorate = () => decoratePage(doc, matchName);

  decorate();
  const aggregates = computeAggregates(match, actions);

  // Page 1
  const { bottomY: headerBottom } = drawHeader(doc, match, 12);
  const scoreStart = headerBottom + 5;
  const { bottomY: scoreboardBottom } = drawScoreboard(doc, match, aggregates, scoreStart);
  const pregameStart = scoreboardBottom + 6;
  const { bottomY: pregameBottom } = drawPregame(doc, match, pregameStart);
  const boxScoreStart = pregameBottom + 6;
  drawBoxScore(doc, match, aggregates, boxScoreStart);

  // Page 2
  doc.addPage();
  decorate();
  const mvpStart = 14;
  const { bottomY: mvpBottom } = drawMvpSection(doc, match, aggregates, mvpStart);
  const driveStart = mvpBottom + 8;
  const { bottomY: driveBottom } = drawDriveChart(doc, match, actions, driveStart, decorate);

  // Page 3+: play log (peut consommer plusieurs pages)
  // Hauteur minimale (bandeau titre + 3 rangees + marges) pour eviter de
  // commencer la table en bas de page.
  const PLAYLOG_MIN_HEIGHT = 40;
  if (actions.length > 0) {
    if (driveBottom + PLAYLOG_MIN_HEIGHT > PAGE_HEIGHT_MM - 18) {
      doc.addPage();
      decorate();
      drawPlayLog(doc, match, actions, 12, decorate);
    } else {
      drawPlayLog(doc, match, actions, driveBottom + 4, decorate);
    }
  }

  paginate(doc);

  const safeName = matchName.replace(/[^a-z0-9]/gi, "_").slice(0, 60) || "match";
  const filename = `${safeName}_recap.pdf`;

  return {
    filename,
    save: () => doc.save(filename),
  };
}
