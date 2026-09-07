"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../lib/api-client";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Panneau « Gestion de la compétition » du commissaire (ou d'un admin) :
 * archiver et supprimer une ligue ou une coupe.
 *
 * Partagé par `/leagues/[id]` et `/cups/[id]` : même règle, même rendu.
 * - Archiver : confirmation simple ; la compétition passe en lecture seule
 *   (statut déjà lu par les listes et pages d'archives).
 * - Supprimer : définitif (cascade côté serveur) → confirmation par SAISIE
 *   DU NOM EXACT, bouton inactif tant qu'il ne correspond pas.
 *
 * Les routes serveur (`POST /leagues/:id/archive`, `DELETE /leagues/:id`,
 * `POST /cup/:id/archive`, `DELETE /cup/:id`) re-vérifient l'autorisation :
 * `canManage` ne fait que masquer le panneau aux autres coachs.
 */

export type LifecycleCompetitionKind = "league" | "cup";

interface CompetitionLifecyclePanelProps {
  kind: LifecycleCompetitionKind;
  competitionId: string;
  name: string;
  /** Vrai si déjà archivée : le bloc d'archivage devient une notice. */
  archived: boolean;
  /** Commissaire (créateur) ou admin. Sinon le panneau n'est pas rendu. */
  canManage: boolean;
  onArchived?: () => void;
  onDeleted?: () => void;
}

/** Préfixe API : `/leagues` côté ligue, `/cup` (singulier) côté coupe. */
export function lifecycleApiBase(
  kind: LifecycleCompetitionKind,
  competitionId: string,
): string {
  return kind === "league"
    ? `/leagues/${competitionId}`
    : `/cup/${competitionId}`;
}

/** Normalisation de la saisie de confirmation (espaces, casse). */
export function nameMatches(input: string, expected: string): boolean {
  return input.trim().toLowerCase() === expected.trim().toLowerCase();
}

export default function CompetitionLifecyclePanel({
  kind,
  competitionId,
  name,
  archived,
  canManage,
  onArchived,
  onDeleted,
}: CompetitionLifecyclePanelProps) {
  const { t } = useLanguage();
  const [confirmName, setConfirmName] = useState("");
  const [busy, setBusy] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labels = useMemo(() => {
    const l = t.competitionLifecycle;
    return {
      archiveHint: kind === "league" ? l.archiveHintLeague : l.archiveHintCup,
      archiveButton:
        kind === "league" ? l.archiveButtonLeague : l.archiveButtonCup,
      deleteHint: kind === "league" ? l.deleteHintLeague : l.deleteHintCup,
      deleteButton:
        kind === "league" ? l.deleteButtonLeague : l.deleteButtonCup,
    };
  }, [kind, t]);

  if (!canManage) return null;

  const base = lifecycleApiBase(kind, competitionId);
  const deleteReady = nameMatches(confirmName, name);

  async function archive() {
    const confirmed = window.confirm(
      t.competitionLifecycle.archiveConfirm.replace("{name}", name),
    );
    if (!confirmed) return;
    try {
      setBusy("archive");
      setError(null);
      await apiRequest(`${base}/archive`, { method: "POST" });
      toast.success(t.competitionLifecycle.archiveSuccess.replace("{name}", name));
      onArchived?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.competitionLifecycle.error);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!deleteReady) return;
    try {
      setBusy("delete");
      setError(null);
      await apiRequest(base, { method: "DELETE" });
      toast.success(t.competitionLifecycle.deleteSuccess.replace("{name}", name));
      onDeleted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.competitionLifecycle.error);
      setBusy(null);
    }
  }

  return (
    <section
      data-testid="competition-lifecycle-panel"
      className="rounded-lg border border-red-200 bg-white p-4 space-y-4"
    >
      <h2 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
        ⚠️ {t.competitionLifecycle.title}
      </h2>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium text-gray-900">
            📦 {t.competitionLifecycle.archiveTitle}
          </p>
          <p className="text-sm text-gray-600">
            {archived
              ? t.competitionLifecycle.archivedNotice
              : labels.archiveHint}
          </p>
        </div>
        {!archived ? (
          <button
            type="button"
            data-testid="lifecycle-archive-button"
            onClick={() => void archive()}
            disabled={busy !== null}
            className="shrink-0 px-3 py-1.5 rounded-md bg-white border border-nuffle-gold text-nuffle-bronze text-sm font-medium hover:bg-nuffle-gold/10 disabled:opacity-60"
          >
            {busy === "archive"
              ? t.competitionLifecycle.working
              : labels.archiveButton}
          </button>
        ) : null}
      </div>

      <div className="border-t border-red-100 pt-4 space-y-2">
        <p className="font-medium text-gray-900">
          🗑️ {t.competitionLifecycle.deleteTitle}
        </p>
        <p className="text-sm text-gray-600">{labels.deleteHint}</p>
        <label className="block text-xs text-gray-500">
          {t.competitionLifecycle.deleteTypeName.replace("{name}", name)}
          <input
            type="text"
            data-testid="lifecycle-delete-confirm-input"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={t.competitionLifecycle.deleteInputPlaceholder}
            autoComplete="off"
            className="mt-1 block w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-red-400 focus:outline-none"
          />
        </label>
        <button
          type="button"
          data-testid="lifecycle-delete-button"
          onClick={() => void remove()}
          disabled={!deleteReady || busy !== null}
          className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "delete"
            ? t.competitionLifecycle.working
            : labels.deleteButton}
        </button>
      </div>

      {error ? (
        <p
          data-testid="lifecycle-error"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
