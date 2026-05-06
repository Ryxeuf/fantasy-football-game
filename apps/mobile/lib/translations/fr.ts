/**
 * Traductions FR mobile.
 *
 * S27.3.1 (foundation) : namespace `common.*`.
 * S27.3.2 : namespace `settings.*` (replacement strings settings.tsx).
 * S27.3.3 : extension `settings.profile/security/danger/account/stats/profileHeader`
 *   pour les sub-components settings/* (ProfileEditSection,
 *   PasswordChangeSection, DangerZone, AccountInfoSection, StatsSection,
 *   ProfileHeader).
 * S27.3.4 : namespace `lobby.*` pour le refactor `lobby.tsx` -> `MatchCard`,
 *   `MatchList`, `FilterBar`, `LobbyHeader`, `LobbyActions`, `JoinMatchModal`.
 * S27.3.5 : namespace `auth.*` pour `login.tsx` et `register.tsx`.
 * S27.3.6 : namespace `matchmaking.*` pour `matchmaking.tsx` (titre,
 *   sous-titre, etat de recherche, vide, formulaire et messages d'erreur).
 *
 * Les autres namespaces (play, etc.) seront ajoutes au fur et a mesure du
 * remplacement des strings hardcodees.
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
    logout: "Deconnexion",
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
  lobby: {
    title: "Mes matchs",
    greeting: "Salut, {{name}} !",
    status: {
      active: "En cours",
      pending: "En attente",
      prematch: "Pre-match",
      prematchSetup: "Configuration",
      ended: "Termine",
    },
    myTurnBadge: "Votre tour",
    myTurnBannerSingular: "{{count}} match en attente de votre tour",
    myTurnBannerPlural: "{{count}} matchs en attente de votre tour",
    teamPlaceholder: "Mon equipe",
    waitingOpponent: "En attente...",
    vsCoach: "vs Coach {{name}}",
    roundLabel: "MT {{half}}, Tour {{turn}}",
    filters: {
      all: "Tous",
      myTurn: "Mon tour ({{count}})",
      active: "En cours",
      ended: "Termines",
    },
    actions: {
      teams: "Mes equipes",
      leaderboard: "Classement",
      profile: "Profil",
      matchmaking: "Chercher un match",
      cups: "Coupes",
      leagues: "Ligues",
      stars: "Stars",
      create: "Creer un match",
      join: "Rejoindre",
      replay: "▶ Voir le replay",
      replayA11y: "Voir le replay",
    },
    alerts: {
      matchCreatedTitle: "Match cree",
      matchCreatedBody: "ID du match : {{id}}",
      createError: "Impossible de creer le match",
      joinSuccessTitle: "Succes",
      joinSuccessBody: "Vous avez rejoint le match !",
      joinError: "Impossible de rejoindre le match",
      loadError: "Erreur de chargement",
    },
    errors: {
      prefix: "Erreur : {{message}}",
      empty: "Aucun match trouve.",
    },
    joinModal: {
      title: "Rejoindre un match",
      inputPlaceholder: "ID du match",
    },
  },
  matchmaking: {
    title: "Chercher un match",
    subtitle:
      "Selectionnez votre equipe et trouvez un adversaire automatiquement (VE +/- 150k po).",
    searching: {
      title: "Recherche d'un adversaire...",
      teamValueRange: "Valeur d'equipe : {{value}}  (matching {{range}})",
      cancel: "Annuler la recherche",
    },
    empty: {
      title: "Aucune equipe",
      description:
        "Vous avez besoin d'une equipe pour entrer dans la file d'attente.",
      createTeam: "Creer une equipe",
    },
    form: {
      label: "Votre equipe",
      submit: "Chercher un match",
    },
    errors: {
      selectTeam: "Selectionnez une equipe",
      loadTeams: "Impossible de charger les equipes",
      joinQueue: "Impossible de rejoindre la file",
      cancelSearch: "Impossible d'annuler la recherche",
    },
  },
  auth: {
    login: {
      title: "Connexion",
      emailLabel: "Email",
      emailPlaceholder: "email@example.com",
      passwordLabel: "Mot de passe",
      passwordPlaceholder: "Votre mot de passe",
      submit: "Se connecter",
      submitError: "Erreur lors de la connexion",
      preAlphaNotice:
        "Nuffle Arena est en pre-alpha. L'inscription sera bientot disponible.",
    },
    register: {
      title: "Inscription indisponible",
      message:
        "Nuffle Arena est actuellement en pre-alpha. L'inscription sera bientot disponible. Restez connectes !",
      backToLogin: "Retour a la connexion",
    },
  },
} as const;

export type FrTranslations = typeof FR_TRANSLATIONS;
