/**
 * Mécanique de faute (foul) pour Blood Bowl
 * Permet de frapper un joueur au sol avec risque d'expulsion
 */

import { GameState, Player, RNG } from '../core/types';
import { rollD6 } from '../utils/dice';
import { isAdjacent, getAdjacentOpponents } from './movement';
import { createLogEntry } from '../utils/logging';
import { performInjuryRoll, handleSentOff } from './injury';
import { getFoulArmorSkillModifiers, getArmorSkillContext, isSneakyGitActive } from '../skills/skill-bridge';

/**
 * Vérifie si un joueur peut faire une faute sur une cible
 */
export function canFoul(state: GameState, attacker: Player, target: Player): boolean {
  // La cible doit être au sol (stunned)
  if (!target.stunned) return false;

  // La cible doit être adjacente
  if (!isAdjacent(attacker.pos, target.pos)) return false;

  // L'attaquant doit être de l'équipe active
  if (attacker.team !== state.currentPlayer) return false;

  // La cible doit être adverse
  if (target.team === attacker.team) return false;

  // L'attaquant ne doit pas être sonné
  if (attacker.stunned) return false;

  return true;
}

/**
 * Calcule les assists de foul (joueurs amis adjacents à la cible - joueurs adverses adjacents à la cible)
 */
export function calculateFoulAssists(state: GameState, attacker: Player, target: Player): number {
  let assists = 0;

  // Joueurs amis adjacents à la cible (hors attaquant)
  for (const player of state.players) {
    if (player.id === attacker.id) continue;
    if (player.team !== attacker.team) continue;
    if (player.stunned || player.state === 'knocked_out' || player.state === 'casualty') continue;
    if (isAdjacent(player.pos, target.pos)) {
      assists += 1;
    }
  }

  // Joueurs adverses adjacents à la cible (défenseurs, hors la cible elle-même)
  for (const player of state.players) {
    if (player.id === target.id) continue;
    if (player.team !== target.team) continue;
    if (player.stunned || player.state === 'knocked_out' || player.state === 'casualty') continue;
    if (isAdjacent(player.pos, target.pos)) {
      assists -= 1;
    }
  }

  return assists;
}

/**
 * Exécute une faute
 */
export function executeFoul(
  state: GameState,
  attacker: Player,
  target: Player,
  rng: RNG
): GameState {
  let newState = structuredClone(state) as GameState;

  const assists = calculateFoulAssists(newState, attacker, target);

  const foulLog = createLogEntry(
    'action',
    `${attacker.name} commet une faute sur ${target.name} (assists: ${assists >= 0 ? '+' : ''}${assists})`,
    attacker.id,
    attacker.team
  );
  newState.gameLog = [...newState.gameLog, foulLog];

  // Jet d'armure avec bonus d'assists + Dirty Player
  // Iron Hard Skin annule les modificateurs positifs de l'attaquant
  // (ex. Dirty Player). Les assists de foul ne sont PAS un modificateur
  // de skill de l'attaquant et restent appliqués.
  const die1 = rollD6(rng);
  const die2 = rollD6(rng);
  const dirtyPlayerBonusRaw = getFoulArmorSkillModifiers(newState, attacker);
  const { ironHardSkinActive } = getArmorSkillContext(newState, attacker, target);
  const dirtyPlayerBonus = ironHardSkinActive ? 0 : dirtyPlayerBonusRaw;
  const armorRoll = die1 + die2 + assists + dirtyPlayerBonus;
  const armorBroken = armorRoll >= target.av;

  const ihsTag = ironHardSkinActive ? ' [Iron Hard Skin]' : '';
  const dpTag = dirtyPlayerBonus > 0 ? ` [Dirty Player +${dirtyPlayerBonus}]` : '';
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure (foul): ${die1}+${die2}${assists !== 0 ? (assists > 0 ? '+' + assists : assists.toString()) : ''}${dpTag}${ihsTag} = ${armorRoll}/${target.av} ${armorBroken ? '✗ (percée)' : '✓ (tient)'}`,
    target.id,
    target.team,
    { die1, die2, assists, total: armorRoll, target: target.av, ironHardSkin: ironHardSkinActive }
  );
  newState.gameLog = [...newState.gameLog, armorLog];

  // Vérifier l'expulsion AVANT d'appliquer la blessure (doublet sur les dés bruts)
  const isDoubles = die1 === die2;

  if (armorBroken) {
    // Jet de blessure (l'attaquant est crédité pour la casualty)
    const targetPlayer = newState.players.find(p => p.id === target.id)!;
    newState = performInjuryRoll(newState, targetPlayer, rng, 0, attacker.id);
  }

  // Expulsion si doublet, sauf si l'attaquant possede Sneaky Git
  const sneakyGit = isSneakyGitActive(newState, attacker);
  if (isDoubles && !sneakyGit) {
    const attackerPlayer = newState.players.find(p => p.id === attacker.id);
    if (attackerPlayer) {
      const expulsionLog = createLogEntry(
        'action',
        `Doublet (${die1}-${die2}) ! ${attacker.name} est expulsé par l'arbitre !`,
        attacker.id,
        attacker.team
      );
      newState.gameLog = [...newState.gameLog, expulsionLog];
      newState = handleSentOff(newState, attackerPlayer);
    }
  } else if (isDoubles && sneakyGit) {
    const sneakyLog = createLogEntry(
      'action',
      `Doublet (${die1}-${die2}) ! ${attacker.name} evite l'expulsion grâce à Sneaky Git.`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, sneakyLog];
  }

  return newState;
}
