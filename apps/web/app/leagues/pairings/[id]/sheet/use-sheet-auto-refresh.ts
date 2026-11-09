"use client";

import { useEffect, useRef } from "react";

/** Relecture périodique de l'avant-match (~15 s). */
export const SHEET_AUTO_REFRESH_MS = 15_000;

/**
 * Relit la feuille SANS écran de chargement tant que `enabled` : au retour
 * sur l'onglet du navigateur (focus / visibilité) et toutes les
 * `intervalMs` tant que la page est visible. Sert l'avant-match, où les
 * achats du favori changent le budget de l'outsider : sans relecture, celui-ci
 * achetait sur un budget périmé.
 *
 * `refresh` est relu à chaque appel (ref) : un nouveau callback ne relance
 * pas le minuteur.
 */
export function useSheetAutoRefresh(
  enabled: boolean,
  refresh: () => void,
  intervalMs: number = SHEET_AUTO_REFRESH_MS,
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return;
    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState !== "hidden";
    const tick = () => {
      if (isVisible()) refreshRef.current();
    };
    const onVisibility = () => {
      if (isVisible()) refreshRef.current();
    };
    const timer = setInterval(tick, intervalMs);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, intervalMs]);
}
