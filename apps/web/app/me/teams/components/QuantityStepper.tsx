"use client";

import { useEffect, useState } from "react";

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  disabledIncrement?: boolean;
  label?: string;
  decrementTestId?: string;
  incrementTestId?: string;
  valueTestId?: string;
  size?: "sm" | "md" | "lg";
  ariaLabel?: string;
  decrementAriaLabel?: string;
  incrementAriaLabel?: string;
  /**
   * Rend la valeur saisissable au clavier (champ numérique) en plus des
   * boutons ±. Utile quand `step` sert de raccourci mais ne doit pas
   * contraindre la valeur (ex. budget d'équipe : ± 50k po, mais toute
   * valeur entière reste saisissable).
   */
  editable?: boolean;
  /** Largeur du champ saisissable, en caractères. Défaut 4. */
  editableWidthCh?: number;
  valueInputTestId?: string;
}

const SIZE_CLASSES = {
  sm: {
    button: "h-9 w-9 text-base",
    value: "min-w-[2.25rem] text-sm",
  },
  md: {
    button: "h-11 w-11 text-lg",
    value: "min-w-[2.75rem] text-base",
  },
  lg: {
    button: "h-12 w-12 text-xl",
    value: "min-w-[3rem] text-lg",
  },
};

export default function QuantityStepper({
  value,
  min = 0,
  max = 99,
  step = 1,
  onChange,
  disabled = false,
  disabledIncrement = false,
  label,
  decrementTestId,
  incrementTestId,
  valueTestId,
  size = "md",
  ariaLabel,
  decrementAriaLabel,
  incrementAriaLabel,
  editable = false,
  editableWidthCh = 4,
  valueInputTestId,
}: QuantityStepperProps) {
  const classes = SIZE_CLASSES[size];
  const canDecrement = !disabled && value - step >= min;
  const canIncrement = !disabled && !disabledIncrement && value + step <= max;

  const clamp = (next: number) => Math.max(min, Math.min(max, next));

  // Saisie libre : on garde le texte tel que tapé tant qu'il n'est pas
  // exploitable (champ vide, valeur intermédiaire hors bornes comme "1"
  // quand min vaut 100). Le clamp n'a lieu qu'au blur, sinon la valeur
  // sauterait sous les doigts de l'utilisateur.
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commitDraft = (raw: string) => {
    setDraft(raw);
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    if (parsed < min || parsed > max) return;
    onChange(parsed);
  };

  const normalizeDraft = () => {
    const parsed = Number.parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? value : clamp(parsed);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const decrement = () => {
    if (!canDecrement) return;
    onChange(clamp(value - step));
  };

  const increment = () => {
    if (!canIncrement) return;
    onChange(clamp(value + step));
  };

  return (
    <div
      className="inline-flex items-center gap-0 rounded-lg border border-gray-300 bg-white overflow-hidden select-none"
      role="group"
      aria-label={ariaLabel ?? label}
    >
      <button
        type="button"
        onClick={decrement}
        disabled={!canDecrement}
        data-testid={decrementTestId}
        aria-label={decrementAriaLabel ?? label ?? "decrement"}
        className={`${classes.button} flex items-center justify-center font-semibold text-gray-700 border-r border-gray-300 transition-colors active:bg-gray-200 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset`}
      >
        −
      </button>
      {editable ? (
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          disabled={disabled}
          data-testid={valueInputTestId ?? valueTestId}
          aria-label={ariaLabel ?? label}
          onChange={(e) => commitDraft(e.target.value)}
          onBlur={normalizeDraft}
          style={{ width: `${editableWidthCh + 2}ch` }}
          className={`${classes.value} bg-transparent text-center font-semibold text-gray-900 tabular-nums px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset disabled:text-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
      ) : (
        <div
          data-testid={valueTestId}
          aria-live="polite"
          className={`${classes.value} flex items-center justify-center font-semibold text-gray-900 tabular-nums px-2`}
        >
          {value}
        </div>
      )}
      <button
        type="button"
        onClick={increment}
        disabled={!canIncrement}
        data-testid={incrementTestId}
        aria-label={incrementAriaLabel ?? label ?? "increment"}
        className={`${classes.button} flex items-center justify-center font-semibold text-gray-700 border-l border-gray-300 transition-colors active:bg-gray-200 hover:bg-gray-100 disabled:bg-gray-50 disabled:text-gray-300 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset`}
      >
        +
      </button>
    </div>
  );
}
