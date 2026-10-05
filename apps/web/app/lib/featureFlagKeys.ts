/**
 * Clés de feature flags utilisées côté client.
 * Miroir de `apps/server/src/services/featureFlags.ts`.
 *
 * À garder synchronisé manuellement avec le backend.
 */
export const ONLINE_PLAY_FLAG = "online_play" as const;
export const AI_TRAINING_FLAG = "ai_training" as const;
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

/**
 * Exports PDF imprimables des ligues et des coupes (journée, classement,
 * tops, calendrier, play-offs, statistiques, feuille de rencontre).
 *
 * OFF par défaut (2026-09-27) : en recette avant ouverture. Les admins le
 * voient par bypass de rôle ; un testeur s'active par override utilisateur.
 * Tant qu'il est OFF, l'export de journée historique garde son ancien rendu.
 *
 * À garder synchronisé avec
 * `apps/server/src/services/featureFlags.ts.COMPETITION_PDF_EXPORTS_FLAG`.
 */
export const COMPETITION_PDF_EXPORTS_FLAG = "competition_pdf_exports" as const;

/**
 * Bandeau « À la une » de la home (résultats de ligue et de coupe publiques,
 * dernier article, inscriptions ouvertes).
 *
 * OFF par défaut (2026-09-28) : en recette. Admins par bypass de rôle,
 * testeurs par override utilisateur. Gate aussi la route serveur.
 *
 * À garder synchronisé avec
 * `apps/server/src/services/featureFlags.ts.HOME_NEWS_TICKER_FLAG`.
 */
export const HOME_NEWS_TICKER_FLAG = "home_news_ticker" as const;

/**
 * Thèmes de dés (Dé de Blocage + D6) : sélecteur dans le profil et thème
 * choisi appliqué partout où un dé est dessiné.
 *
 * OFF par défaut (2026-09-29) : en recette. 36 thèmes (dé original, 4
 * déclinaisons, 31 équipes), les payants achetables derrière `CROWNS_FLAG`.
 * OFF, tout le monde voit le dé ORIGINAL et aucune requête n'est faite.
 * Gate aussi la route serveur `/dice-themes`.
 *
 * À garder synchronisé avec
 * `apps/server/src/services/featureFlags.ts.DICE_THEMES_FLAG`.
 */
export const DICE_THEMES_FLAG = "dice_themes" as const;

/**
 * Couronnes (Crowns) : solde et historique sur le profil coach, achat de
 * thèmes de dés. Miroir de
 * `apps/server/src/services/featureFlags.ts.CROWNS_FLAG`.
 */
export const CROWNS_FLAG = "crowns" as const;
