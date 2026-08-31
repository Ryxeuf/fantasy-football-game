/**
 * Valeurs d'environnement attendues par les specs, dans le processus de test.
 *
 * Le SERVEUR, lui, est démarré et arrêté par `global-setup.ts` : un
 * `setupFiles` s'exécute une fois par fichier de test et ne reçoit jamais
 * d'appel de `teardown`.
 */
const API_PORT = process.env.API_PORT || "18001";

// Active par défaut tous les feature flags pour la suite intégration.
// Cf. apps/server/src/services/featureFlags.ts. Sans ceci, les routes gatées
// par requireFeatureFlag (online_play, ai_training, etc.) renvoient 403.
if (process.env.FEATURE_FLAGS_FORCE_ENABLED === undefined) {
  process.env.FEATURE_FLAGS_FORCE_ENABLED = "true";
}

// Les specs lisent `API_BASE` pour construire leurs URLs : sans ça, elles
// retombaient sur le port de DEV (8201) et ne touchaient jamais le serveur
// de test qui vient d'être démarré.
if (!process.env.API_BASE) {
  process.env.API_BASE = `http://localhost:${API_PORT}`;
}
