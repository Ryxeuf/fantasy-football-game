"use client";

/**
 * Bouton de pliage/dépliage : chevron + `aria-expanded`, réutilisé par
 * l'en-tête d'une journée du calendrier et par une section repliable.
 *
 * Le libellé reste accessible (`aria-label`) sans occuper de place :
 * l'en-tête d'une journée est déjà dense.
 */
interface CollapseToggleProps {
  open: boolean;
  onToggle: () => void;
  /** Libellé accessible (« Replier » / « Déplier »). */
  label: string;
  /** Id de l'élément piloté, pour `aria-controls`. */
  controls?: string;
  testId?: string;
  className?: string;
}

export function CollapseToggle({
  open,
  onToggle,
  label,
  controls,
  testId,
  className = "",
}: CollapseToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={controls}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}
      >
        ▶
      </span>
    </button>
  );
}
