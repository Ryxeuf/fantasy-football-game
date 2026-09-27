/**
 * Téléchargement côté navigateur : jsPDF, autotable et les gabarits ne sont
 * chargés qu'au clic (import dynamique), pour ne pas alourdir les pages de
 * compétition.
 */

import type { CompetitionPdfRequest } from "./render";

export async function downloadCompetitionPdf(
  req: CompetitionPdfRequest,
  filename: string,
): Promise<void> {
  const { renderCompetitionPdf } = await import("./render");
  const doc = renderCompetitionPdf(req);
  doc.save(filename);
}

export type { CompetitionPdfRequest } from "./render";
export type { CompetitionPdfKind } from "./filename";
export { pdfFilename } from "./filename";
