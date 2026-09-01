"use client";

/**
 * Panneau « Édition avancée » de la fiche d'édition d'équipe : budget d'or et
 * pool de PSP de construction, comme au builder.
 *
 * Le builder proposait ce mode à la création seulement. Une fois l'équipe
 * créée, budget et pool étaient figés et les compétences achetées
 * définitives : un coach qui s'était trompé devait tout recréer.
 *
 * Deux règles gouvernent le panneau, et elles ne se confondent pas :
 *
 *  - **Le repli.** L'interrupteur replie VRAIMENT le corps du panneau. Il ne
 *    faisait rien tant qu'un pool existait (`state.pool > 0` rouvrait le
 *    corps quoi qu'on clique) : le coach basculait l'interrupteur et voyait
 *    l'écran inchangé.
 *  - **Le verrouillage.** Une coupe ou un règlement de tournoi PUBLIE budget
 *    et pool (`TournamentRosterRules.goldBudget` / `sppBudget`) : ils
 *    s'affichent alors en lecture seule, sans interrupteur — les proposer
 *    réglables revenait à s'offrir des PSP hors barème d'un tournoi officiel.
 */

import { useState } from "react";
import { toast } from "sonner";
import {
  lockSourceLabel,
  MAX_INITIAL_BUDGET_K,
  MAX_STARTING_PSP_POOL,
  MIN_INITIAL_BUDGET_K,
  saveInitialBudget,
  savePspPool,
  type BuildSettingLock,
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
  // coach à re-cocher pour retrouver ce qu'il a déjà alloué. Il peut en
  // revanche le replier — c'est tout l'objet de l'interrupteur.
  const [advanced, setAdvanced] = useState(state.pool > 0);

  // Le budget suit `budgetLocked` s'il est servi ; à défaut (serveur
  // antérieur) on retombe sur la serrure du pool, qui a la même source.
  const budgetLocked = state.budgetLocked ?? state.locked;
  const budgetLockedBy: BuildSettingLock =
    state.budgetLockedBy ?? state.lockedBy ?? (state.locked ? "cup" : null);
  const poolLockedBy: BuildSettingLock =
    state.lockedBy ?? (state.locked ? "cup" : null);
  // Un serveur antérieur ne sert pas `initialBudget` : plutôt que d'afficher
  // un champ vide, on n'affiche pas la ligne du tout.
  const hasBudget = typeof state.initialBudget === "number";

  // Rien n'est réglable quand tout est imposé : l'interrupteur n'aurait plus
  // qu'à masquer des chiffres que le coach vient justement lire.
  const anythingEditable = !state.locked || (hasBudget && !budgetLocked);
  const expanded = advanced || !anythingEditable;

  return (
    <div
      data-testid="psp-pool-panel"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
    >
      {anythingEditable && (
        <label
          htmlFor="edit-advanced-toggle"
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3 transition-colors hover:bg-amber-50"
        >
          <div className="min-w-0">
            <div className="font-medium text-gray-900">Édition avancée</div>
            <div className="text-xs text-gray-600">
              Budget d&apos;or et pool de PSP à dépenser en compétences et
              recrutement de Star Players, comme à la création.
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
            disabled={disabled}
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

      {expanded && (
        <div className="mt-3 space-y-3">
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

          {hasBudget && (
            <SettingRow
              label="Budget d'or :"
              unit="k po"
              current={state.initialBudget as number}
              min={MIN_INITIAL_BUDGET_K}
              max={MAX_INITIAL_BUDGET_K}
              locked={budgetLocked}
              lockedBy={budgetLockedBy}
              lockedNoun="Le budget d'or"
              disabled={disabled}
              inputTestId="initial-budget-input"
              saveTestId="initial-budget-save"
              lockedTestId="initial-budget-locked"
              errorTestId="initial-budget-error"
              onSave={(value) => saveInitialBudget(teamId, value)}
              onSaved={(next) => {
                onChange(next);
                toast.success(`Budget réglé à ${next.initialBudget ?? 0}k po`);
              }}
            />
          )}

          <SettingRow
            label="Pool de PSP :"
            current={state.pool}
            min={0}
            max={MAX_STARTING_PSP_POOL}
            locked={state.locked}
            lockedBy={poolLockedBy}
            lockedNoun="Le pool de PSP"
            disabled={disabled}
            hint={
              state.spent > 0 ? `Minimum ${state.spent} (PSP déjà dépensés)` : null
            }
            inputTestId="psp-pool-input"
            saveTestId="psp-pool-save"
            lockedTestId="psp-pool-locked"
            errorTestId="psp-pool-error"
            onSave={(value) => savePspPool(teamId, value)}
            onSaved={(next) => {
              onChange(next);
              toast.success(`Pool de PSP réglé à ${next.pool}`);
            }}
          />

          {tournamentLabel && (
            <p
              data-testid="psp-pool-tournament"
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900"
            >
              📜 Règlement « {tournamentLabel} » : son barème PSP et ses
              restrictions s&apos;appliquent aux compétences achetées sur le
              pool.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface SettingRowProps {
  readonly label: string;
  readonly unit?: string;
  readonly current: number;
  readonly min: number;
  readonly max: number;
  readonly locked: boolean;
  readonly lockedBy: BuildSettingLock;
  /** Sujet de la phrase de verrouillage (« Le budget d'or … est imposé … »). */
  readonly lockedNoun: string;
  readonly hint?: string | null;
  readonly disabled: boolean;
  readonly inputTestId: string;
  readonly saveTestId: string;
  readonly lockedTestId: string;
  readonly errorTestId: string;
  readonly onSave: (value: number) => Promise<TeamPspPoolState>;
  readonly onSaved: (next: TeamPspPoolState) => void;
}

/**
 * Une valeur de construction : soit un champ + « Appliquer », soit un encart
 * 🔒 qui dit QUI l'impose. Les deux valeurs partagent ce composant pour ne pas
 * diverger — c'est exactement la divergence budget/pool qu'on corrige.
 */
function SettingRow({
  label,
  unit,
  current,
  min,
  max,
  locked,
  lockedBy,
  lockedNoun,
  hint,
  disabled,
  inputTestId,
  saveTestId,
  lockedTestId,
  errorTestId,
  onSave,
  onSaved,
}: SettingRowProps) {
  const [draft, setDraft] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (locked) {
    return (
      <p data-testid={lockedTestId} className="text-xs text-amber-900">
        🔒 {lockedNoun} de cette équipe est imposé par{" "}
        {lockSourceLabel(lockedBy)} : {current}
        {unit ?? " PSP"}.
      </p>
    );
  }

  const parsed = Number.parseInt(draft, 10);
  const draftValid = Number.isInteger(parsed) && parsed >= min && parsed <= max;
  const dirty = draftValid && parsed !== current;

  async function submit(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      onSaved(await onSave(parsed));
      setDraft(String(parsed));
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : "Échec de la mise à jour";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputTestId} className="text-sm text-gray-700">
          {label}
        </label>
        <input
          id={inputTestId}
          data-testid={inputTestId}
          type="number"
          min={min}
          max={max}
          value={draft}
          disabled={disabled || saving}
          onChange={(e) => setDraft(e.target.value)}
          className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm"
        />
        {unit && <span className="text-sm text-gray-600">{unit}</span>}
        <button
          type="button"
          data-testid={saveTestId}
          disabled={disabled || saving || !dirty}
          onClick={() => void submit()}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Appliquer"}
        </button>
        {hint && <span className="text-xs text-gray-600">{hint}</span>}
      </div>
      {error && (
        <p
          data-testid={errorTestId}
          className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
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
