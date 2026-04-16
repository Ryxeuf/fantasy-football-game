/**
 * Fend (BB3 Season 2/3 rules).
 *
 * Quand un joueur avec Fend est pousse (Push Back) suite a un Block, l'attaquant
 * ne peut pas faire de follow-up. Fend s'applique sur un resultat PUSH_BACK ou
 * sur un STUMBLE converti en PUSH_BACK par Dodge.
 *
 * La regle ne s'applique PAS si le joueur avec Fend est mis au sol par le
 * blocage (POW, ou STUMBLE sans Dodge) : dans ce cas le joueur est stunned
 * avant la resolution de la poussee, donc Fend n'est pas actif.
 *
 * La regle est annulee si l'attaquant effectue un Blitz avec Juggernaut et que
 * la cible est le joueur directement bloque.
 *
 * Utilisateurs principaux (5 equipes prioritaires) : Imperial Retainer Lineman
 * (Noblesse Imperiale), ainsi que Wood Elf Wardancer, certains Catchers, etc.
 *
 * On applique systematiquement Fend quand il est disponible : empecher le
 * follow-up de l'attaquant est toujours au moins aussi avantageux que de
 * l'autoriser (la "may" clause se resout automatiquement au profit du
 * defenseur).
 *
 * L'implementation se limite ici a exposer les predicats ; le cablage dans le
 * flux de blocage vit dans `blocking.ts` et `actions.ts` (handlePushChoose).
 */

import type { GameState, Player } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { isJuggernautActiveForBlock } from './juggernaut';

/**
 * Retourne vrai si le joueur possede le skill Fend (accepte les variantes de
 * slug : fend, "Fend").
 */
export function hasFend(player: Player): boolean {
  return hasSkill(player, 'fend');
}

/**
 * Retourne vrai si Fend empeche le follow-up de `attacker` apres une poussee
 * de `target`.
 *
 * Conditions :
 *  - La cible possede Fend.
 *  - La cible est debout (pas stunned/prone). Si elle est au sol, elle ne peut
 *    pas utiliser Fend (regle BB2020).
 *  - L'attaquant n'utilise pas Juggernaut sur un Blitz (auquel cas Fend est
 *    annule sur le defenseur direct).
 */
export function isFendActiveForFollowUp(
  state: GameState,
  attacker: Player,
  target: Player,
): boolean {
  if (!hasFend(target)) return false;
  if (target.stunned) return false;
  if (isJuggernautActiveForBlock(state, attacker)) return false;
  return true;
}
