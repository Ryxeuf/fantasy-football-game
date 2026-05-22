/**
 * Clés de feature flags utilisées côté client.
 * Miroir de `apps/server/src/services/featureFlags.ts`.
 *
 * À garder synchronisé manuellement avec le backend.
 */
export const ONLINE_PLAY_FLAG = "online_play" as const;
export const AI_TRAINING_FLAG = "ai_training" as const;
/**
 * Sprint Ligues v2 (PR2) — gate les nouveaux ecrans frontend de
 * gestion de ligue (creation, edition, admin saison, inscription,
 * calendrier interactif). Doit etre synchronise avec
 * `apps/server/src/services/featureFlags.ts.LEAGUES_V2_UI_FLAG`.
 */
export const LEAGUES_V2_UI_FLAG = "leagues_v2_ui" as const;
/**
 * Nuffle Coach (fantasy NFL) — gate l'UI publique : menu, sous-nav,
 * pages user (catalogue players, fiche player, standings, draft, about).
 * Doit etre synchronise avec `apps/server/src/services/featureFlags.ts.NUFFLE_COACH_FLAG`.
 */
export const NUFFLE_COACH_FLAG = "nuffle_coach" as const;
