"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

// Sprint Ligues v2 PR2 — modale de creation de saison.
// Affichee uniquement quand l'utilisateur est creator de la ligue ET
// que le flag `leagues_v2_ui` est actif (gating cote parent).
//
// La saison est creee via `POST /league/:id/seasons`. Au succes, on
// notifie le parent via `onCreated(seasonId)` pour qu'il rafraichisse
// le detail de la ligue et selectionne automatiquement la nouvelle
// saison.

interface NewSeasonModalProps {
  leagueId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (seasonId: string) => void;
}

interface CreatedSeason {
  id: string;
}

export function NewSeasonModal({
  leagueId,
  open,
  onClose,
  onCreated,
}: NewSeasonModalProps) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      setSubmitting(true);
      setError(null);
      try {
        const created = await apiRequest<CreatedSeason>(
          `/league/${leagueId}/seasons`,
          {
            method: "POST",
            body: JSON.stringify({
              name: trimmed,
              startDate: startDate || null,
              endDate: endDate || null,
            }),
          },
        );
        onCreated(created.id);
        // Reset pour la prochaine ouverture.
        setName("");
        setStartDate("");
        setEndDate("");
        onClose();
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : t.leagues.formSubmitError,
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      leagueId,
      name,
      startDate,
      endDate,
      submitting,
      onCreated,
      onClose,
      t.leagues.formSubmitError,
    ],
  );

  if (!open) return null;

  return (
    <div
      data-testid="new-season-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          {t.leagues.newSeasonTitle}
        </h2>

        {error ? (
          <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              {t.leagues.newSeasonNameLabel}
            </span>
            <input
              data-testid="new-season-name"
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t.leagues.newSeasonStartDateLabel}
              </span>
              <input
                data-testid="new-season-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                {t.leagues.newSeasonEndDateLabel}
              </span>
              <input
                data-testid="new-season-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              data-testid="new-season-submit"
              disabled={submitting || name.trim().length === 0}
              className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
            >
              {submitting
                ? t.leagues.formSubmitting
                : t.leagues.newSeasonSubmit}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              {t.leagues.formCancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
