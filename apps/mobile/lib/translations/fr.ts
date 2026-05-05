/**
 * Traductions FR mobile.
 *
 * S27.3.1 (foundation) : namespace `common.*`.
 * S27.3.2 : namespace `settings.*` (replacement strings settings.tsx).
 * S27.3.3 : extension `settings.profile/security/danger/account/stats/profileHeader`
 *   pour les sub-components settings/* (ProfileEditSection,
 *   PasswordChangeSection, DangerZone, AccountInfoSection, StatsSection,
 *   ProfileHeader).
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
    save: "Enregistrer",
  },
  settings: {
    profile: {
      title: "Profil",
      editButton: "Modifier",
      saveButton: "Enregistrer",
      notFound: "Profil introuvable",
      loadError: "Erreur lors du chargement",
      saveSuccess: "Profil enregistre",
      saveError: "Erreur lors de la sauvegarde",
      fields: {
        email: "Email",
        coachName: "Nom de coach",
        firstName: "Prenom",
        lastName: "Nom",
        dateOfBirth: "Date de naissance (YYYY-MM-DD)",
        dateOfBirthPlaceholder: "1990-05-15",
      },
    },
    security: {
      title: "Securite",
      changeButton: "Changer le mot de passe",
      saveButton: "Enregistrer",
      fields: {
        currentPassword: "Mot de passe actuel",
        newPassword: "Nouveau mot de passe",
        confirmPassword: "Confirmer le mot de passe",
      },
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
    danger: {
      title: "Suppression du compte",
      description:
        "La suppression desactive votre acces. Vos donnees de jeu peuvent etre conservees pour les statistiques, mais vous ne pourrez plus vous reconnecter.",
      button: "Supprimer mon compte",
    },
    account: {
      title: "Informations du compte",
      registeredAt: "Inscrit le",
      lastUpdate: "Derniere mise a jour",
      firstName: "Prenom",
      lastName: "Nom",
      dateOfBirth: "Date de naissance",
      role: "Role",
      adminRole: "Administrateur",
    },
    stats: {
      title: "Statistiques",
      elo: "ELO",
      teams: "Equipes",
      matchesPlayed: "Matchs joues",
      matchesCreated: "Matchs crees",
    },
    profileHeader: {
      patreonBadge: "Patreon",
    },
    actions: {
      logout: "Deconnexion",
    },
  },
} as const;

export type FrTranslations = typeof FR_TRANSLATIONS;
