"use client";

import { useEffect, useRef, useState } from "react";
import TeamLogo from "../../../components/TeamLogo";
import {
  ACCEPTED_LOGO_TYPES,
  MAX_LOGO_BYTES,
  LOGO_TOO_LARGE_MESSAGE,
} from "./team-logo-client";

/**
 * Choix du logo AVANT que l'équipe existe (builder `/me/teams/new`).
 *
 * Contrairement à `TeamLogoUploader`, rien n'est envoyé ici : l'endpoint
 * serveur est `POST /team/:id/logo` et l'id n'existe qu'après la création.
 * Le fichier est donc remonté au parent, qui l'uploade une fois l'équipe
 * créée. L'aperçu utilise un object URL local, révoqué au changement et au
 * démontage pour ne pas fuiter.
 */

interface TeamLogoPickerProps {
  /** Roster sélectionné (logo de repli tant qu'aucun fichier n'est choisi). */
  roster?: string;
  teamName?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export default function TeamLogoPicker({
  roster,
  teamName,
  file,
  onChange,
  disabled = false,
}: TeamLogoPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleFile = (next: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!next) return;
    // Garde-fou client : le serveur refuse aussi (413), mais autant ne pas
    // garder 10 Mo en mémoire jusqu'à la création de l'équipe.
    if (next.size > MAX_LOGO_BYTES) {
      setError(LOGO_TOO_LARGE_MESSAGE);
      return;
    }
    setError(null);
    onChange(next);
  };

  const handleRemove = () => {
    setError(null);
    onChange(null);
  };

  return (
    <div
      data-testid="team-logo-picker"
      className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3"
    >
      <TeamLogo
        slug={roster}
        logoUrl={previewUrl}
        size={56}
        title={teamName}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900">
          Logo d&apos;équipe{" "}
          <span className="font-normal text-gray-500">(optionnel)</span>
        </div>
        <p className="text-xs text-gray-500">
          PNG, JPEG, GIF ou WEBP, 2 Mo max. Envoyé à la création de
          l&apos;équipe. Sans logo, celui de la race est utilisé — tu pourras
          le changer plus tard depuis la fiche d&apos;équipe.
        </p>
        {file ? (
          <p
            data-testid="team-logo-picker-filename"
            className="mt-1 truncate text-xs text-gray-600"
          >
            {file.name}
          </p>
        ) : null}
        {error ? (
          <p
            data-testid="team-logo-picker-error"
            className="mt-1 text-xs text-red-600"
          >
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_LOGO_TYPES}
          data-testid="team-logo-picker-input"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={disabled}
          data-testid="team-logo-picker-choose"
          onClick={() => fileRef.current?.click()}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {file ? "Remplacer" : "Choisir un logo"}
        </button>
        {file ? (
          <button
            type="button"
            disabled={disabled}
            data-testid="team-logo-picker-remove"
            onClick={handleRemove}
            className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Retirer
          </button>
        ) : null}
      </div>
    </div>
  );
}
