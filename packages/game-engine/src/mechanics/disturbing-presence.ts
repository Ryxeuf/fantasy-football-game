/**
 * Disturbing Presence (Presence Perturbante) — BB3 Season 2/3.
 *
 * Quand un joueur adverse effectue une action de Passe, Lancer d'Equipier,
 * Lancer de Bombe, ou tente d'intercepter une passe / receptionner le ballon,
 * il subit un modificateur de -1 par joueur adverse possedant cette
 * competence situe a 3 cases ou moins de lui (distance de Chebyshev).
 *
 * Un joueur au sol, stunned, KO, blesse, expulse ou hypnotise n'exerce pas
 * sa presence perturbante (il ne peut plus utiliser ses competences).
 *
 * La resolution concrete est cablee dans `passing.ts` (pass / catch /
 * interception) et `throw-team-mate.ts`.
 */

import type { GameState, Player, Position, TeamId } from '../core/types';
import { hasSkill } from '../skills/skill-effects';

/** Portee de la competence (en cases, distance de Chebyshev). */
export const DISTURBING_PRESENCE_RANGE = 3;

/** Retourne vrai si le joueur possede la competence Disturbing Presence. */
export function hasDisturbingPresence(player: Player): boolean {
  return hasSkill(player, 'disturbing-presence') || hasSkill(player, 'disturbing_presence');
}

/**
 * Indique si ce joueur peut exercer sa presence perturbante :
 * il doit etre sur le terrain et actif (ni stunned, ni KO, ni casualty,
 * ni expulse, ni hypnotise).
 */
function canExertDisturbingPresence(state: GameState, player: Player): boolean {
  if (player.stunned) return false;
  const s = player.state;
  if (s === 'knocked_out' || s === 'casualty' || s === 'sent_off') return false;
  const hypnotized = state.hypnotizedPlayers ?? [];
  if (hypnotized.includes(player.id)) return false;
  return true;
}

/** Distance de Chebyshev entre deux positions. */
function chebyshev(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Retourne le modificateur (negatif ou zero) a appliquer a un jet de Passe,
 * Lancer d'Equipier, Interception ou Reception effectue par un joueur de
 * `team` a la position `position`.
 *
 * -1 par joueur adverse avec Disturbing Presence eligible dans un rayon de 3
 * cases. Les coequipiers avec le skill ne comptent pas.
 */
export function getDisturbingPresenceModifier(
  state: GameState,
  position: Position,
  team: TeamId,
): number {
  let modifier = 0;
  for (const player of state.players) {
    if (player.team === team) continue;
    if (!hasDisturbingPresence(player)) continue;
    if (!canExertDisturbingPresence(state, player)) continue;
    if (chebyshev(player.pos, position) > DISTURBING_PRESENCE_RANGE) continue;
    modifier -= 1;
  }
  return modifier;
}
