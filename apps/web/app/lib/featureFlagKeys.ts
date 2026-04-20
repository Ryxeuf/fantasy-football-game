/**
 * Clés de feature flags utilisées côté client.
 * Miroir de `apps/server/src/services/featureFlags.ts`.
 *
 * À garder synchronisé manuellement avec le backend.
 */
export const ONLINE_PLAY_FLAG = "online_play" as const;
export const AI_TRAINING_FLAG = "ai_training" as const;
