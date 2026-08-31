"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";

/**
 * Fluff d'équipe : le coach raconte sa bande.
 *
 * Le texte n'est pas décoratif : c'est lui qui remplace la description
 * générique du site dans l'aperçu d'un lien partagé (`/r/:token`,
 * `/me/teams/:id`). Le libellé d'aide le dit, sinon personne ne devine
 * pourquoi ce champ existe.
 *
 * Volontairement PAS soumis au verrou d'édition du roster (`canEdit`) :
 * la description est cosmétique, comme le nom — une équipe engagée en
 * ligue reste descriptible (cf. `services/team-description.ts`).
 */

/** Borne serveur (`updateTeamDescriptionSchema`) — dupliquée pour l'UI. */
export const TEAM_DESCRIPTION_MAX_LENGTH = 1000;

interface TeamDescriptionEditorProps {
  teamId: string;
  initialDescription?: string | null;
  /** Remonte la valeur persistée pour rafraîchir la fiche sans reload. */
  onSaved?: (description: string | null) => void;
}

export default function TeamDescriptionEditor({
  teamId,
  initialDescription = null,
  onSaved,
}: TeamDescriptionEditorProps) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState<string>(initialDescription ?? "");
  const [draft, setDraft] = useState<string>(initialDescription ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const tooLong = trimmed.length > TEAM_DESCRIPTION_MAX_LENGTH;
  // Comparaison sur la valeur TRIMÉE : ajouter puis retirer une espace ne
  // doit pas activer le bouton (le serveur ne réécrirait rien de toute
  // façon, autant ne pas le déranger).
  const dirty = trimmed !== saved.trim();

  const counter = t.teams.teamDescriptionCounter
    .replace("{count}", String(trimmed.length))
    .replace("{max}", String(TEAM_DESCRIPTION_MAX_LENGTH));

  const save = async () => {
    if (busy || tooLong || !dirty) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{
        team?: { id: string; description: string | null };
      }>(`/team/${teamId}/description`, {
        method: "PATCH",
        // Chaîne vide => `null` côté serveur : « effacer » et « ne rien
        // écrire » ne sont pas deux gestes différents pour le coach.
        body: JSON.stringify({ description: trimmed.length ? trimmed : null }),
      });
      // On affiche la valeur RENVOYÉE par le serveur, pas le brouillon
      // local : c'est elle qui fait foi (trim serveur inclus).
      const persisted = res.team?.description ?? null;
      setSaved(persisted ?? "");
      setDraft(persisted ?? "");
      onSaved?.(persisted);
      toast.success(t.teams.teamDescriptionSaved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="team-description-editor"
      className="bg-white rounded-lg border overflow-hidden"
    >
      <div className="bg-gray-50 px-6 py-3 border-b">
        <h3 className="text-lg font-semibold">{t.teams.teamDescription}</h3>
        <p className="text-sm text-gray-600 mt-1">
          {t.teams.teamDescriptionHelp}
        </p>
      </div>

      <div className="p-6 space-y-3">
        <textarea
          value={draft}
          rows={5}
          disabled={busy}
          aria-label={t.teams.teamDescription}
          data-testid="team-description-input"
          placeholder={t.teams.teamDescriptionPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span
            data-testid="team-description-counter"
            className={`text-xs tabular-nums ${tooLong ? "text-red-600" : "text-gray-500"}`}
          >
            {counter}
          </span>
          <button
            type="button"
            onClick={save}
            disabled={busy || tooLong || !dirty}
            data-testid="team-description-save"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {busy ? t.teams.teamDescriptionSaving : t.teams.teamDescriptionSave}
          </button>
        </div>

        {tooLong ? (
          <p
            data-testid="team-description-too-long"
            className="text-xs text-red-600"
          >
            {t.teams.teamDescriptionTooLong.replace(
              "{max}",
              String(TEAM_DESCRIPTION_MAX_LENGTH),
            )}
          </p>
        ) : null}

        {error ? (
          <p data-testid="team-description-error" className="text-xs text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
