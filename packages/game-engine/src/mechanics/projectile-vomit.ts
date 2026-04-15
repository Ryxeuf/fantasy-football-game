/**
 * Mécanique de Vomissement Projectile (Projectile Vomit) pour Blood Bowl
 *
 * Règles BB2020/BB3 :
 * - Le joueur doit posséder le trait "Projectile Vomit"
 * - Action spéciale remplaçant un Blocage
 * - Cible adjacente unique (adversaire debout et actif)
 * - Jet de D6 : 2+ = succès, 1 = échec
 * - Succès : la cible est mise à terre → jet d'armure → jet de blessure si armure percée
 * - Mighty Blow s'applique au jet d'armure
 * - Échec : l'activation du joueur prend fin (PAS de turnover)
 */

import { GameState, Player, RNG, DiceResult } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { rollD6 } from '../utils/dice';
import { performArmorRoll } from '../utils/dice';
import { performInjuryRoll } from './injury';
import { createLogEntry } from '../utils/logging';
import { isAdjacent } from './movement';
import { getMightyBlowBonusFromRegistry, getArmorSkillContext } from '../skills/skill-bridge';
import { bounceBall } from './ball';

/**
 * Vérifie si un joueur peut utiliser Vomissement Projectile sur une cible
 */
export function canProjectileVomit(
  state: GameState,
  vomiter: Player,
  target: Player,
): boolean {
  // Le joueur doit avoir le trait Projectile Vomit
  if (!hasSkill(vomiter, 'projectile-vomit')) return false;
  // La cible doit être un adversaire
  if (vomiter.team === target.team) return false;
  // Adjacents
  if (!isAdjacent(vomiter.pos, target.pos)) return false;
  // La cible doit être debout et active
  if (target.stunned) return false;
  if (target.state !== undefined && target.state !== 'active') return false;

  return true;
}

/**
 * Exécute un Vomissement Projectile complet
 */
export function executeProjectileVomit(
  state: GameState,
  vomiter: Player,
  target: Player,
  rng: RNG,
): GameState {
  let newState = structuredClone(state) as GameState;

  // Log de l'action
  const actionLog = createLogEntry(
    'action',
    `${vomiter.name} tente un Vomissement Projectile sur ${target.name}`,
    vomiter.id,
    vomiter.team,
  );
  newState.gameLog = [...newState.gameLog, actionLog];

  // Jet de D6 : 2+ = succès, 1 = échec
  const diceRoll = rollD6(rng);
  const targetNumber = 2;
  const success = diceRoll >= targetNumber;

  const diceResult: DiceResult = {
    type: 'vomit',
    playerId: vomiter.id,
    diceRoll,
    targetNumber,
    success,
    modifiers: 0,
  };
  newState.lastDiceResult = diceResult;

  const rollLog = createLogEntry(
    'dice',
    `Jet de Vomissement Projectile de ${vomiter.name}: ${diceRoll}/${targetNumber} ${success ? '✓' : '✗'}`,
    vomiter.id,
    vomiter.team,
    { diceRoll, targetNumber },
  );
  newState.gameLog = [...newState.gameLog, rollLog];

  if (success) {
    // Succès : la cible est mise à terre
    const knockdownLog = createLogEntry(
      'action',
      `${target.name} est mis à terre par le Vomissement Projectile !`,
      target.id,
      target.team,
    );
    newState.gameLog = [...newState.gameLog, knockdownLog];

    // Mettre la cible à terre (stunned)
    const targetIdx = newState.players.findIndex(p => p.id === target.id);
    newState.players[targetIdx] = { ...newState.players[targetIdx], stunned: true };

    // Si la cible avait le ballon, elle le perd et le ballon rebondit
    if (newState.players[targetIdx].hasBall) {
      newState.players[targetIdx] = { ...newState.players[targetIdx], hasBall: false };
      const ballLossLog = createLogEntry(
        'action',
        `${target.name} perd le ballon !`,
        target.id,
        target.team,
      );
      newState.gameLog = [...newState.gameLog, ballLossLog];
      newState = bounceBall(newState, rng);
    }

    // Jet d'armure avec bonus Mighty Blow éventuel.
    // Iron Hard Skin annule les modificateurs positifs de l'attaquant
    // sur le jet d'armure (ex. Mighty Blow).
    const mightyBlowBonusRaw = getMightyBlowBonusFromRegistry(vomiter, newState);
    const { ironHardSkinActive } = getArmorSkillContext(
      newState,
      vomiter,
      newState.players[targetIdx],
    );
    const mightyBlowBonus = ironHardSkinActive ? 0 : mightyBlowBonusRaw;
    const armorResult = performArmorRoll(newState.players[targetIdx], rng, -mightyBlowBonus);
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

    // Si l'armure est percée (success = false), jet de blessure
    if (!armorResult.success) {
      newState = performInjuryRoll(newState, newState.players[targetIdx], rng, 0, vomiter.id);
    }
  } else {
    // Échec : l'activation du joueur prend fin (pm = 0), PAS de turnover
    newState.players = newState.players.map(p =>
      p.id === vomiter.id ? { ...p, pm: 0 } : p,
    );

    const failLog = createLogEntry(
      'action',
      `Le Vomissement Projectile de ${vomiter.name} échoue ! Son activation prend fin.`,
      vomiter.id,
      vomiter.team,
    );
    newState.gameLog = [...newState.gameLog, failLog];
  }

  return newState;
}
