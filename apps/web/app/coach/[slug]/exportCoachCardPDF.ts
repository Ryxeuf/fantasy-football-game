import { buildCoachCardSections } from "./coachCardSections";
import type {
  CoachEloSnapshot,
  CoachPublicProfile,
} from "./types";

/**
 * S26.3o — Generates the public coach-card PDF and triggers a download.
 *
 * Uses dynamic imports so jspdf and jspdf-autotable are not bundled into
 * the main page payload (only loaded on click). Mirrors the pattern from
 * `apps/web/app/me/teams/utils/exportPDF.ts`.
 */
export async function exportCoachCardPDF(
  profile: CoachPublicProfile,
  snapshots: CoachEloSnapshot[],
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const sections = buildCoachCardSections(profile, snapshots);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 15;

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(sections.title, margin, 20);

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(sections.subtitle, margin, 28);

  let y = 36;
  if (sections.eloSummary) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text(`Courbe ELO 90j : ${sections.eloSummary}`, margin, y);
    y += 8;
  }

  if (sections.achievementRows.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Succes recents", margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Succes", "Categorie", "Annee"]],
      body: sections.achievementRows,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: margin, right: margin },
    });
    y = (doc as unknown as { lastAutoTable?: { finalY: number } })
      .lastAutoTable?.finalY ?? y + 30;
    y += 6;
  }

  if (sections.recentTeamRows.length > 0) {
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Equipes recentes", margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Nom", "Roster", "Valeur"]],
      body: sections.recentTeamRows,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 2 },
      margin: { left: margin, right: margin },
    });
  }

  doc.save(sections.fileName);
}
