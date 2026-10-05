/**
 * Console admin des feuilles de match — chemins et libellés, purs et
 * testés à part. Une feuille de ligue et une feuille de coupe partagent les
 * mêmes handlers serveur, montés sous deux préfixes.
 */

import type { Route } from "next";

export type SheetKind = "league" | "cup";

export interface AdminMatchSheetTeam {
  teamId: string;
  teamName: string;
  coachName: string | null;
}

export interface AdminMatchSheet {
  id: string;
  kind: SheetKind;
  pairingId: string;
  status: string;
  scoreHome: number;
  scoreAway: number;
  forfeitSide: string | null;
  submittedByHomeAt: string | null;
  submittedByAwayAt: string | null;
  validatedAt: string | null;
  invalidatedAt: string | null;
  invalidationReason: string | null;
  eventsCount: number;
  competition: { id: string; name: string };
  seasonName: string | null;
  roundNumber: number;
  roundName: string | null;
  home: AdminMatchSheetTeam | null;
  away: AdminMatchSheetTeam | null;
  createdAt: string;
  updatedAt: string;
}

/** Page de l'éditeur standard (l'admin y a les droits du commissaire). */
export function sheetEditorPath(
  sheet: Pick<AdminMatchSheet, "kind" | "pairingId">,
): Route {
  return (
    sheet.kind === "cup"
      ? `/cups/pairings/${sheet.pairingId}/sheet`
      : `/leagues/pairings/${sheet.pairingId}/sheet`
  ) as Route;
}

/** Préfixe API des actions de feuille (`/validate`, `/invalidate`…). */
export function sheetApiPath(
  sheet: Pick<AdminMatchSheet, "kind" | "pairingId">,
): string {
  return sheet.kind === "cup"
    ? `/cup/pairings/${sheet.pairingId}/sheet`
    : `/leagues/pairings/${sheet.pairingId}/sheet`;
}

export function competitionAdminPath(
  sheet: Pick<AdminMatchSheet, "kind" | "competition">,
): Route {
  return (
    sheet.kind === "cup"
      ? `/admin/cups/${sheet.competition.id}`
      : `/admin/leagues/${sheet.competition.id}`
  ) as Route;
}

export const SHEET_STATUS_META: Readonly<
  Record<string, { label: string; tone: string }>
> = {
  draft: { label: "Brouillon", tone: "bg-gray-100 text-gray-700" },
  submitted_home: {
    label: "Soumise (domicile)",
    tone: "bg-sky-100 text-sky-800",
  },
  submitted_away: {
    label: "Soumise (extérieur)",
    tone: "bg-sky-100 text-sky-800",
  },
  both_submitted: { label: "À valider", tone: "bg-amber-100 text-amber-800" },
  validated: { label: "Validée", tone: "bg-green-100 text-green-800" },
  invalidated: { label: "Invalidée", tone: "bg-red-100 text-red-700" },
};

export function roundLabel(
  sheet: Pick<AdminMatchSheet, "kind" | "roundNumber" | "roundName" | "seasonName">,
): string {
  const round =
    sheet.roundName ||
    (sheet.kind === "cup"
      ? `Ronde ${sheet.roundNumber}`
      : `Journée ${sheet.roundNumber}`);
  return sheet.seasonName ? `${sheet.seasonName} · ${round}` : round;
}

/** Actions de console ouvertes pour un statut donné. */
export function sheetActions(status: string): {
  canValidate: boolean;
  canInvalidate: boolean;
  canDelete: boolean;
} {
  return {
    canValidate: status !== "validated",
    canInvalidate: status === "validated",
    canDelete: status !== "validated",
  };
}
