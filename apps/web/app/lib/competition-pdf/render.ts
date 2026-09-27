/**
 * Point d'entrée SYNCHRONE du rendu : prend un jsPDF vierge et le remplit.
 * Importable en Node (tests, génération d'exemples) comme dans le navigateur.
 * Côté écran, passer par `download.ts`, qui charge ce module à la demande.
 */

import { jsPDF } from "jspdf";
import type {
  BracketDocument,
  CalendarDocument,
  LeaderboardsDocument,
  MatchSheetDocument,
  MatchdayDocument,
  StandingsDocument,
  StatsDocument,
} from "./types";
import { renderCalendar, renderMatchday } from "./documents/fixtures";
import { renderStandings } from "./documents/standings";
import { renderLeaderboards } from "./documents/leaderboards";
import { renderBracket } from "./documents/bracket";
import { renderStats } from "./documents/stats";
import { renderMatchSheet } from "./documents/match-sheet";
import { FILE_PREFIX } from "./filename";

export type CompetitionPdfRequest =
  | { kind: "matchday"; data: MatchdayDocument }
  | { kind: "calendar"; data: CalendarDocument }
  | { kind: "standings"; data: StandingsDocument }
  | { kind: "leaderboards"; data: LeaderboardsDocument }
  | { kind: "bracket"; data: BracketDocument }
  | { kind: "stats"; data: StatsDocument }
  | { kind: "match-sheet"; data: MatchSheetDocument };

export type { CompetitionPdfKind } from "./filename";
import type { CompetitionPdfKind } from "./filename";

/** Le bracket et la feuille de rencontre se lisent en paysage. */
export function orientationFor(kind: CompetitionPdfKind): "portrait" | "landscape" {
  return kind === "bracket" || kind === "match-sheet" ? "landscape" : "portrait";
}

export function renderCompetitionPdf(req: CompetitionPdfRequest): jsPDF {
  const doc = new jsPDF({ orientation: orientationFor(req.kind), unit: "mm", format: "a4" });
  switch (req.kind) {
    case "matchday":
      renderMatchday(doc, req.data);
      break;
    case "calendar":
      renderCalendar(doc, req.data);
      break;
    case "standings":
      renderStandings(doc, req.data);
      break;
    case "leaderboards":
      renderLeaderboards(doc, req.data);
      break;
    case "bracket":
      renderBracket(doc, req.data);
      break;
    case "stats":
      renderStats(doc, req.data);
      break;
    case "match-sheet":
      renderMatchSheet(doc, req.data);
      break;
  }
  doc.setProperties({
    title: `${req.data.meta.competitionName} - ${FILE_PREFIX[req.kind]}`,
    creator: "Nuffle Arena",
  });
  return doc;
}
