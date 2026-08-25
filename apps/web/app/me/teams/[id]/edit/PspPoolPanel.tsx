"use client";

/**
 * Panneau « Édition avancée » de la fiche d'édition d'équipe : réglage du
 * pool de PSP de construction, comme au builder.
 *
 * Le builder proposait ce mode à la création seulement. Une fois l'équipe
 * créée, le pool était figé et les compétences achetées définitives : un
 * coach qui s'était trompé devait tout recréer. Le panneau n'apparaît que
 * pour une équipe LIBRE (la page d'édition redirige les autres) et se
 * verrouille quand une coupe impose le pool.
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  MAX_STARTING_PSP_POOL,
  savePspPool,
  type TeamPspPoolState,
} from "./psp-pool-client";

interface PspPoolPanelProps {
  readonly teamId: string;
  readonly state: TeamPspPoolState;
  readonly onChange: (next: TeamPspPoolState) => void;
  /** Libellé du règlement de tournoi de l'équipe, s'il y en a un. */
  readonly tournamentLabel?: string | null;
  readonly disabled?: boolean;
}

export default function PspPoolPanel({
  teamId,
  state,
  onChange,
  tournamentLabel,
  disabled = false,
}: PspPoolPanelProps) {
  // Le mode est déjà « avancé » dès qu'un pool existe : on n'oblige pas le
  // coach à re-cocher pour retrouver ce qu'il a déjà alloué.
  const [advanced, setAdvanced] = useState(state.pool > 0);
  const [draft, setDraft] = useState(String(state.pool));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number.parseInt(draft, 10);
  const draftValid =
    Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_STARTING_PSP_POOL;
  const dirty = draftValid && parsed !== state.pool;

  async function submit(value: number) {
    setSaving(true);
    setError(null);
    try {
      const next = await savePspPool(teamId, value);
      onChange(next);
      setDraft(String(next.pool));
      toast.success(`Pool de PSP réglé à ${next.pool}`);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Échec de la mise à jour du pool";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      data-testid="psp-pool-panel"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
    >
      {!state.locked && (
        <label
          htmlFor="edit-advanced-toggle"
          className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3 transition-colors hover:bg-amber-50"
        >
          <div className="min-w-0">
            <div className="font-medium text-gray-900">Édition avancée</div>
            <div className="text-xs text-gray-600">
              Pool de PSP à dépenser en compétences et recrutement de Star
              Players, comme à la création.
            </div>
          </div>
          <input
            id="edit-advanced-toggle"
            data-testid="edit-advanced-toggle"
            type="checkbox"
            role="switch"
            aria-checked={advanced}
            aria-label="Édition avancée"
            className="sr-only peer"
            checked={advanced}
            disabled={disabled || saving}
            onChange={(e) => setAdvanced(e.target.checked)}
          />
          <span
            aria-hidden="true"
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 peer-focus-visible:ring-offset-2 ${
              advanced ? "bg-amber-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                advanced ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </span>
        </label>
      )}

      {(advanced || state.locked || state.pool > 0) && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Metric label="Pool" value={state.pool} testId="psp-pool-total" />
            <Metric
              label="Dépensés"
              value={state.spent}
              testId="psp-pool-spent"
            />
            <Metric
              label="Disponibles"
              value={state.remaining}
              testId="psp-pool-remaining"
            />
          </div>

          {state.locked ? (
            <p
              data-testid="psp-pool-locked"
              className="mt-3 text-xs text-amber-900"
            >
              🔒 Le pool de PSP de cette équipe est imposé par sa coupe.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="psp-pool-input" className="text-sm text-gray-700">
                Pool de PSP :
              </label>
              <input
                id="psp-pool-input"
                data-testid="psp-pool-input"
                type="number"
                min={0}
                max={MAX_STARTING_PSP_POOL}
                value={draft}
                disabled={disabled || saving}
                onChange={(e) => setDraft(e.target.value)}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                data-testid="psp-pool-save"
                disabled={disabled || saving || !dirty}
                onClick={() => submit(parsed)}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Appliquer"}
              </button>
              {state.spent > 0 && (
                <span className="text-xs text-gray-600">
                  Minimum {state.spent} (PSP déjà dépensés)
                </span>
              )}
            </div>
          )}

          {tournamentLabel && (
            <p
              data-testid="psp-pool-tournament"
              className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900"
            >
              📜 Règlement « {tournamentLabel} » : son barème PSP et ses
              restrictions s&apos;appliquent aux compétences achetées sur le
              pool.
            </p>
          )}

          {error && (
            <p
              data-testid="psp-pool-error"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  testId,
}: {
  label: string;
  value: number;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white p-2 text-center sm:p-3">
      <div className="text-xs font-medium text-amber-700">{label}</div>
      <div
        className="font-mono text-xl font-bold text-amber-900"
        data-testid={testId}
      >
        {value}
      </div>
    </div>
  );
}
