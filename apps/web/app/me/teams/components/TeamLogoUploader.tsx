"use client";

import { useRef, useState } from "react";
import TeamLogo from "../../../components/TeamLogo";
import {
  ACCEPTED_LOGO_TYPES,
  MAX_LOGO_BYTES,
  LOGO_TOO_LARGE_MESSAGE,
  uploadTeamLogo,
  deleteTeamLogo,
} from "./team-logo-client";

/**
 * Logo d'équipe : aperçu + upload + retrait, depuis la fiche d'équipe.
 *
 * Le coach envoie une image (PNG/JPEG/GIF/WEBP, 2 Mo max) qui remplace le
 * logo programmatique dérivé du roster. Le transport est mutualisé dans
 * `team-logo-client` avec le builder (`TeamLogoPicker`, upload différé).
 */

interface TeamLogoUploaderProps {
  teamId: string;
  /** Roster de l'équipe (logo de repli quand aucun logo n'est uploadé). */
  roster?: string;
  teamName?: string;
  initialLogoUrl?: string | null;
  /** Notifie le parent pour rafraîchir les autres affichages du logo. */
  onChange?: (logoUrl: string | null) => void;
}

export default function TeamLogoUploader({
  teamId,
  roster,
  teamName,
  initialLogoUrl = null,
  onChange,
}: TeamLogoUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = (next: string | null) => {
    setLogoUrl(next);
    onChange?.(next);
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Garde-fou client : le serveur refuse aussi (413), mais autant ne pas
    // téléverser 10 Mo pour rien.
    if (file.size > MAX_LOGO_BYTES) {
      setError(LOGO_TOO_LARGE_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      apply(await uploadTeamLogo(teamId, file));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi du logo");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setError(null);
    setBusy(true);
    try {
      await deleteTeamLogo(teamId);
      apply(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Échec du retrait du logo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="team-logo-uploader"
      className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3"
    >
      <TeamLogo
        slug={roster}
        logoUrl={logoUrl}
        size={56}
        title={teamName}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-gray-900">Logo d&apos;équipe</div>
        <p className="text-xs text-gray-500">
          PNG, JPEG, GIF ou WEBP, 2 Mo max. Affiché devant le nom de
          l&apos;équipe dans les matchs, le classement et la feuille de match.
          Sans logo, celui de la race est utilisé.
        </p>
        {error ? (
          <p data-testid="team-logo-error" className="mt-1 text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_LOGO_TYPES}
          data-testid="team-logo-input"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={busy}
          data-testid="team-logo-upload"
          onClick={() => fileRef.current?.click()}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {busy ? "Envoi…" : logoUrl ? "Remplacer" : "Choisir un logo"}
        </button>
        {logoUrl ? (
          <button
            type="button"
            disabled={busy}
            data-testid="team-logo-remove"
            onClick={() => void handleRemove()}
            className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Retirer
          </button>
        ) : null}
      </div>
    </div>
  );
}
