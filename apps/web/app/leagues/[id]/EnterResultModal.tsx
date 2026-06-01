"use client";
import { useCallback, useState, type FormEvent } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";

// Workstream ligue offline (Phase 1b) — saisie manuelle d'un resultat de
// match joue hors-ligne. Reservee au createur de la ligue (le bouton qui
// ouvre cette modale n'est rendu que dans ce cas). POST le score + les
// casualties par equipe puis declenche un refresh via `onRecorded`.

interface EnterResultModalProps {
  pairingId: string;
  homeName: string;
  awayName: string;
  onClose: () => void;
  onRecorded: () => void;
}

/** Normalise une saisie en entier [0, 30]. */
function clampScore(raw: string): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 30);
}

export function EnterResultModal({
  pairingId,
  homeName,
  awayName,
  onClose,
  onRecorded,
}: EnterResultModalProps) {
  const { t } = useLanguage();
  const [scoreHome, setScoreHome] = useState(0);
  const [scoreAway, setScoreAway] = useState(0);
  const [casualtiesHome, setCasualtiesHome] = useState(0);
  const [casualtiesAway, setCasualtiesAway] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      setError(null);
      try {
        await apiRequest(`/leagues/pairings/${pairingId}/result`, {
          method: "POST",
          body: JSON.stringify({
            scoreHome,
            scoreAway,
            casualtiesHome,
            casualtiesAway,
          }),
        });
        onRecorded();
        onClose();
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : t.leagues.recordResultError,
        );
        setSubmitting(false);
      }
    },
    [
      submitting,
      pairingId,
      scoreHome,
      scoreAway,
      casualtiesHome,
      casualtiesAway,
      onRecorded,
      onClose,
      t.leagues.recordResultError,
    ],
  );

  return (
    <div
      data-testid="enter-result-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg max-w-md w-full p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          {t.leagues.recordResultTitle}
        </h2>
        <p className="text-sm text-gray-600">
          {homeName} <span className="text-gray-400">vs</span> {awayName}
        </p>

        {error ? (
          <div
            data-testid="enter-result-error"
            className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <ResultRow
            label={t.leagues.recordResultTouchdowns}
            homeLabel={homeName}
            awayLabel={awayName}
            testid="td"
            home={scoreHome}
            away={scoreAway}
            setHome={setScoreHome}
            setAway={setScoreAway}
          />
          <ResultRow
            label={t.leagues.recordResultCasualties}
            homeLabel={homeName}
            awayLabel={awayName}
            testid="cas"
            home={casualtiesHome}
            away={casualtiesAway}
            setHome={setCasualtiesHome}
            setAway={setCasualtiesAway}
          />
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm"
            >
              {t.leagues.recordResultCancel}
            </button>
            <button
              type="submit"
              data-testid="enter-result-submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
            >
              {t.leagues.recordResultSave}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ResultRowProps {
  label: string;
  homeLabel: string;
  awayLabel: string;
  testid: string;
  home: number;
  away: number;
  setHome: (n: number) => void;
  setAway: (n: number) => void;
}

function ResultRow({
  label,
  homeLabel,
  awayLabel,
  testid,
  home,
  away,
  setHome,
  setAway,
}: ResultRowProps) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-gray-500 truncate block">
            {homeLabel}
          </span>
          <input
            type="number"
            min={0}
            max={30}
            data-testid={`result-${testid}-home`}
            value={home}
            onChange={(e) => setHome(clampScore(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 truncate block">
            {awayLabel}
          </span>
          <input
            type="number"
            min={0}
            max={30}
            data-testid={`result-${testid}-away`}
            value={away}
            onChange={(e) => setAway(clampScore(e.target.value))}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
