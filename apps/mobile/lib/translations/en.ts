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
