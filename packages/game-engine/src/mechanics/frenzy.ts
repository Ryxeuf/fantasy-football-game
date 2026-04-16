/**
 * Frenzy (Frénésie) — compétence BB3 Season 2/3.
 *
 * Règle officielle :
 *   "Un joueur possédant cette compétence doit toujours suivre (follow-up)
 *    après un blocage. De plus, si la cible est repoussée mais pas mise à
 *    terre, le joueur doit suivre et effectuer immédiatement un second blocage
 *    contre la même cible."
 *
 * Notes d'implémentation :
 *   - Le follow-up est OBLIGATOIRE quand Frenzy est actif sur un PUSH_BACK.
 *   - Le second bloc utilise les mêmes règles (assists, dés, etc.) que le
 *     premier, recalculées après le follow-up.
 *   - Si le second bloc produit un PUSH_BACK, il n'y a PAS de troisième bloc.
 *   - `state.pendingFrenzyBlock` signal au moteur qu'un second bloc est requis.
 *     Il est résolu dans `applyMove` après le follow-up.
 *   - Frenzy ne se déclenche PAS si la cible est mise à terre (STUMBLE sans
 *     Dodge, POW, BOTH_DOWN) ou si l'attaquant tombe (PLAYER_DOWN, BOTH_DOWN).
 */

import type { Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';

/**
 * Vérifie si un joueur possède le skill Frenzy.
 */
export function hasFrenzy(player: Player): boolean {
  return hasSkill(player, 'frenzy');
}
