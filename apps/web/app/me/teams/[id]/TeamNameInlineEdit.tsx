"use client";
import { useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../../../lib/api-client";
import { useLanguage } from "../../../contexts/LanguageContext";

// Édition inline du nom d'équipe par son coach, y compris quand l'équipe
// est ENGAGÉE (match, ligue, coupe) : c'est cosmétique, la route
// PATCH /team/:id/name ne passe pas par le verrou anti-triche du roster
// (composition et budget inchangés). C'est le pendant, au niveau équipe,
// de `PlayerIdentityInlineEdit`.

/** Borne serveur (`renameTeamSchema`) — dupliquée pour désarmer le bouton. */
const MAX_LENGTH = 100;

interface Props {
  teamId: string;
  name: string;
  /** Remonte le nom persisté pour que le titre se mette à jour sans reload. */
  onRenamed: (name: string) => void;
}

export function TeamNameInlineEdit({ teamId, name, onRenamed }: Props) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setDraft(name);
    setError(null);
    setEditing(true);
  };

  // Hors edition, le composant PORTE le titre : sinon le nom resterait
  // affiche a cote du champ de saisie pendant l'edition.
  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span>{name}</span>
        <button
          type="button"
          aria-label={t.teams.renameTeamAria.replace("{name}", name)}
          title={t.teams.renameTeam}
          data-testid="team-name-edit"
          onClick={open}
          className="text-base font-normal text-gray-400 hover:text-nuffle-bronze"
        >
          ✎
        </button>
      </span>
    );
  }

  const trimmed = draft.trim();
  const valid = trimmed.length > 0 && trimmed.length <= MAX_LENGTH;

  const save = async () => {
    if (!valid || busy) return;
    // Nom inchangé : le serveur répond 200 sans écrire, inutile d'aller
    // le déranger (ni de faire clignoter un toast).
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<{ team?: { id: string; name: string } }>(
        `/team/${teamId}/name`,
        { method: "PATCH", body: JSON.stringify({ name: trimmed }) },
      );
      // On affiche le nom RENVOYÉ par le serveur, pas le brouillon local :
      // c'est lui qui fait foi (trim serveur inclus).
      const saved = res.team?.name ?? trimmed;
      onRenamed(saved);
      toast.success(t.teams.renameTeamToast);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <input
        type="text"
        value={draft}
        disabled={busy}
        autoFocus
        aria-label={t.teams.teamName}
        data-testid="team-name-input"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void save();
          } else if (e.key === "Escape") {
            setEditing(false);
          }
        }}
        className="w-56 rounded border border-gray-300 px-2 py-0.5 text-base font-normal"
        placeholder={t.teams.teamNamePlaceholder}
      />
      <button
        type="button"
        data-testid="team-name-save"
        disabled={busy || !valid}
        onClick={save}
        className="rounded bg-nuffle-gold px-2 py-0.5 text-xs text-white disabled:opacity-50"
      >
        {t.teams.renameTeamSave}
      </button>
      <button
        type="button"
        data-testid="team-name-cancel"
        disabled={busy}
        onClick={() => setEditing(false)}
        className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600"
      >
        {t.teams.renameTeamCancel}
      </button>
      {trimmed.length > MAX_LENGTH ? (
        <span className="text-xs text-red-600">
          {t.teams.renameTeamTooLong}
        </span>
      ) : null}
      {!valid && trimmed.length === 0 ? (
        <span className="text-xs text-red-600">
          {t.teams.renameTeamTooShort}
        </span>
      ) : null}
      {error ? (
        <span data-testid="team-name-error" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </span>
  );
}
