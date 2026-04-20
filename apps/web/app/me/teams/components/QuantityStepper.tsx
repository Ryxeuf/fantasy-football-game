"use client";

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
}: QuantityStepperProps) {
  const classes = SIZE_CLASSES[size];
  const canDecrement = !disabled && value - step >= min;
  const canIncrement = !disabled && !disabledIncrement && value + step <= max;

  const clamp = (next: number) => Math.max(min, Math.min(max, next));

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
      <div
        data-testid={valueTestId}
        aria-live="polite"
        className={`${classes.value} flex items-center justify-center font-semibold text-gray-900 tabular-nums px-2`}
      >
        {value}
      </div>
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
