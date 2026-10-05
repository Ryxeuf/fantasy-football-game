/**
 * Lot 3 « cerveau du coach » — RÔLES des joueurs, dérivés du poste et des
 * compétences (pas d'étiquette stockée : un Trois-quart qui apprend Blocage
 * devient bloqueur, un receveur avec Esquive devient l'option de percée).
 */

import { hasSkill } from '@bb/game-engine';
import type { Player } from '@bb/game-engine';

export type PlayerRole =
  | 'bigguy'
  | 'fouler'
  | 'thrower'
  | 'catcher'
  | 'blitzer'
  | 'blocker'
  | 'lineman';

const CATCHER_RE = /receveur|catcher|coureur|runner|gutter|flanker|ailier|wardancer|danseur|gobelin|goblin|halfling|snotling/i;
const THROWER_RE = /lanceur|thrower|passeur/i;
const BLITZER_RE = /blitzer|chevaucheur|cavalier/i;
const BLOCKER_RE = /bloqueur|blocker|orque noir|black orc|nain|dwarf|bull centaur|saurus|saurien|mummy|momie|golem|chaos warrior|guerrier du chaos|ogre|troll|minotaur|rat ogre|tree|arbre/i;

export function isBigGuy(player: Player): boolean {
  return (
    player.st >= 5 ||
    hasSkill(player, 'loner-4') ||
    hasSkill(player, 'loner-5') ||
    hasSkill(player, 'really-stupid') ||
    hasSkill(player, 'bone-head') ||
    hasSkill(player, 'unchannelled-fury')
  );
}

export function deriveRole(player: Player): PlayerRole {
  if (isBigGuy(player)) return 'bigguy';
  const name = player.position;
  if (hasSkill(player, 'sneaky-git') || hasSkill(player, 'dirty-player')) return 'fouler';
  if (hasSkill(player, 'pass') || THROWER_RE.test(name)) return 'thrower';
  if (CATCHER_RE.test(name) || hasSkill(player, 'catch') || (player.ag <= 2 && player.ma >= 7)) {
    return 'catcher';
  }
  if (BLITZER_RE.test(name) || (hasSkill(player, 'block') && player.ma >= 6)) return 'blitzer';
  if (
    BLOCKER_RE.test(name) ||
    hasSkill(player, 'block') ||
    hasSkill(player, 'guard') ||
    hasSkill(player, 'tackle') ||
    hasSkill(player, 'mighty-blow') ||
    player.st >= 4
  ) {
    return 'blocker';
  }
  return 'lineman';
}

/**
 * Aptitude à PORTER le ballon (plus haut = meilleur porteur). Négatif pour
 * les joueurs qu'on ne veut pas voir avec le ballon.
 */
export function carrierAptitude(player: Player): number {
  if (hasSkill(player, 'no-hands')) return -1000;
  const role = deriveRole(player);
  let score = (6 - player.ag) * 10; // AG 2+ ⇒ 40, AG 4+ ⇒ 20
  if (hasSkill(player, 'sure-hands')) score += 40;
  if (hasSkill(player, 'dodge')) score += 12;
  if (hasSkill(player, 'block')) score += 8;
  if (hasSkill(player, 'stunty')) score -= 15;
  if (hasSkill(player, 'loner-3') || hasSkill(player, 'loner-4') || hasSkill(player, 'loner-5')) score -= 30;
  switch (role) {
    case 'thrower':
      score += 20;
      break;
    case 'catcher':
      score += 18;
      break;
    case 'blitzer':
      score += 10;
      break;
    case 'bigguy':
      score -= 80;
      break;
    case 'fouler':
      score -= 10;
      break;
    default:
      break;
  }
  return score;
}
