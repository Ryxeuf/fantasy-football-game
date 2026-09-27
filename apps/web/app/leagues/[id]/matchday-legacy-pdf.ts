/**
 * Rendu HISTORIQUE de l'export de journée (tableau brut jsPDF + autotable).
 *
 * Conservé tant que le flag `competition_pdf_exports` est OFF : le nouveau
 * gabarit (`lib/competition-pdf`) est en recette, et l'export que les
 * commissaires utilisent déjà ne doit pas changer sous leurs pieds. À
 * supprimer quand le flag sera retiré du code.
 */

import type { LeaguePairingDetail } from "./types";

export interface LegacyMatchdayPdfInput {
  leagueName?: string;
  roundTitle: string;
  roundNumber: number;
  date: string | null;
  pairings: LeaguePairingDetail[];
  statusLabel: (pairing: LeaguePairingDetail) => string;
  labels: { home: string; away: string; status: string };
}

/** « Nom d'équipe (Coach) » pour le PDF — le coach si l'API le fournit. */
export function teamWithCoach(
  participant: LeaguePairingDetail["homeParticipant"],
): string {
  const coach = participant.team.owner?.coachName;
  return coach ? `${participant.team.name} (${coach})` : participant.team.name;
}

export async function exportLegacyMatchdayPdf(
  input: LegacyMatchdayPdfInput,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF();
  let y = 18;
  if (input.leagueName) {
    doc.setFontSize(11);
    doc.setTextColor(120);
    doc.text(input.leagueName, 14, y);
    y += 7;
  }
  doc.setFontSize(16);
  doc.setTextColor(20);
  doc.text(input.roundTitle, 14, y);
  y += 7;
  if (input.date) {
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(input.date, 14, y);
    y += 4;
  }
  autoTable(doc, {
    startY: y + 4,
    head: [[input.labels.home, "", input.labels.away, input.labels.status]],
    body: input.pairings.map((p) => [
      teamWithCoach(p.homeParticipant),
      "vs",
      teamWithCoach(p.awayParticipant),
      input.statusLabel(p),
    ]),
    styles: { fontSize: 10 },
    headStyles: { fillColor: [40, 40, 40] },
  });
  doc.save(`journee-${input.roundNumber}.pdf`);
}
