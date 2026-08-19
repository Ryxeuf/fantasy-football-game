"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface SheetPanelProps {
  readonly title: string;
  readonly dice: string;
  readonly hint: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

/**
 * Un seul composant pour les deux présentations : bottom-sheet sur mobile,
 * panneau latéral à partir de `sm:`. La bascule est purement CSS — une
 * détection de largeur en JS casserait au SSR et provoquerait un flash au
 * montage.
 */
export function SheetPanel({
  title,
  dice,
  hint,
  onClose,
  children,
}: SheetPanelProps): JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  // Focus au panneau à l'ouverture, rendu au déclencheur à la fermeture.
  useEffect(() => {
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, []);

  // Escape ferme, et le body ne scrolle plus derrière le panneau.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" data-testid="sheet-panel">
      <button
        type="button"
        aria-label="Fermer la fiche"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-nuffle-anthracite/55"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-l-3xl sm:rounded-tr-none"
      >
        {/* Poignée : signale le glisser sur mobile, masquée sur desktop. */}
        <div aria-hidden className="flex justify-center pb-1 pt-2.5 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-nuffle-bronze/30" />
        </div>

        <div className="flex items-start gap-3 border-b border-nuffle-bronze/20 px-4 pb-3 pt-1.5 sm:pt-4">
          <span className="mt-0.5 flex-none rounded-lg bg-nuffle-anthracite px-2.5 py-1.5 font-score text-base leading-none tracking-wide text-nuffle-gold">
            {dice}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-bold leading-tight text-nuffle-anthracite">
              {title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-nuffle-anthracite/60">{hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-mr-1 -mt-1 flex h-11 w-11 flex-none items-center justify-center rounded-xl text-nuffle-anthracite/50 transition-colors hover:bg-nuffle-ivory hover:text-nuffle-anthracite"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-3">
          {children}
        </div>
      </div>
    </div>
  );
}
