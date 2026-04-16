/**
 * Mécanique de Poignard (Stab) pour Blood Bowl — BB3 Season 2/3.
 *
 * Règles :
 * - Le joueur doit posséder le trait "Stab".
 * - Action spéciale remplaçant un Blocage : cible adjacente (adversaire debout et actif).
 * - Aucun dé de bloc n'est lancé ni assistance de Force appliquée.
 * - Jet d'armure direct (2D6) contre la cible. Mighty Blow s'applique au jet
 *   d'armure si le Stabber possède le trait.
 * - Armure percée → jet de blessure. Mighty Blow ne s'applique PAS à la blessure.
 * - La cible n'est pas mise à terre (reste debout si l'armure tient ou si la
 *   blessure n'aboutit qu'à un état "stunned" via la table de blessure).
 * - Stab NE provoque PAS de turnover (sauf interaction balle gérée en aval
 *   via la table de blessure).
 * - L'activation du Stabber prend fin immédiatement après le Stab (pm = 0).
 */

import { GameState, Player, RNG } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { performArmorRoll } from '../utils/dice';
import { performInjuryRoll } from './injury';
import { createLogEntry } from '../utils/logging';
import { isAdjacent } from './movement';
import { getMightyBlowBonusFromRegistry, getArmorSkillContext } from '../skills/skill-bridge';

/**
 * Indique si un joueur peut utiliser Stab sur une cible donnée.
 */
export function canStab(
  state: GameState,
  stabber: Player,
  target: Player,
): boolean {
  if (!hasSkill(stabber, 'stab')) return false;
  if (stabber.team === target.team) return false;
  if (!isAdjacent(stabber.pos, target.pos)) return false;
  if (target.stunned) return false;
  if (target.state !== undefined && target.state !== 'active') return false;
  return true;
}

/**
 * Exécute une action Stab : jet d'armure direct (+ blessure si armure percée).
 */
export function executeStab(
  state: GameState,
  stabber: Player,
  target: Player,
  rng: RNG,
): GameState {
  let newState = structuredClone(state) as GameState;

  // Log d'action
  const actionLog = createLogEntry(
    'action',
    `${stabber.name} tente un Poignard sur ${target.name}`,
    stabber.id,
    stabber.team,
  );
  newState.gameLog = [...newState.gameLog, actionLog];

  // Jet d'armure direct, avec bonus Mighty Blow éventuel.
  // Iron Hard Skin annule les modificateurs positifs de l'attaquant
  // sur le jet d'armure (ex. Mighty Blow).
  const mightyBlowBonusRaw = getMightyBlowBonusFromRegistry(stabber, newState);
  const { ironHardSkinActive } = getArmorSkillContext(newState, stabber, target);
  const mightyBlowBonus = ironHardSkinActive ? 0 : mightyBlowBonusRaw;
  const armorResult = performArmorRoll(target, rng, -mightyBlowBonus);
  newState.lastDiceResult = armorResult;

  const ihsTag = ironHardSkinActive ? ' [Iron Hard Skin]' : '';
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure de ${target.name}: ${armorResult.diceRoll}/${armorResult.targetNumber}${ihsTag} ${armorResult.success ? '(tient)' : '(percée)'}`,
    target.id,
    target.team,
    { diceRoll: armorResult.diceRoll, targetNumber: armorResult.targetNumber, mightyBlowBonus, ironHardSkin: ironHardSkinActive },
  );
  newState.gameLog = [...newState.gameLog, armorLog];

  // Si armure percée, jet de blessure
  if (!armorResult.success) {
    const currentTarget = newState.players.find(p => p.id === target.id);
    if (currentTarget) {
      newState = performInjuryRoll(newState, currentTarget, rng, 0, stabber.id);
    }
  }

  // L'activation du Stabber prend fin
  newState.players = newState.players.map(p =>
    p.id === stabber.id ? { ...p, pm: 0 } : p,
  );

  return newState;
}
