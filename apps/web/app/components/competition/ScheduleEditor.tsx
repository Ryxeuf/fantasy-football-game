"use client";
import { useState } from "react";
import { apiRequest } from "../../lib/api-client";
import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from "../../leagues/[id]/pairing-status";

/**
 * Éditeur inline de date prévisionnelle, commun aux rencontres de ligue
 * et de coupe : un bouton « Planifier », puis un `datetime-local` avec
 * Enregistrer / Retirer / Annuler. `PATCH endpoint` avec
 * `{ scheduledAt: ISO | null }`. Les libellés sont fournis par l'appelant
 * (pas d'i18n ici), les `data-testid` suivent `${testIdBase}-<action>-<id>`.
 */
export interface ScheduleEditorLabels {
  readonly label: string;
  readonly open: string;
  readonly edit: string;
  readonly save: string;
  readonly clear: string;
  readonly cancel: string;
  readonly invalid: string;
  readonly error: string;
}

interface ScheduleEditorProps {
  readonly id: string;
  readonly endpoint: string;
  readonly scheduledAt: string | null;
  readonly labels: ScheduleEditorLabels;
  readonly testIdBase?: string;
  /** Rappelé après une écriture réussie (rechargement des données). */
  readonly onChanged: () => void;
}

export default function ScheduleEditor({
  id,
  endpoint,
  scheduledAt,
  labels,
  testIdBase = "schedule",
  onChanged,
}: ScheduleEditorProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(() => toDateTimeLocalValue(scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (next: string | null) => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt: next }),
      });
      setOpen(false);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : labels.error);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        data-testid={`${testIdBase}-open-${id}`}
        onClick={() => {
          setValue(toDateTimeLocalValue(scheduledAt));
          setOpen(true);
        }}
        className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
        title={labels.label}
      >
        📅 {scheduledAt ? labels.edit : labels.open}
      </button>
    );
  }

  return (
    <form
      data-testid={`${testIdBase}-form-${id}`}
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const iso = fromDateTimeLocalValue(value);
        if (!iso) {
          setError(labels.invalid);
          return;
        }
        void submit(iso);
      }}
    >
      <label className="sr-only" htmlFor={`${testIdBase}-${id}`}>
        {labels.label}
      </label>
      <input
        id={`${testIdBase}-${id}`}
        data-testid={`${testIdBase}-input-${id}`}
        type="datetime-local"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="text-xs px-2 py-1 rounded border border-gray-300 bg-white"
      />
      <button
        type="submit"
        data-testid={`${testIdBase}-save-${id}`}
        disabled={busy}
        className="text-xs px-2 py-1 rounded bg-nuffle-gold text-white font-medium hover:bg-nuffle-gold/90 disabled:opacity-50"
      >
        {labels.save}
      </button>
      {scheduledAt ? (
        <button
          type="button"
          data-testid={`${testIdBase}-clear-${id}`}
          disabled={busy}
          onClick={() => void submit(null)}
          className="text-xs px-2 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {labels.clear}
        </button>
      ) : null}
      <button
        type="button"
        data-testid={`${testIdBase}-cancel-${id}`}
        disabled={busy}
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className="text-xs px-2 py-1 rounded text-gray-600 hover:bg-gray-100"
      >
        {labels.cancel}
      </button>
      {error ? (
        <span
          data-testid={`${testIdBase}-error-${id}`}
          className="text-xs text-red-600 basis-full"
        >
          {error}
        </span>
      ) : null}
    </form>
  );
}
