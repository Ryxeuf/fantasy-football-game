"use client";

/**
 * Selecteur de documents officiels utilise A LA CREATION d'une competition.
 *
 * A ce moment-la, la competition n'a pas encore d'id : on ne peut donc pas
 * appeler l'API d'upload. Les fichiers sont mis de cote ici, puis deposes par
 * la page parente juste apres la creation
 * (`uploadPendingCompetitionDocuments`).
 *
 * La validation de taille est refaite ici pour un retour immediat ; la verite
 * reste le serveur (parser `express.raw` plafonne a 10 Mo).
 */

import { useCallback, useRef } from "react";

import {
  COMPETITION_DOCUMENT_ACCEPT,
  COMPETITION_DOCUMENT_FORMATS_LABEL,
  formatDocumentSize,
  MAX_COMPETITION_DOCUMENT_BYTES,
} from "../lib/competition-documents";

interface PendingCompetitionDocumentsProps {
  readonly files: readonly File[];
  readonly onChange: (files: File[]) => void;
  readonly disabled?: boolean;
  readonly label?: string;
}

export default function PendingCompetitionDocuments({
  files,
  onChange,
  disabled = false,
  label = "Documents officiels",
}: PendingCompetitionDocumentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      // Doublon = meme nom ET meme taille : on evite d'empiler deux fois le
      // meme reglement quand l'utilisateur re-selectionne.
      const next = [...files];
      for (const file of Array.from(list)) {
        const already = next.some(
          (f) => f.name === file.name && f.size === file.size,
        );
        if (!already) next.push(file);
      }
      onChange(next);
      if (inputRef.current) inputRef.current.value = "";
    },
    [files, onChange],
  );

  const removeAt = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index));
    },
    [files, onChange],
  );

  return (
    <fieldset
      data-testid="pending-competition-documents"
      className="border border-gray-200 rounded-md p-3 space-y-2"
    >
      <legend className="text-xs font-medium text-gray-600 px-1">
        {label}
      </legend>
      <p className="text-xs text-gray-500">
        {COMPETITION_DOCUMENT_FORMATS_LABEL} — 10 Mo maximum par fichier. Vous
        pourrez en ajouter ou en retirer à tout moment après la création.
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        disabled={disabled}
        accept={COMPETITION_DOCUMENT_ACCEPT}
        data-testid="pending-competition-documents-input"
        onChange={(e) => addFiles(e.target.files)}
        className="block w-full text-sm text-gray-700 file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border-0 file:bg-nuffle-gold file:text-white file:text-sm"
      />
      {files.length > 0 ? (
        <ul
          className="space-y-1"
          data-testid="pending-competition-documents-list"
        >
          {files.map((file, index) => {
            const tooLarge = file.size > MAX_COMPETITION_DOCUMENT_BYTES;
            return (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className={tooLarge ? "text-red-600" : "text-gray-700"}>
                  {file.name}{" "}
                  <span className="text-xs text-gray-500">
                    ({formatDocumentSize(file.size)}
                    {tooLarge ? " — trop volumineux" : ""})
                  </span>
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeAt(index)}
                  data-testid={`pending-competition-document-remove-${index}`}
                  className="px-2 py-0.5 rounded border border-gray-300 text-xs hover:bg-gray-50"
                >
                  Retirer
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </fieldset>
  );
}
