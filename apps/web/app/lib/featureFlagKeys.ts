/**
 * Clés de feature flags utilisées côté client.
 * Miroir de `apps/server/src/services/featureFlags.ts`.
 *
 * À garder synchronisé manuellement avec le backend.
 */
export const ONLINE_PLAY_FLAG = "online_play" as const;
export const AI_TRAINING_FLAG = "ai_training" as const;
/**
 * Brique "Ligue" Blood Bowl — flag unique qui gate TOUTE la fonctionnalité
 * ligue : accès au hub /leagues, création/édition, admin saison, inscription,
 * calendrier interactif, level-up de roster, et la section "Ligues" du menu
 * admin. Flag dédié, distinct d'`online_play`, pour activer la ligue
 * indépendamment de la partie en ligne. À garder synchronisé avec
 * `apps/server/src/services/featureFlags.ts.LEAGUE_FLAG`.
 *
 * Note historique : `leagues_v2_ui` (ancien flag qui gatait séparément les
 * écrans v2) a été fusionné dans ce flag — il n'existe plus qu'un seul flag.
 */
export const LEAGUE_FLAG = "league" as const;
/**
 * Nuffle Coach (fantasy NFL) — gate l'UI publique : menu, sous-nav,
 * pages user (catalogue players, fiche player, standings, draft, about).
 * Doit etre synchronise avec `apps/server/src/services/featureFlags.ts.NUFFLE_COACH_FLAG`.
 */
export const NUFFLE_COACH_FLAG = "nuffle_coach" as const;

/**
 * Nuffle Coach — bac a sable de test. Quand actif, l'UI debloque le
 * selecteur saison/cycle dans /nfl-fantasy/new et permet de creer des
 * championnats sur des cycles deja demarres ou termines (utile pour
 * simuler des saisons avec stats reelles deja en base).
 * Synchronise avec `apps/server/src/services/featureFlags.ts.NUFFLE_COACH_TEST_FLAG`.
 */
export const NUFFLE_COACH_TEST_FLAG = "nuffle_coach_test" as const;

/**
 * Partie offline (« Match Local ») — gate le hub `/local-matches`, la
 * création d'une partie, la saisie des actions et le lien de partage, ainsi
 * que les entrées de menu et les cartes d'accueil qui y mènent.
 *
 * OFF par défaut (2026-09-11) : la brique n'est pas mûre et fait doublon
 * avec la FEUILLE DE MATCH, qui est le chemin de saisie d'un résultat de
 * ligue comme de coupe. Les admins gardent leur bypass de rôle pour
 * administrer les parties déjà enregistrées.
 *
 * À garder synchronisé avec
 * `apps/server/src/services/featureFlags.ts.OFFLINE_MATCH_FLAG`.
 */
export const OFFLINE_MATCH_FLAG = "offline_match" as const;
