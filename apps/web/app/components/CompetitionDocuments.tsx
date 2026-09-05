"use client";

/**
 * Panneau « Documents officiels » d'une competition (ligue / championnat ou
 * coupe).
 *
 * Un seul composant sert les deux familles et les deux publics :
 *  - tout visiteur autorise voit la LISTE et telecharge les fichiers ;
 *  - le commissaire (ou un admin) voit en plus le depot, le renommage et la
 *    suppression, via `canManage`.
 *
 * Le composant est autonome : il charge lui-meme sa liste au montage, donc il
 * s'insere dans n'importe quelle page sans refactor du parent. Une competition
 * privee dont le visiteur n'est pas membre repond 403 : on n'affiche alors
 * simplement rien plutot qu'une erreur (le panneau n'est pas le sujet de la
 * page).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  COMPETITION_DOCUMENT_ACCEPT,
  COMPETITION_DOCUMENT_FORMATS_LABEL,
  deleteCompetitionDocument,
  formatDocumentSize,
  isImageDocument,
  listCompetitionDocuments,
  updateCompetitionDocument,
  uploadCompetitionDocument,
  type CompetitionDocument,
  type CompetitionDocumentScope,
} from "../lib/competition-documents";
import { ApiClientError } from "../lib/api-client";

interface CompetitionDocumentsProps {
  readonly scope: CompetitionDocumentScope;
  readonly competitionId: string;
  /** Commissaire de la competition ou admin : affiche les actions d'edition. */
  readonly canManage?: boolean;
  /** Titre de section (defaut « Documents officiels »). */
  readonly title?: string;
}

function documentIcon(doc: CompetitionDocument): string {
  return doc.mimeType === "application/pdf" ? "📄" : "🖼️";
}

export default function CompetitionDocuments({
  scope,
  competitionId,
  canManage = false,
  title = "Documents officiels",
}: CompetitionDocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<CompetitionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  /** 403 = competition privee dont on n'est pas membre : on masque le bloc. */
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listCompetitionDocuments(scope, competitionId);
      setDocuments(list);
      setHidden(false);
    } catch (e: unknown) {
      if (
        e instanceof ApiClientError &&
        (e.status === 403 || e.status === 404)
      ) {
        setHidden(true);
      } else {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
    } finally {
      setLoading(false);
    }
  }, [scope, competitionId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      setError(null);
      const failures: string[] = [];
      // Sequentiel : un envoi de 10 Mo par fichier, et l'ordre d'affichage
      // (`sortOrder`) est attribue a la creation cote serveur.
      for (const file of Array.from(files)) {
        try {
          await uploadCompetitionDocument({ scope, competitionId, file });
        } catch (e: unknown) {
          failures.push(
            `${file.name} : ${e instanceof Error ? e.message : "erreur"}`,
          );
        }
      }
      if (failures.length > 0) setError(failures.join(" — "));
      if (fileInputRef.current) fileInputRef.current.value = "";
      await reload();
      setBusy(false);
    },
    [scope, competitionId, reload],
  );

  const startEdit = useCallback((doc: CompetitionDocument) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditDescription(doc.description ?? "");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    setBusy(true);
    setError(null);
    try {
      await updateCompetitionDocument(scope, competitionId, editingId, {
        title: editTitle.trim() || undefined,
        description: editDescription.trim() ? editDescription.trim() : null,
      });
      setEditingId(null);
      await reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement");
    } finally {
      setBusy(false);
    }
  }, [editingId, editTitle, editDescription, scope, competitionId, reload]);

  const remove = useCallback(
    async (doc: CompetitionDocument) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(`Supprimer définitivement « ${doc.title} » ?`)
      ) {
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await deleteCompetitionDocument(scope, competitionId, doc.id);
        await reload();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Erreur de suppression");
      } finally {
        setBusy(false);
      }
    },
    [scope, competitionId, reload],
  );

  // Rien a montrer et rien a faire : on n'occupe pas la page avec une section
  // vide (cas d'un visiteur sur une competition sans document).
  if (hidden) return null;
  if (!loading && documents.length === 0 && !canManage) return null;

  return (
    <section
      data-testid="competition-documents"
      className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
          📎 {title}
        </h2>
        {canManage ? (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={COMPETITION_DOCUMENT_ACCEPT}
              data-testid="competition-documents-input"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <button
              type="button"
              disabled={busy}
              data-testid="competition-documents-upload"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Envoi…" : "＋ Ajouter un document"}
            </button>
          </div>
        ) : null}
      </div>

      {canManage ? (
        <p className="text-xs text-gray-500">
          {COMPETITION_DOCUMENT_FORMATS_LABEL} — 10 Mo maximum par fichier.
          Ajout et retrait possibles à tout moment, même une fois la compétition
          démarrée.
        </p>
      ) : null}

      {error ? (
        <p
          data-testid="competition-documents-error"
          className="text-sm text-red-600"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : documents.length === 0 ? (
        <p
          data-testid="competition-documents-empty"
          className="text-sm text-gray-500"
        >
          Aucun document officiel pour le moment.
        </p>
      ) : (
        <ul
          className="divide-y divide-gray-100"
          data-testid="competition-documents-list"
        >
          {documents.map((doc) => (
            <li
              key={doc.id}
              data-testid={`competition-document-${doc.id}`}
              className="py-2 flex flex-wrap items-start gap-3"
            >
              <span className="text-xl leading-6" aria-hidden="true">
                {documentIcon(doc)}
              </span>
              <div className="flex-1 min-w-[12rem]">
                {editingId === doc.id ? (
                  <div className="space-y-2">
                    <input
                      value={editTitle}
                      maxLength={160}
                      onChange={(e) => setEditTitle(e.target.value)}
                      data-testid="competition-document-edit-title"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <input
                      value={editDescription}
                      maxLength={500}
                      placeholder="Description (optionnelle)"
                      onChange={(e) => setEditDescription(e.target.value)}
                      data-testid="competition-document-edit-description"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveEdit()}
                        data-testid="competition-document-save"
                        className="px-2 py-1 rounded bg-nuffle-gold text-white text-xs font-medium disabled:opacity-50"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2 py-1 rounded border border-gray-300 text-xs"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`competition-document-link-${doc.id}`}
                      className="text-sm font-medium text-nuffle-bronze hover:underline"
                    >
                      {doc.title}
                    </a>
                    {doc.description ? (
                      <p className="text-xs text-gray-600">{doc.description}</p>
                    ) : null}
                    <p className="text-[11px] text-gray-500">
                      {isImageDocument(doc) ? "Image" : "PDF"} ·{" "}
                      {formatDocumentSize(doc.bytes)}
                      {doc.uploadedBy
                        ? ` · déposé par ${doc.uploadedBy.coachName}`
                        : ""}
                    </p>
                  </>
                )}
              </div>
              {canManage && editingId !== doc.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(doc)}
                    data-testid={`competition-document-edit-${doc.id}`}
                    className="px-2 py-1 rounded border border-gray-300 text-xs hover:bg-gray-50"
                  >
                    Renommer
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(doc)}
                    data-testid={`competition-document-delete-${doc.id}`}
                    className="px-2 py-1 rounded border border-red-300 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
