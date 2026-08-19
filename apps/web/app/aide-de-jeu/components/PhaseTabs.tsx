"use client";

import type { PhaseId } from "../data/sequences";
import { PHASES } from "../data/sequences";

interface PhaseTabsProps {
  readonly active: PhaseId;
  readonly onSelect: (id: PhaseId) => void;
}

const ICONS: Record<PhaseId, JSX.Element> = {
  avant: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9zM9 11h6M9 15h4" />
    </>
  ),
  pendant: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M12 6v12M3 10h3M3 14h3M18 10h3M18 14h3" />
    </>
  ),
  apres: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M10 20h4M12 14v6" />
    </>
  ),
};

/**
 * Navigation entre phases, collée en bas de l'écran sur mobile : sur un
 * téléphone tenu d'une main au-dessus d'un plateau, elle doit rester au
 * pouce sans remonter en haut de page. À partir de `sm:` elle redevient
 * une barre d'onglets normale, dans le flux.
 */
export function PhaseTabs({ active, onSelect }: PhaseTabsProps): JSX.Element {
  return (
    <nav
      aria-label="Phases de la partie"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-nuffle-bronze/20 bg-white/97 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(30,30,30,0.06)] backdrop-blur sm:static sm:mx-auto sm:max-w-md sm:rounded-2xl sm:border sm:shadow-sm"
    >
      {PHASES.map((phase) => {
        const isActive = phase.id === active;
        return (
          <button
            key={phase.id}
            type="button"
            onClick={() => onSelect(phase.id)}
            aria-current={isActive ? "true" : undefined}
            data-testid={`phase-tab-${phase.id}`}
            className={`flex min-h-[3.5rem] flex-col items-center justify-center gap-1 pb-2 pt-2 transition-colors sm:min-h-[3rem] sm:flex-row sm:gap-2 ${
              isActive ? "text-nuffle-gold" : "text-nuffle-anthracite/45 hover:text-nuffle-anthracite/70"
            }`}
          >
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {ICONS[phase.id]}
            </svg>
            <span className={`text-[0.65rem] sm:text-sm ${isActive ? "font-bold" : "font-semibold"}`}>
              {phase.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
