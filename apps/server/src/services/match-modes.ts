/**
 * Constantes du champ libre `Match.mode`.
 *
 * Module volontairement minimal (zero dependance) pour pouvoir etre importe
 * depuis les routes "chaudes" (`/me/matches`, `/match/my-matches`) sans tirer
 * tout le pipeline ligue.
 */

/** Match synthetique materialise depuis une saisie offline (tabletop). */
export const OFFLINE_MATCH_MODE = "offline";
