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
  },
  settings: {
    profile: {
      notFound: "Profile not found",
      loadError: "Failed to load",
      saveSuccess: "Profile saved",
      saveError: "Failed to save",
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
    actions: {
      logout: "Log out",
    },
  },
} as const;
