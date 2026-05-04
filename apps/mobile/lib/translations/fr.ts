/**
 * Traductions FR mobile.
 *
 * S27.3.1 (foundation) : namespace `common.*`.
 * S27.3.2 : namespace `settings.*` (replacement strings settings.tsx).
 *
 * Les namespaces dedies (lobby, play, etc.) seront ajoutes au fur et a
 * mesure du remplacement des strings hardcodees.
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
  settings: {
    profile: {
      notFound: "Profil introuvable",
      loadError: "Erreur lors du chargement",
      saveSuccess: "Profil enregistre",
      saveError: "Erreur lors de la sauvegarde",
    },
    password: {
      success: "Mot de passe modifie avec succes",
      error: "Erreur lors du changement de mot de passe",
    },
    delete: {
      title: "Supprimer le compte",
      confirm:
        "Etes-vous sur ? Cette action desactive votre acces de maniere permanente.",
      button: "Supprimer",
      error: "Erreur lors de la suppression du compte",
    },
    actions: {
      logout: "Deconnexion",
    },
  },
} as const;

export type FrTranslations = typeof FR_TRANSLATIONS;
