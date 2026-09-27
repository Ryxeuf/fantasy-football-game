"use client";
import { useCallback, useState } from "react";
import { apiRequest } from "../../lib/api-client";
import {
  draftFromPrediction,
  outcomeOf,
  pairingPredictionPath,
  pickLabel,
  validatePredictionDraft,
  type PairingPredictionsView,
  type PredictionDraft,
  type PredictionPick,
} from "./predictions";

/**
 * Saisie d'un pronostic sur une rencontre OUVERTE : l'issue (obligatoire),
 * le score (facultatif, +2 pts s'il est exact). Le serveur revalide tout —
 * clôture comprise — et le parent recharge la vue après chaque écriture,
 * plutôt que de deviner l'état obtenu.
 */

interface PredictionPickerProps {
  pairing: PairingPredictionsView;
  onChanged: () => void;
}

const PICKS: readonly PredictionPick[] = ["home", "draw", "away"];

function scoreOutcome(home: string, away: string): PredictionPick | null {
  if (!/^\d+$/.test(home.trim()) || !/^\d+$/.test(away.trim())) return null;
  return outcomeOf(Number(home), Number(away));
}

export function PredictionPicker({ pairing, onChanged }: PredictionPickerProps) {
  const [draft, setDraft] = useState<PredictionDraft>(() =>
    draftFromPrediction(pairing.myPrediction),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const id = pairing.id;

  const updateScore = useCallback((side: "homeScore" | "awayScore", raw: string) => {
    setSaved(false);
    setError(null);
    setDraft((prev) => {
      const next = { ...prev, [side]: raw };
      // Un score complet dit déjà l'issue : on la coche plutôt que de
      // laisser le coach saisir une contradiction.
      const implied = scoreOutcome(next.homeScore, next.awayScore);
      return implied ? { ...next, pick: implied } : next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const checked = validatePredictionDraft(draft);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(pairingPredictionPath(id), {
        method: "PUT",
        body: JSON.stringify(checked.body),
      });
      setSaved(true);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Pronostic non enregistré");
    } finally {
      setBusy(false);
    }
  }, [draft, id, onChanged]);

  const handleDelete = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(pairingPredictionPath(id), { method: "DELETE" });
      setDraft(draftFromPrediction(null));
      setSaved(false);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Pronostic non retiré");
    } finally {
      setBusy(false);
    }
  }, [id, onChanged]);

  return (
    <div data-testid={`prediction-picker-${id}`} className="space-y-2">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Issue">
        {PICKS.map((pick) => {
          const active = draft.pick === pick;
          return (
            <button
              key={pick}
              type="button"
              data-testid={`prediction-pick-${id}-${pick}`}
              aria-pressed={active}
              disabled={busy}
              onClick={() => {
                setSaved(false);
                setError(null);
                setDraft((prev) => ({ ...prev, pick }));
              }}
              className={`px-3 py-1.5 rounded-md border text-sm ${
                active
                  ? "border-nuffle-gold bg-nuffle-gold/15 font-medium"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              }`}
            >
              {pickLabel(pick, pairing.home.name, pairing.away.name)}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-gray-500">
          Score exact (facultatif, +2 pts) :
        </span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Score ${pairing.home.name}`}
          data-testid={`prediction-score-home-${id}`}
          value={draft.homeScore}
          disabled={busy}
          onChange={(e) => updateScore("homeScore", e.target.value)}
          className="w-12 rounded-md border border-gray-300 px-2 py-1 text-center"
          placeholder="–"
        />
        <span aria-hidden>-</span>
        <input
          type="text"
          inputMode="numeric"
          aria-label={`Score ${pairing.away.name}`}
          data-testid={`prediction-score-away-${id}`}
          value={draft.awayScore}
          disabled={busy}
          onChange={(e) => updateScore("awayScore", e.target.value)}
          className="w-12 rounded-md border border-gray-300 px-2 py-1 text-center"
          placeholder="–"
        />
        <button
          type="button"
          data-testid={`prediction-save-${id}`}
          disabled={busy}
          onClick={handleSave}
          className="px-3 py-1.5 rounded-md bg-nuffle-gold text-white text-sm font-medium disabled:opacity-50"
        >
          {pairing.myPrediction ? "Modifier" : "Valider"}
        </button>
        {pairing.myPrediction ? (
          <button
            type="button"
            data-testid={`prediction-delete-${id}`}
            disabled={busy}
            onClick={handleDelete}
            className="text-sm text-gray-600 hover:text-red-700 underline disabled:opacity-50"
          >
            Retirer
          </button>
        ) : null}
      </div>
      {error ? (
        <p
          data-testid={`prediction-error-${id}`}
          role="alert"
          className="text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p data-testid={`prediction-saved-${id}`} className="text-sm text-green-700">
          Pronostic enregistré.
        </p>
      ) : null}
    </div>
  );
}
