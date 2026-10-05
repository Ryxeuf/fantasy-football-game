/**
 * Lot 3 « cerveau du coach » — MODÈLE DE PROBABILITÉ des jets.
 *
 * Toutes les fonctions sont pures et rendent une probabilité de SUCCÈS dans
 * [0, 1], relances de compétence comprises (Esquive, Pieds sûrs, Prise sûre,
 * Passe, Réception). Les cibles sont calculées par le moteur lui-même
 * (`calculateDodgeTarget`, `calculatePickupTarget`, modificateurs de zones de
 * tacle, de compétences et de météo) pour que le coach raisonne sur les
 * mêmes règles que celles qu'on lui applique.
 *
 * Les blocages rendent deux probabilités indépendantes (cible au sol,
 * attaquant au sol) selon le nombre de dés et le choisisseur.
 */

import {
  calculateCatchModifiers,
  calculateDefensiveAssists,
  calculateOffensiveAssists,
  calculateDodgeModifiers,
  calculateDodgeTarget,
  calculatePassModifiers,
  calculatePickupModifiers,
  calculatePickupTarget,
  canAttemptPassForRange,
  getAdjacentOpponents,
  getDodgeSkillModifiers,
  getGfiCap,
  getPassRange,
  getWeatherModifiers,
  hasSkill,
} from '@bb/game-engine';
import type { GameState, Player, Position } from '@bb/game-engine';

/** Probabilité qu'un D6 fasse au moins `target` (un 1 échoue toujours). */
export function pD6(target: number): number {
  const t = Math.max(2, Math.min(6, Math.round(target)));
  return (7 - t) / 6;
}

/** Probabilité que 2D6 fassent au moins `target`. */
export function p2D6(target: number): number {
  if (target <= 2) return 1;
  if (target > 12) return 0;
  let ways = 0;
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= target) ways++;
  return ways / 36;
}

/** Une relance (compétence ou équipe) : deux essais indépendants. */
export function withReroll(p: number, hasReroll: boolean): number {
  return hasReroll ? p + (1 - p) * p : p;
}

function weatherAgility(state: GameState): number {
  return getWeatherModifiers(state.weatherCondition).agilityModifier;
}

/** Un adversaire adjacent à `from` porte Tacle (annule la relance Esquive). */
function tacklerAdjacent(state: GameState, from: Position, team: Player['team']): boolean {
  return getAdjacentOpponents(state, from, team).some((o) => hasSkill(o, 'tackle'));
}

/** Succès d'une esquive de `from` vers `to` (relance Esquive comprise). */
export function dodgeSuccess(
  state: GameState,
  player: Player,
  from: Position,
  to: Position,
): number {
  const mods =
    calculateDodgeModifiers(state, from, to, player.team) +
    getDodgeSkillModifiers(state, player, from) +
    weatherAgility(state);
  const p = pD6(calculateDodgeTarget(player, mods));
  const dodgeReroll = hasSkill(player, 'dodge') && !tacklerAdjacent(state, from, player.team);
  return withReroll(p, dodgeReroll);
}

/** Succès d'un GFI (2+, météo, relance Pieds sûrs). */
export function gfiSuccess(state: GameState, player: Player): number {
  const mod = getWeatherModifiers(state.weatherCondition).gfiModifier;
  const p = pD6(2 - mod);
  return withReroll(p, hasSkill(player, 'sure-feet'));
}

/** Nombre de GFI encore disponibles pour ce joueur. */
export function gfiRemaining(state: GameState, player: Player): number {
  return Math.max(0, getGfiCap(state, player) - (player.gfiUsed ?? 0));
}

/** Succès d'un ramassage en `ballPos` (relance Prise sûre comprise). */
export function pickupSuccess(state: GameState, player: Player, ballPos: Position): number {
  if (hasSkill(player, 'no-hands')) return 0;
  const mods = calculatePickupModifiers(state, ballPos, player.team, player) + weatherAgility(state);
  const p = pD6(calculatePickupTarget(player, mods));
  return withReroll(p, hasSkill(player, 'sure-hands'));
}

/** Succès du JET de passe vers `targetPos` (relance Passe comprise), 0 si hors portée. */
export function passRollSuccess(state: GameState, passer: Player, targetPos: Position): number {
  const range = getPassRange(passer.pos, targetPos);
  if (!range || !canAttemptPassForRange(passer, range)) return 0;
  const weather = getWeatherModifiers(state.weatherCondition);
  if (weather.maxPassRange) {
    const order = ['quick', 'short', 'long', 'bomb'];
    if (order.indexOf(range) > order.indexOf(weather.maxPassRange)) return 0;
  }
  const mods = calculatePassModifiers(state, passer, targetPos) + weather.passingModifier;
  const target = passer.pa <= 0 ? 6 : Math.max(2, Math.min(6, passer.pa - mods));
  const p = passer.pa <= 0 ? 1 / 6 : pD6(target);
  return withReroll(p, hasSkill(passer, 'pass'));
}

/** Succès d'une réception (passe précise : +1 ; relance Réception comprise). */
export function catchSuccess(state: GameState, catcher: Player, accurate = true): number {
  if (hasSkill(catcher, 'no-hands')) return 0;
  const mods = calculateCatchModifiers(state, catcher) + (accurate ? 1 : 0) + weatherAgility(state);
  const p = pD6(Math.max(2, Math.min(6, catcher.ag - mods)));
  return withReroll(p, hasSkill(catcher, 'catch'));
}

/** Passe complète : jet de passe puis réception. */
export function passSuccess(state: GameState, passer: Player, receiver: Player): number {
  return passRollSuccess(state, passer, receiver.pos) * catchSuccess(state, receiver, true);
}

export interface BlockDice {
  readonly dice: 1 | 2 | 3;
  readonly chooser: 'attacker' | 'defender';
  readonly attackerStrength: number;
  readonly defenderStrength: number;
}

/**
 * Dés d'un blocage de `attacker` (supposé en `attackerPos`) sur `target`,
 * avec les soutiens TELS QUE LE MOTEUR LES COMPTE (`calculateOffensiveAssists`
 * / `calculateDefensiveAssists`) : un coéquipier n'assiste que s'il est
 * debout, qu'il lui reste des PM et qu'aucun autre adversaire ne le marque
 * (sauf Garde). Un modèle maison divergeait — le coach annonçait deux dés
 * là où le moteur n'en lançait qu'un (95 blocages à un dé par six matchs,
 * un tiers d'attaquants au sol).
 */
export function blockDice(
  state: GameState,
  attacker: Player,
  target: Player,
  isBlitz: boolean,
  attackerPos: Position = attacker.pos,
): BlockDice {
  const virtual: Player = attackerPos === attacker.pos ? attacker : { ...attacker, pos: attackerPos };
  const virtualState: GameState =
    virtual === attacker ? state : { ...state, players: state.players.map((p) => (p.id === attacker.id ? virtual : p)) };
  const atk =
    attacker.st +
    calculateOffensiveAssists(virtualState, virtual, target) +
    (isBlitz && hasSkill(attacker, 'horns') ? 1 : 0);
  const def = target.st + calculateDefensiveAssists(virtualState, virtual, target);
  if (atk >= 2 * def) return { dice: 3, chooser: 'attacker', attackerStrength: atk, defenderStrength: def };
  if (atk > def) return { dice: 2, chooser: 'attacker', attackerStrength: atk, defenderStrength: def };
  if (atk === def) return { dice: 1, chooser: 'attacker', attackerStrength: atk, defenderStrength: def };
  if (def >= 2 * atk) return { dice: 3, chooser: 'defender', attackerStrength: atk, defenderStrength: def };
  return { dice: 2, chooser: 'defender', attackerStrength: atk, defenderStrength: def };
}

export interface BlockOutcomeProbabilities {
  /** La cible est mise au sol. */
  readonly knockdown: number;
  /** L'attaquant est mis au sol (turnover). */
  readonly selfDown: number;
  readonly dice: BlockDice;
}

/**
 * Issue d'un blocage : POW 1/6, Esquive ratée 1/6, Repoussé 2/6, Deux au
 * sol 1/6, Crâne 1/6 par dé ; l'attaquant choisit le meilleur de ses dés
 * (le défenseur le pire quand c'est lui qui choisit).
 */
export function blockOutcome(
  state: GameState,
  attacker: Player,
  target: Player,
  isBlitz: boolean,
  attackerPos: Position = attacker.pos,
): BlockOutcomeProbabilities {
  const dice = blockDice(state, attacker, target, isBlitz, attackerPos);
  const targetDodges = hasSkill(target, 'dodge') && !hasSkill(attacker, 'tackle');
  const targetBlock = hasSkill(target, 'block');
  const attackerSafe = hasSkill(attacker, 'block') || hasSkill(attacker, 'wrestle');
  const kdDie = 1 / 6 + (targetDodges ? 0 : 1 / 6) + (targetBlock ? 0 : 1 / 6);
  const selfDie = 1 / 6 + (attackerSafe ? 0 : 1 / 6);
  const n = dice.dice;
  if (dice.chooser === 'attacker') {
    return {
      knockdown: 1 - Math.pow(1 - kdDie, n),
      selfDown: Math.pow(selfDie, n),
      dice,
    };
  }
  return {
    knockdown: Math.pow(kdDie, n),
    selfDown: 1 - Math.pow(1 - selfDie, n),
    dice,
  };
}

/** Probabilité que l'armure de `target` cède (2D6 ≥ AV + 1, Minus −1, modificateur en plus). */
export function armourBreak(target: Player, modifier = 0): number {
  const av = target.av + (hasSkill(target, 'stunty') ? -1 : 0);
  return p2D6(av + 1 - modifier);
}
