"use client";

/**
 * Régime des coups de pouce d'une coupe (création) : trois choix, `build`
 * imposé et grisé sous règlement de tournoi, absent en Sept ; et la liste
 * autorisée, quand la coupe n'a pas de règlement.
 */

import { AllowedInducementsField } from "../components/AllowedInducementsField";
import {
  CUP_INDUCEMENT_MODE_COPY,
  cupInducementModeChoices,
  showsAllowedInducements,
  type CupInducementMode,
  type CupInducementModeContext,
} from "./inducement-mode";

export interface CupInducementModeFieldProps {
  readonly value: CupInducementMode;
  readonly onChange: (mode: CupInducementMode) => void;
  readonly allowed: readonly string[];
  readonly onAllowedChange: (next: string[]) => void;
  readonly context: CupInducementModeContext;
  /** Nom court du règlement imposé, pour le dire. */
  readonly rulesetLabel?: string | null;
  readonly disabled?: boolean;
}

export function CupInducementModeField({
  value,
  onChange,
  allowed,
  onAllowedChange,
  context,
  rulesetLabel,
  disabled = false,
}: CupInducementModeFieldProps) {
  const { modes, locked } = cupInducementModeChoices(context);
  return (
    <div className="space-y-3" data-testid="cup-inducement-mode-field">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-gray-800">
          Coups de pouce
        </legend>
        {locked ? (
          <p className="text-xs text-amber-800" data-testid="cup-inducement-mode-locked">
            Imposé par le règlement{rulesetLabel ? ` ${rulesetLabel}` : ""} :
            achat à la création, liste fermée et prix du règlement.
          </p>
        ) : null}
        {modes.map((mode) => (
          <label
            key={mode}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-2 text-sm"
          >
            <input
              type="radio"
              name="cupInducementMode"
              value={mode}
              checked={value === mode}
              onChange={() => onChange(mode)}
              disabled={disabled || locked}
              data-testid={`cup-inducement-mode-${mode}`}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-gray-900">
                {CUP_INDUCEMENT_MODE_COPY[mode].title}
              </span>
              <span className="block text-xs text-gray-600">
                {CUP_INDUCEMENT_MODE_COPY[mode].description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {showsAllowedInducements(value, context) ? (
        <AllowedInducementsField
          testId="cup-allowed-inducements"
          value={allowed}
          onChange={onAllowedChange}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}
