/**
 * Kick skill (BB3 Season 2/3 rules).
 *
 * Si l'equipe qui botte a un joueur avec Kick sur le terrain au moment ou le
 * coup d'envoi est resolu, le coach peut choisir de diviser par deux le resultat
 * du D6 qui determine le nombre de cases de deviation du ballon
 * (arrondi a l'entier inferieur).
 *
 * Conditions d'eligibilite du joueur Kick :
 *  - Le joueur possede le skill `kick`.
 *  - Il est sur le terrain (pos.x >= 0), c'est-a-dire pas dans la reserve
 *    ni au dugout (KO, blesse, expulse).
 *  - Il n'est pas place sur la Ligne de Scrimmage (LoS : x=12 pour l'equipe A,
 *    x=13 pour l'equipe B).
 *  - Il n'est pas place dans une Wide Zone (y=0..2 ou y=12..14).
 *
 * Le projet applique automatiquement l'effet des qu'un joueur eligible est
 * present : reduire la deviation est toujours au moins aussi avantageux pour
 * l'equipe qui botte (cela reduit l'incertitude du placement du ballon).
 *
 * Arrondi : 1 -> 0, 2 -> 1, 3 -> 1, 4 -> 2, 5 -> 2, 6 -> 3.
 */

import type { GameState, Player, TeamId } from '../core/types';
import { hasSkill } from '../skills/skill-effects';

/** Line of Scrimmage column for a given team on a 26-wide pitch. */
const LOS_X: Record<TeamId, number> = { A: 12, B: 13 };

/** Wide zones along the Y axis on a 15-high pitch. */
function isWideZone(y: number): boolean {
  return y <= 2 || y >= 12;
}

/**
 * Retourne vrai si le joueur est un candidat valide pour declencher l'effet
 * du skill Kick sur le kickoff en cours.
 */
export function isEligibleKickPlayer(player: Player, team: TeamId): boolean {
  if (player.team !== team) return false;
  if (!hasSkill(player, 'kick')) return false;
  if (player.pos.x < 0) return false; // hors terrain (reserves, dugout)
  if (player.pos.x === LOS_X[team]) return false; // sur la LoS
  if (isWideZone(player.pos.y)) return false; // dans une wide zone
  return true;
}

/**
 * Retourne vrai si l'equipe `team` possede au moins un joueur eligible pour
 * reduire la deviation du ballon au coup d'envoi.
 */
export function hasEligibleKickPlayer(state: GameState, team: TeamId): boolean {
  return state.players.some(p => isEligibleKickPlayer(p, team));
}

/**
 * Divise par deux le D6 de deviation, en arrondissant a l'entier inferieur.
 * L'entree attendue est un jet de D6 valide (1..6). Les valeurs hors de cette
 * plage sont tronquees a [0, 3] apres division, pour rester dans un intervalle
 * raisonnable.
 */
export function halveScatterD6(d6: number): number {
  if (!Number.isFinite(d6) || d6 <= 0) return 0;
  return Math.floor(d6 / 2);
}

/**
 * Applique le skill Kick sur le D6 de deviation : retourne le D6 reduit si
 * l'equipe `kickingTeam` a un joueur Kick eligible, sinon le D6 d'origine.
 */
export function applyKickSkillToDeviation(
  state: GameState,
  kickingTeam: TeamId,
  d6: number
): { d6: number; applied: boolean } {
  if (!hasEligibleKickPlayer(state, kickingTeam)) {
    return { d6, applied: false };
  }
  return { d6: halveScatterD6(d6), applied: true };
}
