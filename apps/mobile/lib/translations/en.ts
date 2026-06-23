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
          characteristic: "Characteristic",
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
    a11y: {
      boardLabel:
        "Blood Bowl board. Score {{teamA}} {{scoreA}} versus {{teamB}} {{scoreB}}. Half {{half}}, turn {{turn}}. {{playersA}} players on the field for {{teamA}}, {{playersB}} for {{teamB}}.",
      boardHint:
        "Tap a cell to select. Double-tap to deselect or reset the zoom.",
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
  nav: {
    appName: "Nuffle Arena",
    lobby: "My matches",
    matchmaking: "Find a match",
    leaderboard: "Leaderboard",
    login: "Sign in",
    register: "Sign up",
    matchHistory: "Match history",
    replay: "Replay",
    teamsList: "My teams",
    teamsNew: "New team",
    teamsDetail: "Team detail",
    cupsList: "Cups",
    cupsArchived: "Archived cups",
    cupsDetail: "Cup detail",
    leaguesList: "Leagues",
    leaguesDetail: "League detail",
    starPlayersList: "Star Players",
    starPlayersDetail: "Star Player detail",
    settings: "Profile & settings",
  },
  match: {
    history: {
      title: "History",
      back: "← Back",
      empty: "No history available.",
      scoreFinal: "Final score: {{teamA}} - {{teamB}}",
      stats: {
        actions: "Steps",
        movesPlayed: "Moves played",
      },
      errors: {
        loadError: "Failed to load",
        prefix: "Error: {{message}}",
      },
      turnRound: "H {{half}}, Turn {{turn}}",
      actionFallback: "Step",
      turnTypes: {
        start: "Match start",
        accept: "Match accepted",
        coinToss: "Coin toss",
        selectKickTeam: "Kickoff team",
        validateSetup: "Setup validated",
        kickoffSequence: "Kickoff sequence",
        kickoffScatter: "Ball scatter",
        kickoffEventResolved: "Kickoff event",
      },
      moveTypes: {
        move: "Move",
        block: "Block",
        blitz: "Blitz",
        pass: "Pass",
        handoff: "Hand-off",
        foul: "Foul",
        endTurn: "End of turn",
        select: "Selection",
        chooseBlockResult: "Block result",
        choosePushDirection: "Push direction",
        followUp: "Follow up",
      },
    },
  },
  replay: {
    loading: "Loading replay...",
    empty: "No replay data available",
    back: "Back",
    errors: {
      loadError: "Failed to load replay",
    },
    halfTurn: "Half {{half}} • Turn {{turn}}",
    transport: {
      start: "Start",
      previous: "Previous frame",
      next: "Next frame",
      end: "End",
      play: "Play",
      pause: "Pause",
    },
    speed: {
      label: "Speed",
      a11y: "Speed {{label}}",
    },
    actionLabel: "Action: {{label}}",
  },
  starPlayers: {
    megaStarBadge: "Mega Star",
    list: {
      title: "Star Players catalog",
      subtitleSingular: "{{count}} player",
      subtitlePlural: "{{count}} players",
      subtitleFiltered: " out of {{total}}",
      search: {
        placeholder: "Search by name...",
      },
      ruleset: {
        season3: "Season 3",
        season2: "Season 2",
      },
      megaToggle: {
        on: "Mega stars only",
        off: "Mega stars ({{count}})",
      },
      empty: "No star player matches the filters.",
      row: {
        hirable: "Hirable by: {{hirable}}",
      },
      errors: {
        loadError: "Failed to load",
        prefix: "Error: {{message}}",
      },
    },
    detail: {
      notFound: "Star Player not found",
      imageA11y: "Illustration of {{name}}",
      sections: {
        stats: "Stats",
        skills: "Skills",
        hirable: "Hirable by",
        specialRule: "Special rule",
      },
      skills: {
        empty: "No skill",
      },
      actions: {
        back: "Back",
        backToCatalog: "Back to catalog",
      },
      errors: {
        loadError: "Failed to load",
      },
    },
  },
  cups: {
    public: "Public",
    private: "Private",
    list: {
      title: "Cups",
      archivedLink: "Archived",
      filters: {
        all: "All",
      },
      empty: "No cup for this filter.",
      errors: {
        loadError: "Failed to load",
        prefix: "Error: {{message}}",
      },
      card: {
        participantSingular: "{{count}} participant",
        participantPlural: "{{count}} participants",
      },
    },
    archived: {
      title: "Archived cups",
      empty: "No archived cup.",
      errors: {
        loadError: "Failed to load",
        prefix: "Error: {{message}}",
      },
    },
    detail: {
      notFound: "Cup not found",
      creatorMeta: "Created by {{creator}}",
      sections: {
        participants: "Participants",
        standings: "Standings",
        matches: "Matches",
      },
      participants: {
        empty: "No participant yet.",
        summary: "{{roster}} — {{coach}}",
      },
      standings: {
        empty: "No match completed yet.",
        headers: {
          team: "Team",
          wins: "W",
          draws: "D",
          losses: "L",
          points: "Pts",
        },
      },
      matches: {
        empty: "No match played.",
        label: "Match {{id}}",
      },
      errors: {
        loadError: "Failed to load",
        prefix: "Error: {{message}}",
      },
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
