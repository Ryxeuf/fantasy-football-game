/**
 * Traductions EN mobile.
 *
 * Doit miroirer la structure de `fr.ts` (parite stricte enforcee par
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
    save: "Save",
    logout: "Log out",
  },
  settings: {
    profile: {
      title: "Profile",
      editButton: "Edit",
      saveButton: "Save",
      notFound: "Profile not found",
      loadError: "Failed to load",
      saveSuccess: "Profile saved",
      saveError: "Failed to save",
      fields: {
        email: "Email",
        coachName: "Coach name",
        firstName: "First name",
        lastName: "Last name",
        dateOfBirth: "Date of birth (YYYY-MM-DD)",
        dateOfBirthPlaceholder: "1990-05-15",
      },
    },
    security: {
      title: "Security",
      changeButton: "Change password",
      saveButton: "Save",
      fields: {
        currentPassword: "Current password",
        newPassword: "New password",
        confirmPassword: "Confirm password",
      },
    },
    password: {
      success: "Password changed successfully",
      error: "Failed to change password",
    },
    delete: {
      title: "Delete account",
      confirm:
        "Are you sure? This action permanently disables your access.",
      button: "Delete",
      error: "Failed to delete account",
    },
    danger: {
      title: "Account deletion",
      description:
        "Deleting your account disables your access. Your game data may be retained for statistics, but you will no longer be able to sign in.",
      button: "Delete my account",
    },
    account: {
      title: "Account information",
      registeredAt: "Registered on",
      lastUpdate: "Last update",
      firstName: "First name",
      lastName: "Last name",
      dateOfBirth: "Date of birth",
      role: "Role",
      adminRole: "Administrator",
    },
    stats: {
      title: "Statistics",
      elo: "ELO",
      teams: "Teams",
      matchesPlayed: "Matches played",
      matchesCreated: "Matches created",
    },
    profileHeader: {
      patreonBadge: "Patreon",
    },
    actions: {
      logout: "Log out",
    },
  },
  lobby: {
    title: "My matches",
    greeting: "Hi, {{name}}!",
    status: {
      active: "In progress",
      pending: "Pending",
      prematch: "Pre-match",
      prematchSetup: "Setup",
      ended: "Ended",
    },
    myTurnBadge: "Your turn",
    myTurnBannerSingular: "{{count}} match waiting for your turn",
    myTurnBannerPlural: "{{count}} matches waiting for your turn",
    teamPlaceholder: "My team",
    waitingOpponent: "Waiting...",
    vsCoach: "vs Coach {{name}}",
    roundLabel: "H {{half}}, Turn {{turn}}",
    filters: {
      all: "All",
      myTurn: "My turn ({{count}})",
      active: "Active",
      ended: "Ended",
    },
    actions: {
      teams: "My teams",
      leaderboard: "Leaderboard",
      profile: "Profile",
      matchmaking: "Find a match",
      cups: "Cups",
      leagues: "Leagues",
      stars: "Stars",
      create: "Create a match",
      join: "Join",
      replay: "▶ Watch replay",
      replayA11y: "Watch replay",
    },
    alerts: {
      matchCreatedTitle: "Match created",
      matchCreatedBody: "Match ID: {{id}}",
      createError: "Unable to create the match",
      joinSuccessTitle: "Success",
      joinSuccessBody: "You joined the match!",
      joinError: "Unable to join the match",
      loadError: "Loading error",
    },
    errors: {
      prefix: "Error: {{message}}",
      empty: "No match found.",
    },
    joinModal: {
      title: "Join a match",
      inputPlaceholder: "Match ID",
    },
  },
  teams: {
    list: {
      title: "My teams",
      createButton: "+ Create",
      empty: "No team yet.",
      createFirst: "Create my first team",
      errors: {
        loadError: "Loading error",
        prefix: "Error: {{message}}",
      },
    },
    new: {
      nameLabel: "Team name",
      namePlaceholder: "E.g. Reikland Reavers",
      rosterLabel: "Roster",
      rosterTier: "Tier {{tier}}",
      budgetLabel: "Budget (k gp)",
      submit: "Create the team",
      errors: {
        loadError: "Loading error",
        prefix: "Error: {{message}}",
        invalidNameTitle: "Invalid name",
        rosterRequiredTitle: "Roster required",
        rosterRequiredMessage: "Choose a roster for your team",
        invalidBudgetTitle: "Invalid budget",
        createErrorTitle: "Error",
        createErrorMessage: "Unable to create the team",
      },
    },
    detail: {
      notFound: "Team not found",
      backToList: "Back to teams",
      backButton: "Back",
      stats: {
        value: "Value",
        treasury: "Treasury",
        players: "Players",
      },
      configuration: {
        title: "Configuration",
        rerolls: "Rerolls",
        cheerleaders: "Cheerleaders",
        assistants: "Assistant coaches",
        dedicatedFans: "Dedicated fans",
        apothecary: "Apothecary",
        onLabel: "YES",
        offLabel: "NO",
        yes: "Yes",
        no: "No",
        editButton: "Edit configuration",
        saveButton: "Save",
      },
      players: {
        title: "Players ({{count}})",
        empty: "No player recruited",
      },
      starPlayers: {
        title: "Star Players ({{count}})",
      },
      errors: {
        loadError: "Loading error",
        saveErrorMessage: "Unable to save",
      },
    },
  },
  leaderboard: {
    title: "ELO Ranking",
    stats: {
      players: "Players",
      best: "Best",
      average: "Average",
    },
    empty: "No coach ranked yet.",
    errors: {
      loadError: "Loading error",
      prefix: "Error: {{message}}",
    },
    pagination: {
      previous: "Previous",
      next: "Next",
      pageOf: "Page {{current}} / {{total}}",
    },
  },
  matchmaking: {
    title: "Find a match",
    subtitle:
      "Select your team and find an opponent automatically (TV +/- 150k gp).",
    searching: {
      title: "Looking for an opponent...",
      teamValueRange: "Team value: {{value}}  (matching {{range}})",
      cancel: "Cancel search",
    },
    empty: {
      title: "No team",
      description: "You need a team to enter the queue.",
      createTeam: "Create a team",
    },
    form: {
      label: "Your team",
      submit: "Find a match",
    },
    errors: {
      selectTeam: "Select a team",
      loadTeams: "Unable to load teams",
      joinQueue: "Unable to join the queue",
      cancelSearch: "Unable to cancel the search",
    },
  },
  players: {
    detail: {
      notFound: "Player not found",
      teamNotFound: "Team not found",
      backToTeam: "Back to the team",
      backButton: "Back",
      subtitle: "{{position}} — {{team}}",
      statBase: "base {{value}}",
      status: {
        dead: "Deceased",
        missNextMatch: "Misses next match",
        injured: "Injured",
        fit: "Fit",
      },
      sections: {
        stats: "Characteristics",
        progression: "Progression",
        skills: "Skills",
        advancements: "Advancements taken",
        nextAdvancement: "Next advancement",
        injuries: "Injuries & status",
      },
      progression: {
        spp: "Available SPP",
        matchesPlayed: "Matches played",
        touchdowns: "Touchdowns scored",
        casualties: "Casualties inflicted",
        completions: "Passes completed",
        interceptions: "Interceptions caught",
        mvp: "MVP",
        advancementsCount: "Advancements unlocked",
      },
      skills: {
        empty: "No skill acquired yet",
      },
      advancements: {
        empty: "No advancement taken yet",
        deadPlayer: "Player deceased — no progression",
        types: {
          primary: "Primary",
          secondary: "Secondary",
          randomPrimary: "Random primary",
          randomSecondary: "Random secondary",
        },
      },
      injuries: {
        empty: "No persistent injuries",
        niggling: "Persistent injuries: {{count}}",
        statReduction: "{{stat}} -{{value}}",
        missNextMatch: "Misses next match",
      },
      errors: {
        loadError: "Loading error",
      },
    },
  },
  play: {
    loading: "Loading the match...",
    noState: "No game state available",
    hint: "Tap a player to see playable cells. Double-tap to deselect.",
    errors: {
      loadError: "Loading error",
      actionError: "Error",
      prefix: "Error: {{message}}",
    },
    banner: {
      myTurn: "Your turn",
      opponentTurn: "Opponent's turn",
      offline: " (offline)",
    },
    actions: {
      throwTeamMate: "Throw a team-mate",
      cancelTarget: "Cancel (target)",
      cancelThrower: "Cancel (thrower)",
      endTurn: "End turn",
      back: "← Back",
    },
  },
  popups: {
    fallbacks: {
      attacker: "Attacker",
      defender: "Defender",
      player: "Player",
    },
    block: {
      title: "Block dice choice",
      chooserChoosing: "{{name}} chooses",
      chooseA11y: "Choose {{result}}",
      results: {
        playerDown: "Attacker down",
        bothDown: "Both down",
        pushBack: "Push back",
        stumble: "Stumble",
        pow: "POW!",
      },
    },
    push: {
      title: "Push direction choice",
      subtitle:
        "{{attacker}} must choose where to push {{target}}",
      pushTowardsA11y: "Push towards {{label}}",
    },
    followUp: {
      title: "Follow-up",
      subtitle: "{{attacker}} pushed {{target}} to ({{x}}, {{y}})",
      question:
        "Do you want {{attacker}} to follow into the freed square?",
      yes: "Follow up",
      no: "Stay put",
      hint: "Following up is free and does not cost movement points",
    },
  },
  leagues: {
    public: "Public",
    private: "Private",
    list: {
      title: "Leagues",
      filters: {
        all: "All",
      },
      empty: "No league for this filter.",
      errors: {
        loadError: "Failed to load",
        prefix: "Error: {{message}}",
      },
      card: {
        maxParticipants: "Max {{count}} teams",
      },
    },
    detail: {
      notFound: "League not found",
      creatorMeta: "Creator: {{creator}} • Max {{count}} teams",
      sections: {
        scoring: "Scoring",
        seasons: "Seasons",
        rounds: "Rounds",
        standings: "Standings",
        participants: "Participants",
      },
      scoring: {
        win: "Win",
        draw: "Draw",
        loss: "Loss",
        forfeit: "Forfeit",
      },
      seasons: {
        empty: "No season yet.",
        tabLabel: "S{{number}} — {{name}}",
      },
      rounds: {
        empty: "No round scheduled.",
        label: "Round {{number}}",
        labelWithName: "Round {{number}} — {{name}}",
      },
      standings: {
        empty: "No match counted yet.",
        headers: {
          team: "Team",
          wins: "W",
          draws: "D",
          losses: "L",
          points: "Pts",
        },
      },
      participants: {
        empty: "No participant for this season.",
        summary: "{{roster}} • {{coach}} • ELO {{elo}}",
      },
      errors: {
        loadError: "Failed to load",
        prefix: "Error: {{message}}",
      },
    },
  },
  auth: {
    login: {
      title: "Sign in",
      emailLabel: "Email",
      emailPlaceholder: "email@example.com",
      passwordLabel: "Password",
      passwordPlaceholder: "Your password",
      submit: "Sign in",
      submitError: "Sign-in failed",
      preAlphaNotice:
        "Nuffle Arena is in pre-alpha. Registration will be available soon.",
    },
    register: {
      title: "Registration unavailable",
      message:
        "Nuffle Arena is currently in pre-alpha. Registration will be available soon. Stay tuned!",
      backToLogin: "Back to sign-in",
    },
  },
} as const;
