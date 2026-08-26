"use client";

/**
 * Primitives de champ de l'éditeur de règlement.
 *
 * Toutes prennent le `path` du champ dans la définition (ex.
 * `rosterRules.orc.goldBudget`) et lisent l'erreur correspondante dans la
 * carte d'erreurs renvoyée par le serveur : le message s'affiche sous le
 * champ, et le champ passe en rouge. Un seul endroit décide de la validité —
 * le parser Zod côté serveur.
 */

import type { ReactNode } from "react";

export interface FieldProps {
  readonly label: string;
  readonly path: string;
  readonly errors: ReadonlyMap<string, string>;
  readonly hint?: string;
  readonly children?: ReactNode;
}

/** Habillage commun : libellé, aide, message d'erreur. */
export function Field({ label, path, errors, hint, children }: FieldProps) {
  const error = errors.get(path);
  return (
    <label className="block" data-testid={`field-${path}`}>
      <span className="block text-sm font-medium text-gray-700">{label}</span>
      {hint && <span className="block text-xs text-gray-500">{hint}</span>}
      <span className="mt-1 block">{children}</span>
      {error && (
        <span
          role="alert"
          data-testid={`error-${path}`}
          className="mt-1 block text-xs font-medium text-red-600"
        >
          {error}
        </span>
      )}
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-lg border px-3 py-2 text-sm ${
    hasError
      ? "border-red-400 bg-red-50 focus:border-red-500"
      : "border-gray-300 focus:border-indigo-500"
  } focus:outline-none focus:ring-1 focus:ring-indigo-200`;
}

export function TextField({
  label,
  path,
  errors,
  hint,
  value,
  onChange,
  placeholder,
  disabled = false,
}: Omit<FieldProps, "children"> & {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}) {
  return (
    <Field label={label} path={path} errors={errors} hint={hint}>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass(errors.has(path))} ${disabled ? "bg-gray-100 text-gray-500" : ""}`}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  path,
  errors,
  hint,
  value,
  onChange,
  rows = 4,
}: Omit<FieldProps, "children"> & {
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly rows?: number;
}) {
  return (
    <Field label={label} path={path} errors={errors} hint={hint}>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(errors.has(path))}
      />
    </Field>
  );
}

export function NumberField({
  label,
  path,
  errors,
  hint,
  value,
  onChange,
  min,
  max,
  suffix,
}: Omit<FieldProps, "children"> & {
  readonly value: number;
  readonly onChange: (v: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly suffix?: string;
}) {
  return (
    <Field label={label} path={path} errors={errors} hint={hint}>
      <span className="flex items-center gap-2">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className={inputClass(errors.has(path))}
        />
        {suffix && (
          <span className="shrink-0 text-xs text-gray-500">{suffix}</span>
        )}
      </span>
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  path,
  errors,
  hint,
  value,
  onChange,
  options,
}: Omit<FieldProps, "children"> & {
  readonly value: T;
  readonly onChange: (v: T) => void;
  readonly options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <Field label={label} path={path} errors={errors} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={inputClass(errors.has(path))}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Interrupteur : plus lisible qu'une case à cocher dans une fiche dense. */
export function ToggleField({
  label,
  hint,
  value,
  onChange,
  testId,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly value: boolean;
  readonly onChange: (v: boolean) => void;
  readonly testId?: string;
}) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
      data-testid={testId}
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="block text-xs text-gray-600">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 ${
          value ? "bg-emerald-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </span>
    </label>
  );
}

/** Bandeau récapitulant les erreurs qui ne pointent aucun champ affiché. */
export function IssuesSummary({
  issues,
  shownPaths,
}: {
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
  readonly shownPaths: ReadonlySet<string>;
}) {
  const orphans = issues.filter((i) => !shownPaths.has(i.path));
  if (orphans.length === 0) return null;
  return (
    <div
      role="alert"
      data-testid="issues-summary"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
    >
      <p className="font-semibold">
        {orphans.length} problème{orphans.length > 1 ? "s" : ""} à corriger
      </p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
        {orphans.map((i, idx) => (
          <li key={`${i.path}-${idx}`}>
            <code className="font-mono">{i.path || "(racine)"}</code> —{" "}
            {i.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
