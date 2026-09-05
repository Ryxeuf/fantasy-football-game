/**
 * Client des documents officiels de competition (ligues / championnats et
 * coupes).
 *
 * Un seul module pour les deux familles : cote serveur les handlers sont
 * partages (`/api/competitions/:kind/...`), il n'y a donc aucune raison de
 * dupliquer le client par page.
 *
 * L'upload envoie le FICHIER BRUT en corps (pas de `FormData`) : c'est ce
 * qu'attend la route, qui detecte le type par magic bytes et regenere le nom
 * cote serveur. Les metadonnees facultatives passent par la query string.
 */

import { apiRequest } from "./api-client";

/** Segment d'URL de la famille de competition. */
export type CompetitionDocumentScope = "leagues" | "cups";

export interface CompetitionDocument {
  readonly id: string;
  readonly competitionKind: "league" | "cup";
  readonly competitionId: string;
  readonly competitionName: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly filename: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly bytes: number;
  readonly url: string;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly uploadedBy: {
    readonly id: string;
    readonly coachName: string;
  } | null;
}

/** Plafond produit, duplique ici pour un feedback immediat avant l'envoi. */
export const MAX_COMPETITION_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Types acceptes par la route (`accept` de l'input fichier). */
export const COMPETITION_DOCUMENT_ACCEPT =
  "application/pdf,image/png,image/jpeg,image/gif,image/webp";

/** Extensions correspondantes, pour les messages d'erreur. */
export const COMPETITION_DOCUMENT_FORMATS_LABEL = "PDF, PNG, JPEG, GIF, WEBP";

/** Formatte une taille en octets pour l'affichage. */
export function formatDocumentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Vrai si le document peut etre previsualise comme une image. */
export function isImageDocument(doc: CompetitionDocument): boolean {
  return doc.mimeType.startsWith("image/");
}

function base(scope: CompetitionDocumentScope, competitionId: string): string {
  return `/api/competitions/${scope}/${encodeURIComponent(competitionId)}/documents`;
}

export async function listCompetitionDocuments(
  scope: CompetitionDocumentScope,
  competitionId: string,
): Promise<CompetitionDocument[]> {
  const data = await apiRequest<{ documents: CompetitionDocument[] }>(
    base(scope, competitionId),
  );
  return data.documents;
}

export interface UploadCompetitionDocumentInput {
  readonly scope: CompetitionDocumentScope;
  readonly competitionId: string;
  readonly file: File;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Depose un document. Le garde-fou de taille est double : ici pour un message
 * immediat, et cote serveur (parser `express.raw`) qui reste la verite.
 */
export async function uploadCompetitionDocument(
  input: UploadCompetitionDocumentInput,
): Promise<CompetitionDocument> {
  const { scope, competitionId, file, title, description } = input;
  if (file.size === 0) {
    throw new Error("Fichier vide");
  }
  if (file.size > MAX_COMPETITION_DOCUMENT_BYTES) {
    throw new Error(
      `« ${file.name} » depasse la limite de 10 Mo (${formatDocumentSize(file.size)})`,
    );
  }
  const qs = new URLSearchParams({ filename: file.name });
  if (title?.trim()) qs.set("title", title.trim());
  if (description?.trim()) qs.set("description", description.trim());

  const data = await apiRequest<{ document: CompetitionDocument }>(
    `${base(scope, competitionId)}?${qs.toString()}`,
    {
      method: "POST",
      body: file,
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
    },
  );
  return data.document;
}

export async function updateCompetitionDocument(
  scope: CompetitionDocumentScope,
  competitionId: string,
  documentId: string,
  patch: { title?: string; description?: string | null; sortOrder?: number },
): Promise<CompetitionDocument> {
  const data = await apiRequest<{ document: CompetitionDocument }>(
    `${base(scope, competitionId)}/${encodeURIComponent(documentId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return data.document;
}

export async function deleteCompetitionDocument(
  scope: CompetitionDocumentScope,
  competitionId: string,
  documentId: string,
): Promise<void> {
  await apiRequest<{ deleted: boolean }>(
    `${base(scope, competitionId)}/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
  );
}

/**
 * Depose une serie de fichiers mis de cote pendant la CREATION d'une
 * competition : l'id n'existe qu'une fois la competition creee, les fichiers
 * sont donc envoyes juste apres, dans un second temps.
 *
 * Ne leve jamais : la competition, elle, est bien creee. On rend la liste des
 * echecs pour que la page les signale sans annuler la creation.
 */
export async function uploadPendingCompetitionDocuments(
  scope: CompetitionDocumentScope,
  competitionId: string,
  files: readonly File[],
): Promise<string[]> {
  const failures: string[] = [];
  for (const file of files) {
    try {
      await uploadCompetitionDocument({ scope, competitionId, file });
    } catch (e: unknown) {
      failures.push(
        `${file.name} : ${e instanceof Error ? e.message : "erreur"}`,
      );
    }
  }
  return failures;
}
