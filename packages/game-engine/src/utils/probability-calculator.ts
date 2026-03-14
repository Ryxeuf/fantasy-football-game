/**
 * Simulateur de probabilités pour Blood Bowl
 * Calcule en temps réel les probabilités de succès avant chaque action
 */

import { GameState, Player, Position, TeamId } from '../core/types';
import { getAdjacentOpponents } from '../mechanics/movement';

/**
 * Résultat de calcul de probabilité pour une action
 */
export interface ActionProbability {
  action: string;
  probability: number;        // 0-1
  displayPercent: string;     // "83%"
  risk: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  details: string;
  breakdown?: ProbabilityBreakdown[];
}

export interface ProbabilityBreakdown {
  step: string;
  probability: number;
  cumulative: number;
}

/**
 * Calcule la probabilité d'un jet D6 >= target
 */
function d6Probability(target: number): number {
  const clamped = Math.max(1, Math.min(7, target));
  if (clamped <= 1) return 1;
  if (clamped >= 7) return 0;
  return (7 - clamped) / 6;
}

/**
 * Calcule la probabilité d'un jet 2D6 >= target
 */
function twoD6Probability(target: number): number {
  if (target <= 2) return 1;
  if (target > 12) return 0;
  // Distribution 2D6
  const combos = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]; // index = total
  let successes = 0;
  for (let i = target; i <= 12; i++) {
    successes += combos[i];
  }
  return successes / 36;
}

/**
 * Catégorise le niveau de risque
 */
function riskLevel(prob: number): 'safe' | 'low' | 'medium' | 'high' | 'critical' {
  if (prob >= 0.83) return 'safe';
  if (prob >= 0.67) return 'low';
  if (prob >= 0.50) return 'medium';
  if (prob >= 0.30) return 'high';
  return 'critical';
}

/**
 * Calcule la probabilité de réussir un mouvement
 */
export function calculateMoveProbability(
  state: GameState,
  player: Player,
  to: Position
): ActionProbability {
  const breakdown: ProbabilityBreakdown[] = [];
  let cumulative = 1;

  // Vérifier si un dodge est nécessaire
  const opponentsAtFrom = getAdjacentOpponents(state, player.pos, player.team);
  const needsDodge = opponentsAtFrom.length > 0;

  // Vérifier si c'est un GFI
  const isGFI = player.pm <= 0;

  if (needsDodge) {
    const opponentsAtTo = getAdjacentOpponents(state, to, player.team);
    const modifiers = -opponentsAtTo.length;
    const target = Math.max(2, Math.min(6, player.ag - modifiers));
    const dodgeProb = d6Probability(target);
    cumulative *= dodgeProb;
    breakdown.push({
      step: `Esquive (${target}+ sur D6, ${opponentsAtTo.length} adversaires)`,
      probability: dodgeProb,
      cumulative,
    });
  }

  if (isGFI) {
    const gfiProb = d6Probability(2); // 2+ = 83.3%
    cumulative *= gfiProb;
    breakdown.push({
      step: 'GFI (2+ sur D6)',
      probability: gfiProb,
      cumulative,
    });
  }

  // Vérifier si le joueur ramasse le ballon
  if (state.ball && state.ball.x === to.x && state.ball.y === to.y) {
    const opponentsAtBall = getAdjacentOpponents(state, to, player.team);
    const pickupMod = -opponentsAtBall.length;
    const pickupTarget = Math.max(2, Math.min(6, player.ag - pickupMod));
    const pickupProb = d6Probability(pickupTarget);
    cumulative *= pickupProb;
    breakdown.push({
      step: `Ramassage (${pickupTarget}+ sur D6)`,
      probability: pickupProb,
      cumulative,
    });
  }

  const details = breakdown.length === 0
    ? 'Mouvement sûr (pas de jet requis)'
    : breakdown.map(b => `${b.step}: ${(b.probability * 100).toFixed(0)}%`).join(' → ');

  return {
    action: 'move',
    probability: cumulative,
    displayPercent: `${(cumulative * 100).toFixed(0)}%`,
    risk: riskLevel(cumulative),
    details,
    breakdown,
  };
}

/**
 * Calcule la probabilité de réussir un bloc
 */
export function calculateBlockProbability(
  state: GameState,
  attacker: Player,
  target: Player,
  offensiveAssists: number,
  defensiveAssists: number
): ActionProbability {
  const atkST = attacker.st + offensiveAssists;
  const defST = target.st + defensiveAssists;

  let diceCount: number;
  let favorable: boolean;

  if (atkST >= defST * 2) {
    diceCount = 3; favorable = true;
  } else if (atkST > defST) {
    diceCount = 2; favorable = true;
  } else if (atkST === defST) {
    diceCount = 1; favorable = true;
  } else if (atkST * 2 <= defST) {
    diceCount = 3; favorable = false;
  } else {
    diceCount = 2; favorable = false;
  }

  // Probabilité de ne pas tomber (pas de PLAYER_DOWN ni BOTH_DOWN sans Block)
  // Dé de bloc : 1=PD, 2=BD, 3=PB, 4=ST, 5=POW, 6=PB
  // "Bons" résultats pour l'attaquant : PB(2/6), ST(1/6), POW(1/6) = 4/6
  // "Mauvais" pour l'attaquant : PD(1/6), BD(1/6) = 2/6
  const hasBlock = attacker.skills.some(s => s.toLowerCase() === 'block');
  const goodResults = hasBlock ? 5 : 4; // Block transforme BD en neutre
  const probGoodOneDie = goodResults / 6;
  const probBadOneDie = 1 - probGoodOneDie;

  let probability: number;
  if (favorable) {
    // Attaquant choisit le meilleur
    probability = 1 - Math.pow(probBadOneDie, diceCount);
  } else {
    // Défenseur choisit le pire
    probability = Math.pow(probGoodOneDie, diceCount);
  }

  const details = `${diceCount} dé(s), ${favorable ? 'attaquant' : 'défenseur'} choisit (${atkST} vs ${defST} ST)${hasBlock ? ' [Block]' : ''}`;

  return {
    action: 'block',
    probability,
    displayPercent: `${(probability * 100).toFixed(0)}%`,
    risk: riskLevel(probability),
    details,
  };
}

/**
 * Calcule la probabilité de réussir une passe
 */
export function calculatePassProbability(
  state: GameState,
  passer: Player,
  target: Player
): ActionProbability {
  const dist = Math.max(Math.abs(passer.pos.x - target.pos.x), Math.abs(passer.pos.y - target.pos.y));
  let rangeMod = 0;
  let rangeName = '';
  if (dist <= 3) { rangeMod = 1; rangeName = 'Rapide'; }
  else if (dist <= 6) { rangeMod = 0; rangeName = 'Courte'; }
  else if (dist <= 10) { rangeMod = -1; rangeName = 'Longue'; }
  else if (dist <= 13) { rangeMod = -2; rangeName = 'Bombe'; }
  else { return { action: 'pass', probability: 0, displayPercent: '0%', risk: 'critical', details: 'Hors de portée' }; }

  const opponentsNearPasser = getAdjacentOpponents(state, passer.pos, passer.team);
  const passMod = rangeMod - opponentsNearPasser.length;
  const passTarget = Math.max(2, Math.min(6, passer.pa - passMod));
  const passProb = d6Probability(passTarget);

  const opponentsNearCatcher = getAdjacentOpponents(state, target.pos, target.team);
  const catchMod = -opponentsNearCatcher.length;
  const catchTarget = Math.max(2, Math.min(6, target.ag - catchMod));
  const catchProb = d6Probability(catchTarget);

  const totalProb = passProb * catchProb;
  const details = `Passe ${rangeName} (${passTarget}+) → Réception (${catchTarget}+)`;

  return {
    action: 'pass',
    probability: totalProb,
    displayPercent: `${(totalProb * 100).toFixed(0)}%`,
    risk: riskLevel(totalProb),
    details,
    breakdown: [
      { step: `Passe ${rangeName} (${passTarget}+)`, probability: passProb, cumulative: passProb },
      { step: `Réception (${catchTarget}+)`, probability: catchProb, cumulative: totalProb },
    ],
  };
}

/**
 * Calcule la probabilité de réussir une faute
 */
export function calculateFoulProbability(
  target: Player,
  foulAssists: number
): ActionProbability {
  // Armor break on 2D6 + assists >= AV
  const armorTarget = target.av - foulAssists;
  const armorBreakProb = twoD6Probability(armorTarget);

  // Expulsion on doubles: 6/36 = 16.7%
  const expulsionProb = 6 / 36;

  const details = `Armure ${armorTarget}+ sur 2D6 (${(armorBreakProb * 100).toFixed(0)}% de percer), 17% d'expulsion`;

  return {
    action: 'foul',
    probability: armorBreakProb,
    displayPercent: `${(armorBreakProb * 100).toFixed(0)}%`,
    risk: riskLevel(armorBreakProb * (1 - expulsionProb)),
    details,
  };
}

/**
 * Calcule toutes les probabilités pour les actions d'un joueur
 */
export function calculateAllProbabilities(
  state: GameState,
  player: Player
): ActionProbability[] {
  const results: ActionProbability[] = [];

  // Mouvement vers chaque case adjacente
  const dirs = [
    { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
    { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
  ];

  for (const d of dirs) {
    const to = { x: player.pos.x + d.x, y: player.pos.y + d.y };
    if (to.x < 0 || to.x >= state.width || to.y < 0 || to.y >= state.height) continue;
    const occupied = state.players.some(p => p.pos.x === to.x && p.pos.y === to.y);
    if (occupied) continue;

    const prob = calculateMoveProbability(state, player, to);
    if (prob.probability < 1) {
      results.push({ ...prob, action: `move(${to.x},${to.y})` });
    }
  }

  return results;
}
