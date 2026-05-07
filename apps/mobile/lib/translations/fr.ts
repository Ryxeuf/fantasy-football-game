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
 * S27.3.7 : namespace `leaderboard.*` pour `leaderboard.tsx` (titre,
 *   stat cards, etat vide, erreurs, pagination).
 * S27.3.8 : namespace `teams.list.*` pour `teams/index.tsx` (titre,
 *   bouton creer, empty state, erreurs). Place laissee pour
 *   `teams.detail.*` et `teams.new.*` lors des slices suivantes.
 * S27.3.9 : namespace `teams.new.*` pour `teams/new.tsx` (form labels,
 *   alertes de validation, erreurs de chargement et de creation).
 * S27.3.11 : namespace `teams.detail.*` pour `teams/[id].tsx` (etats,
 *   stats card, configuration, players, star players, erreurs de chargement
 *   et de sauvegarde).
 * S27.3.12 : namespace `players.detail.*` pour `player/[teamId]/[playerId].tsx`
 *   (statut, sections caracteristiques/progression/competences/avancements/
 *   blessures, libelles d'avancements, summary blessures structure).
 * S27.3.13 : namespace `play.*` pour `apps/mobile/app/play/[id].tsx`
 *   (chargement, banner de tour, actions Throw Team-Mate / End Turn,
 *   erreurs, hint, bouton retour).
 * S27.3.14 : namespace `popups.*` pour les 4 popups in-match
 *   (`BlockChoicePopup`, `PushChoicePopup`, `FollowUpChoicePopup` et
 *   les fallbacks de `MatchPopups`). Couvre titres, sous-titres,
 *   labels de resultat de blocage, libelles d'accessibilite et
 *   fallbacks de noms de joueurs.
 * S27.3.15 : namespace `leagues.*` pour `leagues/index.tsx` et
 *   `leagues/[id].tsx` (titre liste, filtres, vide, erreurs, card,
 *   detail introuvable, sections bareme/saisons/journees/classement/
 *   participants, scoring V/N/D/Forfait, headers de standings,
 *   summary participants).
 * S27.3.16 : namespace `cups.*` pour `cups/index.tsx`,
 *   `cups/archived.tsx` et `cups/[id].tsx` (titre liste + lien
 *   archivees, filtres, vide, erreurs, card avec singulier/pluriel
 *   participants, detail introuvable, creator meta, sections
 *   participants/standings/matches, headers de classement V/N/D/Pts,
 *   summary participant et label match).
 * S27.3.17 : namespace `starPlayers.*` pour `star-players/index.tsx`
 *   et `star-players/[slug].tsx` (titre catalogue, sous-titre avec
 *   compteurs singulier/pluriel/filtre, recherche, ruleset Saison
 *   2/3, toggle Mega Stars on/off, vide, hirable, badge Mega Star,
 *   detail introuvable, image a11y, sections caracteristiques/
 *   competences/recrutable par/regle speciale, actions retour).
 * S27.3.18 : namespaces `match.*` et `replay.*` pour
 *   `match/[id].tsx` (titre historique, score final, stats, vide,
 *   erreurs, libelle MT/Tour, types de tour `start/accept/coinToss/
 *   selectKickTeam/validateSetup/kickoffSequence/kickoffScatter/
 *   kickoffEventResolved`, types d'action `move/block/blitz/pass/
 *   handoff/foul/endTurn/select/chooseBlockResult/choosePushDirection/
 *   followUp`) et `replay/[id].tsx` (chargement, vide, retour, erreurs,
 *   mi-temps/tour, transport play/pause/start/previous/next/end,
 *   vitesse + a11y, action label).
 * S27.3.19 : namespace `nav.*` pour `_layout.tsx` (titres de
 *   Stack.Screen : appName, lobby, matchmaking, leaderboard, login,
 *   register, matchHistory, replay, teamsList/New/Detail,
 *   cupsList/Archived/Detail, leaguesList/Detail,
 *   starPlayersList/Detail, settings). Cloture S27.3 : audit i18n
 *   mobile a 0 chaine hardcodee.
 *
 * Les autres namespaces seront ajoutes au fur et a mesure du
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
  teams: {
    list: {
      title: "Mes equipes",
      createButton: "+ Creer",
      empty: "Aucune equipe pour l'instant.",
      createFirst: "Creer ma premiere equipe",
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
    },
    new: {
      nameLabel: "Nom de l'equipe",
      namePlaceholder: "Ex: Reikland Reavers",
      rosterLabel: "Roster",
      rosterTier: "Tier {{tier}}",
      budgetLabel: "Budget (K po)",
      submit: "Creer l'equipe",
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
        invalidNameTitle: "Nom invalide",
        rosterRequiredTitle: "Roster requis",
        rosterRequiredMessage: "Choisissez un roster pour votre equipe",
        invalidBudgetTitle: "Budget invalide",
        createErrorTitle: "Erreur",
        createErrorMessage: "Impossible de creer l'equipe",
      },
    },
    detail: {
      notFound: "Equipe introuvable",
      backToList: "Retour aux equipes",
      backButton: "Retour",
      stats: {
        value: "Valeur",
        treasury: "Tresor",
        players: "Joueurs",
      },
      configuration: {
        title: "Configuration",
        rerolls: "Relances",
        cheerleaders: "Pom-pom girls",
        assistants: "Assistants coach",
        dedicatedFans: "Fans devoues",
        apothecary: "Apothicaire",
        onLabel: "OUI",
        offLabel: "NON",
        yes: "Oui",
        no: "Non",
        editButton: "Editer la configuration",
        saveButton: "Sauvegarder",
      },
      players: {
        title: "Joueurs ({{count}})",
        empty: "Aucun joueur recrute",
      },
      starPlayers: {
        title: "Star Players ({{count}})",
      },
      errors: {
        loadError: "Erreur de chargement",
        saveErrorMessage: "Impossible de sauvegarder",
      },
    },
  },
  leaderboard: {
    title: "Classement ELO",
    stats: {
      players: "Joueurs",
      best: "Meilleur",
      average: "Moyen",
    },
    empty: "Aucun coach classe pour l'instant.",
    errors: {
      loadError: "Erreur de chargement",
      prefix: "Erreur : {{message}}",
    },
    pagination: {
      previous: "Precedent",
      next: "Suivant",
      pageOf: "Page {{current}} / {{total}}",
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
  players: {
    detail: {
      notFound: "Joueur introuvable",
      teamNotFound: "Equipe introuvable",
      backToTeam: "Retour a l'equipe",
      backButton: "Retour",
      subtitle: "{{position}} — {{team}}",
      statBase: "base {{value}}",
      status: {
        dead: "Decede",
        missNextMatch: "Absent prochain match",
        injured: "Blesse",
        fit: "Apte",
      },
      sections: {
        stats: "Caracteristiques",
        progression: "Progression",
        skills: "Competences",
        advancements: "Avancements acquis",
        nextAdvancement: "Prochain avancement",
        injuries: "Blessures & statut",
      },
      progression: {
        spp: "SPP disponibles",
        matchesPlayed: "Matchs joues",
        touchdowns: "Touchdowns",
        casualties: "Sorties infligees",
        completions: "Passes reussies",
        interceptions: "Interceptions",
        mvp: "MVP",
        advancementsCount: "Avancements pris",
      },
      skills: {
        empty: "Aucune competence acquise",
      },
      advancements: {
        empty: "Aucun avancement pour l'instant",
        deadPlayer: "Joueur decede — aucune progression",
        types: {
          primary: "Primaire",
          secondary: "Secondaire",
          randomPrimary: "Primaire aleatoire",
          randomSecondary: "Secondaire aleatoire",
        },
      },
      injuries: {
        empty: "Aucune blessure persistante",
        niggling: "Blessures persistantes : {{count}}",
        statReduction: "{{stat}} -{{value}}",
        missNextMatch: "Absent au prochain match",
      },
      errors: {
        loadError: "Erreur de chargement",
      },
    },
  },
  play: {
    loading: "Chargement du match...",
    noState: "Aucun etat de jeu disponible",
    hint: "Tap un joueur pour voir ses cases jouables. Double-tap pour annuler.",
    errors: {
      loadError: "Erreur de chargement",
      actionError: "Erreur",
      prefix: "Erreur : {{message}}",
    },
    banner: {
      myTurn: "Votre tour",
      opponentTurn: "Tour de l'adversaire",
      offline: " (hors ligne)",
    },
    actions: {
      throwTeamMate: "Lancer un coequipier",
      cancelTarget: "Annuler (cible)",
      cancelThrower: "Annuler (lancer)",
      endTurn: "Fin de tour",
      back: "← Retour",
    },
  },
  popups: {
    fallbacks: {
      attacker: "Attaquant",
      defender: "Défenseur",
      player: "Joueur",
    },
    block: {
      title: "Choix du dé de blocage",
      chooserChoosing: "{{name}} choisit",
      chooseA11y: "Choisir {{result}}",
      results: {
        playerDown: "Attaquant à terre",
        bothDown: "Deux à terre",
        pushBack: "Repoussé",
        stumble: "Trébuche",
        pow: "POW !",
      },
    },
    push: {
      title: "Choix de direction de poussée",
      subtitle:
        "{{attacker}} doit choisir dans quelle direction pousser {{target}}",
      pushTowardsA11y: "Pousser vers {{label}}",
    },
    followUp: {
      title: "Suivi (Follow-up)",
      subtitle: "{{attacker}} a repoussé {{target}} vers ({{x}}, {{y}})",
      question:
        "Voulez-vous que {{attacker}} le suive dans la case libérée ?",
      yes: "Suivre",
      no: "Ne pas suivre",
      hint:
        "Le suivi est gratuit et ne consomme pas de points de mouvement",
    },
  },
  nav: {
    appName: "Nuffle Arena",
    lobby: "Mes matchs",
    matchmaking: "Chercher un match",
    leaderboard: "Classement",
    login: "Connexion",
    register: "Inscription",
    matchHistory: "Historique du match",
    replay: "Replay",
    teamsList: "Mes equipes",
    teamsNew: "Nouvelle equipe",
    teamsDetail: "Detail equipe",
    cupsList: "Coupes",
    cupsArchived: "Coupes archivees",
    cupsDetail: "Detail coupe",
    leaguesList: "Ligues",
    leaguesDetail: "Detail ligue",
    starPlayersList: "Star Players",
    starPlayersDetail: "Detail Star Player",
    settings: "Profil et reglages",
  },
  match: {
    history: {
      title: "Historique",
      back: "← Retour",
      empty: "Aucun historique disponible.",
      scoreFinal: "Score final : {{teamA}} - {{teamB}}",
      stats: {
        actions: "Actions",
        movesPlayed: "Coups joues",
      },
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
      turnRound: "MT {{half}}, Tour {{turn}}",
      actionFallback: "Action",
      turnTypes: {
        start: "Debut du match",
        accept: "Match accepte",
        coinToss: "Tirage au sort",
        selectKickTeam: "Choix du kickoff",
        validateSetup: "Placement valide",
        kickoffSequence: "Sequence de kickoff",
        kickoffScatter: "Deviation du ballon",
        kickoffEventResolved: "Evenement de kickoff",
      },
      moveTypes: {
        move: "Deplacement",
        block: "Blocage",
        blitz: "Blitz",
        pass: "Passe",
        handoff: "Transmission",
        foul: "Agression",
        endTurn: "Fin de tour",
        select: "Selection",
        chooseBlockResult: "Choix du bloc",
        choosePushDirection: "Choix de poussee",
        followUp: "Poursuite",
      },
    },
  },
  replay: {
    loading: "Chargement du replay...",
    empty: "Aucune donnee de replay disponible",
    back: "Retour",
    errors: {
      loadError: "Erreur de chargement du replay",
    },
    halfTurn: "Mi-temps {{half}} • Tour {{turn}}",
    transport: {
      start: "Debut",
      previous: "Image precedente",
      next: "Image suivante",
      end: "Fin",
      play: "Lecture",
      pause: "Pause",
    },
    speed: {
      label: "Vitesse",
      a11y: "Vitesse {{label}}",
    },
    actionLabel: "Action : {{label}}",
  },
  starPlayers: {
    megaStarBadge: "Mega Star",
    list: {
      title: "Catalogue Star Players",
      subtitleSingular: "{{count}} joueur",
      subtitlePlural: "{{count}} joueurs",
      subtitleFiltered: " sur {{total}}",
      search: {
        placeholder: "Rechercher par nom...",
      },
      ruleset: {
        season3: "Saison 3",
        season2: "Saison 2",
      },
      megaToggle: {
        on: "Mega stars uniquement",
        off: "Mega stars ({{count}})",
      },
      empty: "Aucun star player ne correspond aux filtres.",
      row: {
        hirable: "Recrutable : {{hirable}}",
      },
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
    },
    detail: {
      notFound: "Star Player introuvable",
      imageA11y: "Illustration de {{name}}",
      sections: {
        stats: "Caracteristiques",
        skills: "Competences",
        hirable: "Recrutable par",
        specialRule: "Regle speciale",
      },
      skills: {
        empty: "Aucune competence",
      },
      actions: {
        back: "Retour",
        backToCatalog: "Retour au catalogue",
      },
      errors: {
        loadError: "Erreur de chargement",
      },
    },
  },
  cups: {
    public: "Publique",
    private: "Privee",
    list: {
      title: "Coupes",
      archivedLink: "Archivees",
      filters: {
        all: "Toutes",
      },
      empty: "Aucune coupe pour ce filtre.",
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
      card: {
        participantSingular: "{{count}} participant",
        participantPlural: "{{count}} participants",
      },
    },
    archived: {
      title: "Coupes archivees",
      empty: "Aucune coupe archivee.",
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
    },
    detail: {
      notFound: "Coupe introuvable",
      creatorMeta: "Cree par {{creator}}",
      sections: {
        participants: "Participants",
        standings: "Classement",
        matches: "Matchs",
      },
      participants: {
        empty: "Aucun participant pour l'instant.",
        summary: "{{roster}} — {{coach}}",
      },
      standings: {
        empty: "Aucun match termine.",
        headers: {
          team: "Equipe",
          wins: "V",
          draws: "N",
          losses: "D",
          points: "Pts",
        },
      },
      matches: {
        empty: "Aucun match joue.",
        label: "Match {{id}}",
      },
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
    },
  },
  leagues: {
    public: "Publique",
    private: "Privee",
    list: {
      title: "Ligues",
      filters: {
        all: "Toutes",
      },
      empty: "Aucune ligue pour ce filtre.",
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
      card: {
        maxParticipants: "Max {{count}} equipes",
      },
    },
    detail: {
      notFound: "Ligue introuvable",
      creatorMeta: "Createur: {{creator}} • Max {{count}} equipes",
      sections: {
        scoring: "Bareme",
        seasons: "Saisons",
        rounds: "Journees",
        standings: "Classement",
        participants: "Participants",
      },
      scoring: {
        win: "Victoire",
        draw: "Nul",
        loss: "Defaite",
        forfeit: "Forfait",
      },
      seasons: {
        empty: "Aucune saison pour l'instant.",
        tabLabel: "S{{number}} — {{name}}",
      },
      rounds: {
        empty: "Aucune journee planifiee.",
        label: "Journee {{number}}",
        labelWithName: "Journee {{number}} — {{name}}",
      },
      standings: {
        empty: "Aucun match comptabilise.",
        headers: {
          team: "Equipe",
          wins: "V",
          draws: "N",
          losses: "D",
          points: "Pts",
        },
      },
      participants: {
        empty: "Aucun participant pour cette saison.",
        summary: "{{roster}} • {{coach}} • ELO {{elo}}",
      },
      errors: {
        loadError: "Erreur de chargement",
        prefix: "Erreur : {{message}}",
      },
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
