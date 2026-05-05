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
} as const;
