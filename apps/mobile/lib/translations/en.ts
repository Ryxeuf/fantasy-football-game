/**
 * S27.3.1 — Traductions EN mobile.
 *
 * Doit miroirer la structure de `fr.ts` (parite stricte enforce par
 * le type de `t()` qui prend ses cles de FR_TRANSLATIONS).
 */

export const EN_TRANSLATIONS = {
  common: {
    cancel: "Cancel",
    confirm: "Confirm",
    welcome: "Welcome {{name}}!",
    loading: "Loading…",
    error: "Error",
    retry: "Retry",
  },
} as const;
