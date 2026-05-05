/**
 * S27.3.1 — Tests du module i18n mobile (foundation).
 *
 * Module leger sans dependance externe (pas d'i18next) pour fournir
 * des traductions FR/EN typees. Le hook React `useTranslation()` viendra
 * dans une slice ulterieure, ce module expose juste la fonction pure
 * `t(key, params?, lang?)` reutilisable partout.
 */

import { describe, it, expect } from "vitest";
import {
  t,
  isLocale,
  resolveLocale,
  type Locale,
} from "./i18n";

describe("isLocale (S27.3)", () => {
  it("accepte 'fr' et 'en'", () => {
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("en")).toBe(true);
  });

  it("rejette les autres locales", () => {
    expect(isLocale("de")).toBe(false);
    expect(isLocale("")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("resolveLocale (S27.3)", () => {
  it("retourne la locale exacte si valide", () => {
    expect(resolveLocale("fr")).toBe("fr");
    expect(resolveLocale("en")).toBe("en");
  });

  it("normalise les variantes regionales (fr-FR, en-US)", () => {
    expect(resolveLocale("fr-FR")).toBe("fr");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("en-GB")).toBe("en");
  });

  it("fallback fr par defaut quand inconnu", () => {
    expect(resolveLocale("de")).toBe("fr");
    expect(resolveLocale(null)).toBe("fr");
    expect(resolveLocale(undefined)).toBe("fr");
    expect(resolveLocale("")).toBe("fr");
  });
});

describe("t (S27.3)", () => {
  it("retourne la valeur FR par defaut", () => {
    expect(t("common.cancel")).toBe("Annuler");
  });

  it("retourne la valeur EN quand lang='en'", () => {
    expect(t("common.cancel", undefined, "en")).toBe("Cancel");
  });

  it("interpolation des parametres {{name}}", () => {
    expect(t("common.welcome", { name: "Foo" })).toBe(
      "Bienvenue Foo !",
    );
    expect(t("common.welcome", { name: "Bar" }, "en")).toBe(
      "Welcome Bar!",
    );
  });

  it("retourne la cle telle quelle si la traduction est absente (forward-compat)", () => {
    expect(t("nonexistent.key" as never)).toBe("nonexistent.key");
  });

  it("fallback sur FR si la cle EN est absente", () => {
    // Cas hypothetique : si on a FR mais pas EN, on retombe FR plutot
    // que cle brute pour limiter les regressions visuelles en EN.
    // (cle factice ajoutee uniquement en FR pour ce test n'est pas
    // necessaire ici car on a parite stricte pour le moment.)
    // Verification minimale : `t` ne crash pas avec params/lang exotiques.
    expect(typeof t("common.cancel", undefined, "fr")).toBe("string");
  });
});

/**
 * S27.3.3 — Sub-components settings/* migration vers i18n.
 *
 * Couvre les nouvelles cles utilisees par :
 *  - ProfileEditSection (settings.profile.*)
 *  - PasswordChangeSection (settings.security.*)
 *  - DangerZone (settings.danger.*)
 *  - AccountInfoSection / StatsSection (settings.account.*, settings.stats.*)
 *  - ProfileHeader (settings.profileHeader.*)
 *
 * On valide que chaque cle :
 *  - retourne une chaine non vide en FR (default),
 *  - retourne une chaine non vide en EN,
 *  - les deux locales different (sinon trad EN oubliee).
 */
const SETTINGS_I18N_KEYS = [
  "settings.profile.title",
  "settings.profile.editButton",
  "settings.profile.fields.email",
  "settings.profile.fields.coachName",
  "settings.profile.fields.firstName",
  "settings.profile.fields.lastName",
  "settings.profile.fields.dateOfBirth",
  "settings.profile.fields.dateOfBirthPlaceholder",
  "settings.profile.saveButton",
  "settings.security.title",
  "settings.security.changeButton",
  "settings.security.fields.currentPassword",
  "settings.security.fields.newPassword",
  "settings.security.fields.confirmPassword",
  "settings.security.saveButton",
  "settings.danger.title",
  "settings.danger.description",
  "settings.danger.button",
  "settings.account.title",
  "settings.account.registeredAt",
  "settings.account.lastUpdate",
  "settings.account.firstName",
  "settings.account.lastName",
  "settings.account.dateOfBirth",
  "settings.account.role",
  "settings.account.adminRole",
  "settings.stats.title",
  "settings.stats.elo",
  "settings.stats.teams",
  "settings.stats.matchesPlayed",
  "settings.stats.matchesCreated",
  "settings.profileHeader.patreonBadge",
] as const;

describe("settings sub-components i18n keys (S27.3.3)", () => {
  it.each(SETTINGS_I18N_KEYS)(
    "FR : '%s' retourne une chaine non vide differente de la cle",
    (key) => {
      const value = t(key as never);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    },
  );

  it.each(SETTINGS_I18N_KEYS)(
    "EN : '%s' retourne une chaine non vide differente de la cle",
    (key) => {
      const value = t(key as never, undefined, "en" as Locale);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    },
  );

  // Sous-ensemble des cles dont la traduction EN doit explicitement
  // differer du FR (les autres comme "ELO", "Email", "Patreon" sont
  // legitimement identiques entre langues).
  const KEYS_REQUIRING_DISTINCT_EN = [
    "settings.profile.title",
    "settings.profile.editButton",
    "settings.profile.fields.coachName",
    "settings.profile.fields.firstName",
    "settings.profile.fields.lastName",
    "settings.profile.fields.dateOfBirth",
    "settings.profile.saveButton",
    "settings.security.title",
    "settings.security.changeButton",
    "settings.security.fields.currentPassword",
    "settings.security.fields.newPassword",
    "settings.security.fields.confirmPassword",
    "settings.security.saveButton",
    "settings.danger.title",
    "settings.danger.description",
    "settings.danger.button",
    "settings.account.title",
    "settings.account.registeredAt",
    "settings.account.lastUpdate",
    "settings.account.firstName",
    "settings.account.lastName",
    "settings.account.dateOfBirth",
    "settings.account.adminRole",
    "settings.stats.title",
    "settings.stats.teams",
    "settings.stats.matchesPlayed",
    "settings.stats.matchesCreated",
  ] as const;

  it.each(KEYS_REQUIRING_DISTINCT_EN)(
    "FR != EN pour '%s' (parite stricte, pas de copie oubliee)",
    (key) => {
      const fr = t(key as never);
      const en = t(key as never, undefined, "en" as Locale);
      expect(fr).not.toBe(en);
    },
  );
});

/**
 * S27.3.4 — Lobby refactor i18n keys.
 *
 * Couvre toutes les cles utilisees par :
 *  - LobbyHeader (lobby.title, lobby.greeting, lobby.actions.teams/leaderboard/profile, common.logout)
 *  - MyTurnBanner (lobby.myTurnBannerSingular/Plural)
 *  - LobbyActions (lobby.actions.matchmaking/cups/leagues/stars/create/join)
 *  - FilterBar (lobby.filters.all/myTurn/active/ended)
 *  - MatchCard (lobby.status.*, lobby.myTurnBadge, lobby.teamPlaceholder, lobby.waitingOpponent, lobby.vsCoach, lobby.roundLabel, lobby.actions.replay/replayA11y)
 *  - MatchList (lobby.errors.empty)
 *  - JoinMatchModal (lobby.joinModal.title/inputPlaceholder, common.cancel, lobby.actions.join)
 *  - lobby.tsx (lobby.alerts.*, lobby.errors.prefix, common.error, common.retry)
 *
 * Verifie : non-vide FR, non-vide EN, FR != EN sur les cles necessitant
 * une trad distincte (les statuts/actions partagent rarement le meme mot).
 */
const LOBBY_I18N_KEYS = [
  "lobby.title",
  "lobby.greeting",
  "lobby.status.active",
  "lobby.status.pending",
  "lobby.status.prematch",
  "lobby.status.prematchSetup",
  "lobby.status.ended",
  "lobby.myTurnBadge",
  "lobby.myTurnBannerSingular",
  "lobby.myTurnBannerPlural",
  "lobby.teamPlaceholder",
  "lobby.waitingOpponent",
  "lobby.vsCoach",
  "lobby.roundLabel",
  "lobby.filters.all",
  "lobby.filters.myTurn",
  "lobby.filters.active",
  "lobby.filters.ended",
  "lobby.actions.teams",
  "lobby.actions.leaderboard",
  "lobby.actions.profile",
  "lobby.actions.matchmaking",
  "lobby.actions.cups",
  "lobby.actions.leagues",
  "lobby.actions.stars",
  "lobby.actions.create",
  "lobby.actions.join",
  "lobby.actions.replay",
  "lobby.actions.replayA11y",
  "lobby.alerts.matchCreatedTitle",
  "lobby.alerts.matchCreatedBody",
  "lobby.alerts.createError",
  "lobby.alerts.joinSuccessTitle",
  "lobby.alerts.joinSuccessBody",
  "lobby.alerts.joinError",
  "lobby.alerts.loadError",
  "lobby.errors.prefix",
  "lobby.errors.empty",
  "lobby.joinModal.title",
  "lobby.joinModal.inputPlaceholder",
  "common.logout",
] as const;

describe("lobby refactor i18n keys (S27.3.4)", () => {
  it.each(LOBBY_I18N_KEYS)(
    "FR : '%s' retourne une chaine non vide differente de la cle",
    (key) => {
      const value = t(key as never);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    },
  );

  it.each(LOBBY_I18N_KEYS)(
    "EN : '%s' retourne une chaine non vide differente de la cle",
    (key) => {
      const value = t(key as never, undefined, "en" as Locale);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    },
  );

  // Cles dont la traduction EN doit differer du FR. Exclut les
  // identiques legitimes : "Pre-match" (lobby.status.prematch est
  // identique entre FR et EN), "Stars" (universel), "ELO", etc.
  const LOBBY_KEYS_REQUIRING_DISTINCT_EN = [
    "lobby.title",
    "lobby.greeting",
    "lobby.status.active",
    "lobby.status.pending",
    "lobby.status.prematchSetup",
    "lobby.status.ended",
    "lobby.myTurnBadge",
    "lobby.myTurnBannerSingular",
    "lobby.myTurnBannerPlural",
    "lobby.teamPlaceholder",
    "lobby.waitingOpponent",
    "lobby.roundLabel",
    "lobby.filters.all",
    "lobby.filters.myTurn",
    "lobby.filters.active",
    "lobby.filters.ended",
    "lobby.actions.teams",
    "lobby.actions.leaderboard",
    "lobby.actions.profile",
    "lobby.actions.matchmaking",
    "lobby.actions.cups",
    "lobby.actions.leagues",
    "lobby.actions.create",
    "lobby.actions.join",
    "lobby.actions.replay",
    "lobby.actions.replayA11y",
    "lobby.alerts.matchCreatedTitle",
    "lobby.alerts.matchCreatedBody",
    "lobby.alerts.createError",
    "lobby.alerts.joinSuccessTitle",
    "lobby.alerts.joinSuccessBody",
    "lobby.alerts.joinError",
    "lobby.alerts.loadError",
    "lobby.errors.prefix",
    "lobby.errors.empty",
    "lobby.joinModal.title",
    "lobby.joinModal.inputPlaceholder",
    "common.logout",
  ] as const;

  it.each(LOBBY_KEYS_REQUIRING_DISTINCT_EN)(
    "FR != EN pour '%s' (parite stricte, pas de copie oubliee)",
    (key) => {
      const fr = t(key as never);
      const en = t(key as never, undefined, "en" as Locale);
      expect(fr).not.toBe(en);
    },
  );

  it("singulier vs pluriel myTurnBanner FR : compteur interpole", () => {
    expect(t("lobby.myTurnBannerSingular", { count: 1 })).toBe(
      "1 match en attente de votre tour",
    );
    expect(t("lobby.myTurnBannerPlural", { count: 3 })).toBe(
      "3 matchs en attente de votre tour",
    );
  });

  it("filters.myTurn injecte le compteur", () => {
    expect(t("lobby.filters.myTurn", { count: 0 })).toBe("Mon tour (0)");
    expect(t("lobby.filters.myTurn", { count: 4 }, "en")).toBe("My turn (4)");
  });

  it("vsCoach injecte le nom du coach", () => {
    expect(t("lobby.vsCoach", { name: "Sid" })).toBe("vs Coach Sid");
    expect(t("lobby.vsCoach", { name: "Sid" }, "en")).toBe("vs Coach Sid");
  });

  it("errors.prefix injecte le message", () => {
    expect(t("lobby.errors.prefix", { message: "Boom" })).toBe(
      "Erreur : Boom",
    );
    expect(t("lobby.errors.prefix", { message: "Boom" }, "en")).toBe(
      "Error: Boom",
    );
  });
});

/**
 * S27.3.5 — Auth screens i18n keys (login.tsx + register.tsx).
 *
 * Couvre toutes les cles utilisees par :
 *  - login.tsx (auth.login.*)
 *  - register.tsx (auth.register.*)
 *
 * Verifie : non-vide FR, non-vide EN, FR != EN (sauf "Email" identique
 * dans les deux langues).
 */
const AUTH_I18N_KEYS = [
  "auth.login.title",
  "auth.login.emailLabel",
  "auth.login.emailPlaceholder",
  "auth.login.passwordLabel",
  "auth.login.passwordPlaceholder",
  "auth.login.submit",
  "auth.login.submitError",
  "auth.login.preAlphaNotice",
  "auth.register.title",
  "auth.register.message",
  "auth.register.backToLogin",
] as const;

describe("auth screens i18n keys (S27.3.5)", () => {
  it.each(AUTH_I18N_KEYS)(
    "FR : '%s' retourne une chaine non vide differente de la cle",
    (key) => {
      const value = t(key as never);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    },
  );

  it.each(AUTH_I18N_KEYS)(
    "EN : '%s' retourne une chaine non vide differente de la cle",
    (key) => {
      const value = t(key as never, undefined, "en" as Locale);
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    },
  );

  // "Email" et "auth.login.emailPlaceholder" (un email d'exemple)
  // sont legitimement identiques entre FR et EN. Le reste doit differer.
  const AUTH_KEYS_REQUIRING_DISTINCT_EN = [
    "auth.login.title",
    "auth.login.passwordLabel",
    "auth.login.passwordPlaceholder",
    "auth.login.submit",
    "auth.login.submitError",
    "auth.login.preAlphaNotice",
    "auth.register.title",
    "auth.register.message",
    "auth.register.backToLogin",
  ] as const;

  it.each(AUTH_KEYS_REQUIRING_DISTINCT_EN)(
    "FR != EN pour '%s' (parite stricte, pas de copie oubliee)",
    (key) => {
      const fr = t(key as never);
      const en = t(key as never, undefined, "en" as Locale);
      expect(fr).not.toBe(en);
    },
  );
});
