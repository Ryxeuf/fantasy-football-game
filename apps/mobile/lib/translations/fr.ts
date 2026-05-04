/**
 * S27.3.1 — Traductions FR mobile.
 *
 * Foundation : seul `common.*` est defini pour l'instant. Les
 * namespaces dedies (lobby, settings, play, etc.) seront ajoutes
 * dans les slices suivantes au fur et a mesure du remplacement
 * des strings hardcodees.
 */

export const FR_TRANSLATIONS = {
  common: {
    cancel: "Annuler",
    confirm: "Confirmer",
    welcome: "Bienvenue {{name}} !",
    loading: "Chargement…",
    error: "Erreur",
    retry: "Reessayer",
  },
} as const;

export type FrTranslations = typeof FR_TRANSLATIONS;
