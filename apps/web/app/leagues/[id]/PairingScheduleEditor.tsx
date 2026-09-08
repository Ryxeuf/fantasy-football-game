"use client";
import { useState } from "react";
import { apiRequest } from "../../lib/api-client";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "./pairing-status";

/**
 * Date prévisionnelle d'une rencontre : les deux coachs (ou le
 * commissaire) posent la date convenue, qui fait passer la rencontre de
 * « À jouer » à « Prévu le … ». Un petit formulaire inline, pas de modale :
 * on planifie depuis la journée, sans quitter le calendrier.
 *
 * `PATCH /leagues/pairings/:id/schedule` — `null` retire la date.
 */
interface PairingScheduleEditorProps {
  pairingId: string;
  scheduledAt: string | null;
  /** Rappelé après une écriture réussie (rechargement de la saison). */
  onChanged: () => void;
}

export function PairingScheduleEditor({
  pairingId,
  scheduledAt,
  onChanged,
}: PairingScheduleEditorProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => toDateTimeLocalValue(scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (next: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/leagues/pairings/${pairingId}/schedule`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt: next }),
      });
      setOpen(false);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.leagues.pairingScheduleError);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        data-testid={`pairing-schedule-open-${pairingId}`}
        onClick={() => {
          setValue(toDateTimeLocalValue(scheduledAt));
          setOpen(true);
        }}
        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
        title={t.leagues.pairingScheduleLabel}
      >
        📅 {scheduledAt ? t.leagues.pairingScheduleEdit : t.leagues.pairingScheduleButton}
      </button>
    );
  }

  return (
    <form
      data-testid={`pairing-schedule-form-${pairingId}`}
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const iso = fromDateTimeLocalValue(value);
        if (!iso) {
          setError(t.leagues.pairingScheduleInvalid);
          return;
        }
        void submit(iso);
      }}
    >
      <label className="sr-only" htmlFor={`pairing-schedule-${pairingId}`}>
        {t.leagues.pairingScheduleLabel}
      </label>
      <input
        id={`pairing-schedule-${pairingId}`}
        data-testid={`pairing-schedule-input-${pairingId}`}
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="text-xs px-2 py-1 rounded border border-gray-300 bg-white"
      />
      <button
        type="submit"
        data-testid={`pairing-schedule-save-${pairingId}`}
        disabled={busy}
        className="text-xs px-2 py-1 rounded bg-nuffle-gold text-white font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
      >
        {t.leagues.pairingScheduleSave}
      </button>
      {scheduledAt ? (
        <button
          type="button"
          data-testid={`pairing-schedule-clear-${pairingId}`}
          disabled={busy}
          onClick={() => void submit(null)}
          className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {t.leagues.pairingScheduleClear}
        </button>
      ) : null}
      <button
        type="button"
        data-testid={`pairing-schedule-cancel-${pairingId}`}
        disabled={busy}
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className="text-xs px-2 py-1 rounded text-gray-600 hover:bg-gray-100"
      >
        {t.leagues.pairingScheduleCancel}
      </button>
      {error ? (
        <span
          data-testid={`pairing-schedule-error-${pairingId}`}
          className="text-xs text-red-600 basis-full"
        >
          {error}
        </span>
      ) : null}
    </form>
  );
}
