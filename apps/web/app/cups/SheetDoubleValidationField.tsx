"use client";

/**
 * Option « double validation des feuilles de match » d'une coupe. Partagée
 * par la création et l'édition (même posture que `SheetEntryModeField`) :
 * cochée, le commissaire ne valide une feuille qu'une fois soumise par ses
 * deux coachs.
 */

export interface SheetDoubleValidationFieldProps {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

export function SheetDoubleValidationField({
  checked,
  onChange,
  disabled = false,
}: SheetDoubleValidationFieldProps) {
  return (
    <label
      data-testid="sheet-double-validation-field"
      className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-2 text-sm"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        data-testid="sheet-double-validation"
        className="mt-0.5"
      />
      <span>
        <span className="block font-medium text-gray-800">
          Double validation des feuilles de match
        </span>
        <span className="block text-xs text-gray-500">
          Les deux coachs doivent soumettre la feuille (« Valider ma saisie »)
          avant que le commissaire puisse la valider. Sur un forfait, seul le
          coach non forfaitaire est attendu. Modifiable à tout moment.
        </span>
      </span>
    </label>
  );
}
