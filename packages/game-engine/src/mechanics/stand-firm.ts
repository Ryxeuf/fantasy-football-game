/**
 * Stand Firm (BB3 Season 2/3 rules).
 *
 * Quand un joueur avec Stand Firm est la cible d'une poussee (Push Back suite a
 * un PUSH_BACK, STUMBLE converti en PUSH_BACK, ou POW), il peut choisir de ne
 * PAS etre deplace. Il reste sur sa case actuelle.
 *
 * - Sur un POW, le joueur tombe quand meme sur sa case (le knockdown est
 *   resolu avant l'appel a la poussee).
 * - L'attaquant ne peut pas faire de follow-up puisque la cible ne bouge pas.
 * - Stand Firm empeche aussi d'etre pousse en chaine (chain push).
 * - Le joueur doit etre debout (pas stunned) pour utiliser Stand Firm.
 * - La regle est annulee si l'attaquant effectue un Blitz avec Juggernaut et
 *   que la cible est le joueur directement bloque.
 *
 * Utilisateurs principaux : Dwarf Deathroller, Human/Imperial Bodyguard,
 * Gnome Treeman, Ogre, Treeman, etc.
 *
 * On applique systematiquement Stand Firm quand il est disponible : ne pas
 * etre pousse est toujours au moins aussi avantageux que l'etre (la "may"
 * clause se resout automatiquement au profit du defenseur).
 */

import type { GameState, Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { isJuggernautActiveForBlock } from './juggernaut';

/**
 * Retourne vrai si le joueur possede le skill Stand Firm (accepte les
 * variantes de slug : stand-firm, stand_firm, "stand firm").
 */
export function hasStandFirm(player: Player): boolean {
  return (
    hasSkill(player, 'stand-firm') ||
    hasSkill(player, 'stand_firm') ||
    hasSkill(player, 'stand firm')
  );
}

/**
 * Retourne vrai si Stand Firm est actif pour bloquer une poussee sur `target`
 * par `attacker`.
 *
 * Conditions :
 *  - La cible possede Stand Firm.
 *  - La cible est debout (pas stunned/prone).
 *  - L'attaquant n'utilise pas Juggernaut sur un Blitz (auquel cas
 *    Stand Firm est annule sur le defenseur direct).
 */
export function isStandFirmActiveForBlock(
  state: GameState,
  attacker: Player,
  target: Player,
): boolean {
  if (!hasStandFirm(target)) return false;
  if (target.stunned) return false;
  if (isJuggernautActiveForBlock(state, attacker)) return false;
  return true;
}

/**
 * Retourne vrai si Stand Firm est actif pour empecher un chain push sur
 * `player`.
 *
 * Juggernaut n'affecte que le defenseur direct, donc on ne le verifie pas ici.
 */
export function isStandFirmActiveForChainPush(player: Player): boolean {
  if (!hasStandFirm(player)) return false;
  if (player.stunned) return false;
  return true;
}
