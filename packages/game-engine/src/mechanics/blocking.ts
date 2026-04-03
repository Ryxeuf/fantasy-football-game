/**
 * Système de blocage pour Blood Bowl
 * Gère les blocages, les assists, les dés de blocage et la résolution des résultats
 */

import {
  GameState,
  Position,
  TeamId,
  BlockResult,
  BlockDiceResult,
  RNG,
  Player,
} from '../core/types';
import { isAdjacent, inBounds, isPositionOccupied } from './movement';
import { hasGuard, blockNegatesBothDown, dodgeNegatesStumble, getMightyBlowBonus, wrestleOnBothDown } from '../skills/skill-effects';
import { performArmorRoll, roll2D6 } from '../utils/dice';
import { performArmorRollWithNotification } from '../utils/dice-notifications';
import { createLogEntry } from '../utils/logging';
import { canTeamBlitz } from '../core/game-state';
import { performInjuryRoll, handleSentOff, handleInjuryByCrowd } from './injury';

/**
 * Effectue le jet d'armure + blessure avec Mighty Blow.
 * Mighty Blow (+1) s'applique soit au jet d'armure, soit au jet de blessure.
 * Stratégie optimale : si l'armure casse naturellement, le bonus est gardé pour la blessure.
 */
function armorAndInjuryWithMightyBlow(
  state: GameState,
  victim: Player,
  attacker: Player,
  rng: RNG
): GameState {
  const mbBonus = getMightyBlowBonus(attacker);
  const diceRoll = roll2D6(rng);
  const armorTarget = victim.av;

  const armorBrokenNaturally = diceRoll >= armorTarget;
  const armorBrokenWithMB = (diceRoll + mbBonus) >= armorTarget;

  let armorBroken: boolean;
  let mbUsedOnArmor: boolean;

  if (armorBrokenNaturally) {
    armorBroken = true;
    mbUsedOnArmor = false; // Garder MB pour la blessure
  } else if (armorBrokenWithMB) {
    armorBroken = true;
    mbUsedOnArmor = true;
  } else {
    armorBroken = false;
    mbUsedOnArmor = true; // Dépensé sur l'armure (sans effet)
  }

  // Log du jet d'armure
  const effectiveRoll = mbUsedOnArmor ? diceRoll + mbBonus : diceRoll;
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure: ${effectiveRoll}/${armorTarget} ${armorBroken ? '✗ (percée)' : '✓ (tient)'}${mbBonus > 0 && mbUsedOnArmor ? ' [Mighty Blow +1]' : ''}`,
    victim.id,
    victim.team,
    {
      diceRoll: effectiveRoll,
      targetNumber: armorTarget,
      success: !armorBroken,
      mightyBlow: mbBonus > 0,
      mightyBlowAppliedTo: mbUsedOnArmor ? 'armor' : 'injury',
    }
  );
  state.gameLog = [...state.gameLog, armorLog];

  state.lastDiceResult = {
    type: 'armor',
    playerId: victim.id,
    diceRoll: effectiveRoll,
    targetNumber: armorTarget,
    success: !armorBroken,
    modifiers: mbUsedOnArmor ? mbBonus : 0,
  };

  if (armorBroken) {
    const injuryBonus = mbUsedOnArmor ? 0 : mbBonus;
    state = performInjuryRoll(state, victim, rng, injuryBonus, attacker.id);
  }

  return state;
}

/**
 * Vérifie si un joueur peut effectuer un blocage
 * @param state - État du jeu
 * @param playerId - ID du joueur attaquant
 * @param targetId - ID du joueur cible
 * @returns True si le blocage est possible
 */
export function canBlock(state: GameState, playerId: string, targetId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  const target = state.players.find(p => p.id === targetId);

  if (!player || !target) return false;

  // Le joueur doit être debout et non étourdi
  if (player.stunned || player.pm <= 0) return false;

  // La cible doit être debout et non étourdie
  if (target.stunned || target.pm <= 0) return false;

  // Les joueurs doivent être adjacents
  if (!isAdjacent(player.pos, target.pos)) return false;

  // Les joueurs doivent être d'équipes différentes
  if (player.team === target.team) return false;

  return true;
}

/**
 * Vérifie si un joueur peut effectuer un blitz
 * @param state - État du jeu
 * @param attackerId - ID du joueur attaquant
 * @param to - Position de destination
 * @param targetId - ID du joueur cible
 * @returns True si le blitz est possible
 */
export function canBlitz(
  state: GameState,
  attackerId: string,
  to: Position,
  targetId: string
): boolean {
  const attacker = state.players.find(p => p.id === attackerId);
  const target = state.players.find(p => p.id === targetId);

  if (!attacker || !target) return false;

  // Vérifier que c'est le tour de l'équipe du joueur
  if (attacker.team !== state.currentPlayer) return false;

  // Vérifier que l'équipe n'a pas déjà utilisé son blitz ce tour
  if (!canTeamBlitz(state, attacker.team)) return false;

  // Vérifier que l'attaquant peut bouger (pas étourdi, a des PM)
  if (attacker.stunned || attacker.pm <= 0) return false;

  // Vérifier que la cible n'est pas étourdie
  if (target.stunned) return false;

  // Vérifier que les joueurs sont d'équipes différentes
  if (attacker.team === target.team) return false;

  // Vérifier que la position de destination est valide
  if (!inBounds(state, to)) return false;

  // Vérifier que la position de destination n'est pas occupée
  const occupied = state.players.some(p => p.pos.x === to.x && p.pos.y === to.y);
  if (occupied) return false;

  // Vérifier que le joueur a assez de PM pour le mouvement ET le blocage (le blocage coûte 1 PM supplémentaire)
  const distance = Math.abs(attacker.pos.x - to.x) + Math.abs(attacker.pos.y - to.y);
  if (attacker.pm < distance + 1) return false; // +1 pour le blocage

  // Vérifier que la cible sera adjacente après le mouvement
  return isAdjacent(to, target.pos);
}

/**
 * Calcule les assists offensives pour un blocage
 * @param state - État du jeu
 * @param attacker - Joueur attaquant
 * @param target - Joueur cible
 * @returns Nombre d'assists offensives
 */
export function calculateOffensiveAssists(
  state: GameState,
  attacker: Player,
  target: Player
): number {
  let assists = 0;

  // Trouver tous les coéquipiers de l'attaquant qui marquent la cible
  const teammates = state.players.filter(
    p => p.team === attacker.team && p.id !== attacker.id && !p.stunned && p.pm > 0
  );

  for (const teammate of teammates) {
    // Le coéquipier doit marquer la cible
    if (isAdjacent(teammate.pos, target.pos)) {
      // Guard : un joueur avec Guard peut assister même s'il est marqué par d'autres adversaires
      if (hasGuard(teammate)) {
        assists++;
      } else {
        // Vérifier que le coéquipier n'est pas marqué par un autre adversaire que la cible
        const opponentsMarkingTeammate = getAdjacentOpponents(state, teammate.pos, teammate.team);
        const isMarkedByOtherThanTarget = opponentsMarkingTeammate.some(opp => opp.id !== target.id);

        if (!isMarkedByOtherThanTarget) {
          assists++;
        }
      }
    }
  }

  return assists;
}

/**
 * Calcule les assists défensives pour un blocage
 * @param state - État du jeu
 * @param attacker - Joueur attaquant
 * @param target - Joueur cible
 * @returns Nombre d'assists défensives
 */
export function calculateDefensiveAssists(
  state: GameState,
  attacker: Player,
  target: Player
): number {
  let assists = 0;

  // Trouver tous les coéquipiers de la cible qui marquent l'attaquant
  const teammates = state.players.filter(
    p => p.team === target.team && p.id !== target.id && !p.stunned && p.pm > 0
  );

  for (const teammate of teammates) {
    // Le coéquipier doit marquer l'attaquant
    if (isAdjacent(teammate.pos, attacker.pos)) {
      // Guard : un joueur avec Guard peut assister même s'il est marqué par d'autres adversaires
      if (hasGuard(teammate)) {
        assists++;
      } else {
        // Vérifier que le coéquipier n'est pas marqué par un autre adversaire que l'attaquant
        const opponentsMarkingTeammate = getAdjacentOpponents(state, teammate.pos, teammate.team);
        const isMarkedByOtherThanAttacker = opponentsMarkingTeammate.some(
          opp => opp.id !== attacker.id
        );

        if (!isMarkedByOtherThanAttacker) {
          assists++;
        }
      }
    }
  }

  return assists;
}

/**
 * Trouve tous les adversaires adjacents à une position
 * @param state - État du jeu
 * @param position - Position de référence
 * @param team - Équipe du joueur (pour identifier les adversaires)
 * @returns Liste des adversaires adjacents
 */
function getAdjacentOpponents(state: GameState, position: Position, team: TeamId): Player[] {
  const opponents: Player[] = [];
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: 1, y: 1 },
    { x: 1, y: -1 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
  ];

  for (const dir of dirs) {
    const checkPos = { x: position.x + dir.x, y: position.y + dir.y };
    const opponent = state.players.find(
      p => p.team !== team && p.pos.x === checkPos.x && p.pos.y === checkPos.y && !p.stunned
    );
    if (opponent) {
      opponents.push(opponent);
    }
  }

  return opponents;
}

/**
 * Calcule le nombre de dés de blocage à lancer
 * @param attackerStrength - Force totale de l'attaquant
 * @param targetStrength - Force totale de la cible
 * @returns Nombre de dés à lancer
 */
export function calculateBlockDiceCount(attackerStrength: number, targetStrength: number): number {
  if (attackerStrength < targetStrength / 2) {
    return 3; // 3 dés, le défenseur choisit
  } else if (attackerStrength < targetStrength) {
    return 2; // 2 dés, le défenseur choisit
  } else if (attackerStrength === targetStrength) {
    return 1; // 1 dé
  } else if (attackerStrength < targetStrength * 2) {
    return 2; // 2 dés, l'attaquant choisit
  } else {
    return 3; // 3 dés, l'attaquant choisit
  }
}

/**
 * Détermine qui choisit le résultat des dés de blocage
 * @param attackerStrength - Force totale de l'attaquant
 * @param targetStrength - Force totale de la cible
 * @returns "attacker" ou "defender"
 */
export function getBlockDiceChooser(
  attackerStrength: number,
  targetStrength: number
): 'attacker' | 'defender' {
  if (attackerStrength < targetStrength) {
    return 'defender';
  } else {
    return 'attacker';
  }
}

/**
 * Obtient la direction de poussée de base
 * @param attackerPos - Position de l'attaquant
 * @param targetPos - Position de la cible
 * @returns Direction normalisée de poussée
 */
export function getPushDirection(attackerPos: Position, targetPos: Position): Position {
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;

  // Normaliser la direction
  const normalizedX = dx === 0 ? 0 : dx / Math.abs(dx);
  const normalizedY = dy === 0 ? 0 : dy / Math.abs(dy);

  return { x: normalizedX, y: normalizedY };
}

/**
 * Obtient les directions possibles de poussée
 * @param attackerPos - Position de l'attaquant
 * @param targetPos - Position de la cible
 * @returns Liste des directions de poussée possibles
 */
export function getPushDirections(attackerPos: Position, targetPos: Position): Position[] {
  const dx = targetPos.x - attackerPos.x;
  const dy = targetPos.y - attackerPos.y;

  // Normaliser la direction de l'attaquant vers la cible
  const normalizedX = dx === 0 ? 0 : Math.sign(dx);
  const normalizedY = dy === 0 ? 0 : Math.sign(dy);

  // Les directions de poussée sont dans la direction opposée à l'attaquant
  // (la cible est poussée dans la direction opposée à l'attaquant)
  const pushX = normalizedX === 0 ? 0 : -normalizedX;
  const pushY = normalizedY === 0 ? 0 : -normalizedY;

  const directions: Position[] = [];

  // Direction directe (opposée à l'attaquant)
  directions.push({ x: pushX, y: pushY });

  // Calculer les directions à 45° de la direction directe
  if (pushX !== 0 && pushY !== 0) {
    // Si on est en diagonale, les directions à 45° sont les directions cardinales
    directions.push({ x: pushX, y: 0 });
    directions.push({ x: 0, y: pushY });
  } else if (pushX !== 0) {
    // Si on est horizontal, les directions à 45° sont les diagonales
    directions.push({ x: pushX, y: 1 });
    directions.push({ x: pushX, y: -1 });
  } else if (pushY !== 0) {
    // Si on est vertical, les directions à 45° sont les diagonales
    directions.push({ x: 1, y: pushY });
    directions.push({ x: -1, y: pushY });
  }

  return directions;
}

/**
 * Gère la poussée avec choix de direction
 * @param state - État du jeu
 * @param attacker - Joueur attaquant
 * @param target - Joueur cible
 * @param blockResult - Résultat du blocage
 * @returns Nouvel état du jeu
 */
export function handlePushWithChoice(
  state: GameState,
  attacker: Player,
  target: Player,
  blockResult: string,
  rng: RNG
): GameState {
  const pushDirections = getPushDirections(attacker.pos, target.pos);
  const availableDirections: Position[] = [];
  let hasOutOfBounds = false;

  for (const dir of pushDirections) {
    const newPos = {
      x: target.pos.x + dir.x,
      y: target.pos.y + dir.y,
    };
    if (!inBounds(state, newPos)) {
      hasOutOfBounds = true;
    } else if (!isPositionOccupied(state, newPos)) {
      availableDirections.push(dir);
    }
  }

  if (availableDirections.length === 0 && hasOutOfBounds) {
    // Surf! Le joueur est poussé dans la foule
    const surfLog = createLogEntry(
      'action',
      `${target.name} est poussé dans la foule par ${attacker.name} !`,
      attacker.id,
      attacker.team
    );
    const newState = { ...state, gameLog: [...state.gameLog, surfLog] };

    // Gérer le ballon si le joueur surfé le portait
    if (target.hasBall) {
      newState.players = newState.players.map(p =>
        p.id === target.id ? { ...p, hasBall: false } : p
      );
      newState.ball = { ...target.pos };
      // Note: bounceBall sera appelé par la fonction appelante
    }

    // Blessure automatique par la foule (pas de jet d'armure, minimum KO)
    const resultState = handleInjuryByCrowd(newState, target, rng);

    // L'attaquant peut suivre (follow-up) sur la case liberee
    resultState.players = resultState.players.map(p =>
      p.id === attacker.id ? { ...p, pos: target.pos } : p
    );

    return resultState;
  } else if (availableDirections.length === 0) {
    // Aucune direction disponible (toutes occupées, aucune hors limites) - pas de poussée possible
    const noPushLog = createLogEntry(
      'action',
      `${target.name} ne peut pas être repoussé (aucune case libre)`,
      attacker.id,
      attacker.team
    );
    return { ...state, gameLog: [...state.gameLog, noPushLog] };
  } else if (availableDirections.length === 1) {
    // Une seule direction disponible - pousser automatiquement
    const pushDirection = availableDirections[0];
    const newTargetPos = {
      x: target.pos.x + pushDirection.x,
      y: target.pos.y + pushDirection.y,
    };

    const newState = { ...state };
    newState.players = newState.players.map(p =>
      p.id === target.id ? { ...p, pos: newTargetPos } : p
    );

    // Demander confirmation pour le follow-up
    newState.pendingFollowUpChoice = {
      attackerId: attacker.id,
      targetId: target.id,
      targetNewPosition: newTargetPos,
      targetOldPosition: target.pos,
    };

    const pushLog = createLogEntry(
      'action',
      `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y})`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, pushLog];

    return newState;
  } else {
    // Plusieurs directions disponibles - l'attaquant doit choisir
    const newState = { ...state };
    newState.pendingPushChoice = {
      attackerId: attacker.id,
      targetId: target.id,
      availableDirections,
      blockResult: blockResult as BlockResult,
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 3,
      targetStrength: 2,
    };

    const choiceLog = createLogEntry(
      'action',
      `${attacker.name} doit choisir la direction de poussée pour ${target.name}`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, choiceLog];

    return newState;
  }
}

/**
 * Résout un résultat de blocage
 * @param state - État du jeu
 * @param blockResult - Résultat du blocage
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état du jeu après résolution
 */
export function resolveBlockResult(
  state: GameState,
  blockResult: BlockDiceResult,
  rng: RNG
): GameState {
  const attacker = state.players.find(p => p.id === blockResult.playerId);
  const target = state.players.find(p => p.id === blockResult.targetId);

  if (!attacker || !target) return state;

  const newState = structuredClone(state) as GameState;

  // Log du résultat de blocage
  const blockLogEntry = createLogEntry(
    'dice',
    `Blocage: ${blockResult.result} (${blockResult.totalStrength} vs ${blockResult.targetStrength})`,
    attacker.id,
    attacker.team,
    {
      result: blockResult.result,
      attackerStrength: blockResult.totalStrength,
      targetStrength: blockResult.targetStrength,
      offensiveAssists: blockResult.offensiveAssists,
      defensiveAssists: blockResult.defensiveAssists,
    }
  );
  newState.gameLog = [...newState.gameLog, blockLogEntry];

  switch (blockResult.result) {
    case 'PLAYER_DOWN':
      return handlePlayerDown(newState, attacker, target, rng);
    case 'BOTH_DOWN':
      return handleBothDown(newState, attacker, target, rng);
    case 'PUSH_BACK':
      return handlePushBack(newState, attacker, target, rng);
    case 'STUMBLE':
      return handleStumble(newState, attacker, target, rng);
    case 'POW':
      return handlePow(newState, attacker, target, rng);
    default:
      return newState;
  }
}

/**
 * Gère le résultat PLAYER_DOWN
 */
function handlePlayerDown(state: GameState, attacker: Player, target: Player, rng: RNG): GameState {
  // L'attaquant est mis au sol
  state.players = state.players.map(p => (p.id === attacker.id ? { ...p, stunned: true } : p));
  state.isTurnover = true;

  // Log de la chute de l'attaquant
  const attackerDownLog = createLogEntry(
    'action',
    `${attacker.name} est mis au sol par ${target.name}`,
    attacker.id,
    attacker.team
  );
  state.gameLog = [...state.gameLog, attackerDownLog];

  // Jet d'armure pour l'attaquant
  const attackerArmorResult = performArmorRollWithNotification(attacker, rng);
  state.lastDiceResult = attackerArmorResult;

  // Log du jet d'armure
  const attackerArmorLog = createLogEntry(
    'dice',
    `Jet d'armure: ${attackerArmorResult.diceRoll}/${attackerArmorResult.targetNumber} ${attackerArmorResult.success ? '✓' : '✗'}`,
    attacker.id,
    attacker.team,
    {
      diceRoll: attackerArmorResult.diceRoll,
      targetNumber: attackerArmorResult.targetNumber,
      success: attackerArmorResult.success,
    }
  );
  state.gameLog = [...state.gameLog, attackerArmorLog];

  // Si l'armure est percée (success = false), faire un jet de blessure
  if (!attackerArmorResult.success) {
    state = performInjuryRoll(state, attacker, rng);
  }

  // Si l'attaquant avait le ballon, le perdre
  if (attacker.hasBall) {
    state.players = state.players.map(p => (p.id === attacker.id ? { ...p, hasBall: false } : p));
    state.ball = { ...attacker.pos };
    // Note: bounceBall sera appelé par la fonction appelante
  }

  return state;
}

/**
 * Gère le résultat BOTH_DOWN
 * Wrestle : si l'un des joueurs a Wrestle, les deux sont mis au sol (pas de jet d'armure, pas de turnover)
 * Block : un joueur avec Block peut choisir de ne pas tomber sur BOTH_DOWN
 * Wrestle prévaut sur Block (BB2020)
 */
function handleBothDown(state: GameState, attacker: Player, target: Player, rng: RNG): GameState {
  const attackerHasWrestle = wrestleOnBothDown(attacker);
  const targetHasWrestle = wrestleOnBothDown(target);
  const wrestleActive = attackerHasWrestle || targetHasWrestle;

  // Wrestle: les deux tombent, pas de jet d'armure, pas de turnover
  if (wrestleActive) {
    state.players = state.players.map(p => {
      if (p.id === attacker.id) return { ...p, stunned: true };
      if (p.id === target.id) return { ...p, stunned: true };
      return p;
    });

    const wrestleUser = attackerHasWrestle ? attacker.name : target.name;
    const wrestleLog = createLogEntry(
      'action',
      `Les Deux Plaqués — ${wrestleUser} utilise Wrestle : ${attacker.name} et ${target.name} sont mis au sol (pas de jet d'armure)`,
      attacker.id,
      attacker.team
    );
    state.gameLog = [...state.gameLog, wrestleLog];

    // Pas de turnover avec Wrestle
    // Pas de jets d'armure

    // Si l'attaquant avait le ballon, il le perd
    if (attacker.hasBall) {
      state.players = state.players.map(p => (p.id === attacker.id ? { ...p, hasBall: false } : p));
      state.ball = { ...attacker.pos };
    }

    // Si le défenseur avait le ballon, il le perd
    if (target.hasBall) {
      state.players = state.players.map(p => (p.id === target.id ? { ...p, hasBall: false } : p));
      state.ball = { ...target.pos };
    }

    return state;
  }

  // Comportement standard Block
  const attackerHasBlock = blockNegatesBothDown(attacker);
  const targetHasBlock = blockNegatesBothDown(target);

  // Déterminer qui tombe
  const attackerFalls = !attackerHasBlock;
  const targetFalls = !targetHasBlock;

  // Si personne ne tombe (les deux ont Block), simple push ou rien
  if (!attackerFalls && !targetFalls) {
    const blockLog = createLogEntry(
      'action',
      `Les Deux Plaqués — ${attacker.name} (Block) et ${target.name} (Block) restent debout`,
      attacker.id,
      attacker.team
    );
    state.gameLog = [...state.gameLog, blockLog];
    // Pas de turnover si l'attaquant ne tombe pas
    return state;
  }

  // Mettre au sol ceux qui tombent
  state.players = state.players.map(p => {
    if (p.id === attacker.id && attackerFalls) return { ...p, stunned: true };
    if (p.id === target.id && targetFalls) return { ...p, stunned: true };
    return p;
  });

  // Turnover uniquement si l'attaquant tombe
  if (attackerFalls) {
    state.isTurnover = true;
  }

  // Log
  const bothDownLog = createLogEntry(
    'action',
    attackerHasBlock && !targetHasBlock
      ? `Les Deux Plaqués — ${attacker.name} (Block) reste debout, ${target.name} tombe`
      : !attackerHasBlock && targetHasBlock
        ? `Les Deux Plaqués — ${attacker.name} tombe, ${target.name} (Block) reste debout`
        : `${attacker.name} et ${target.name} tombent tous les deux`,
    attacker.id,
    attacker.team
  );
  state.gameLog = [...state.gameLog, bothDownLog];

  // Jets d'armure pour ceux qui tombent
  if (attackerFalls) {
    // Pas de Mighty Blow du défenseur sur l'attaquant (MB ne s'applique qu'au joueur bloqué)
    const attackerArmorResult = performArmorRollWithNotification(attacker, rng);
    state.lastDiceResult = attackerArmorResult;
    const attackerArmorLog = createLogEntry(
      'dice',
      `Jet d'armure attaquant: ${attackerArmorResult.diceRoll}/${attackerArmorResult.targetNumber} ${attackerArmorResult.success ? '✓' : '✗'}`,
      attacker.id,
      attacker.team,
      { diceRoll: attackerArmorResult.diceRoll, targetNumber: attackerArmorResult.targetNumber, success: attackerArmorResult.success }
    );
    state.gameLog = [...state.gameLog, attackerArmorLog];
    if (!attackerArmorResult.success) {
      state = performInjuryRoll(state, attacker, rng);
    }
  }

  if (targetFalls) {
    // Mighty Blow de l'attaquant s'applique au jet d'armure/blessure de la cible
    state = armorAndInjuryWithMightyBlow(state, target, attacker, rng);
  }

  // Si l'attaquant avait le ballon et tombe, le perdre
  if (attacker.hasBall && attackerFalls) {
    state.players = state.players.map(p => (p.id === attacker.id ? { ...p, hasBall: false } : p));
    state.ball = { ...attacker.pos };
    // Note: bounceBall sera appelé par la fonction appelante
  }

  return state;
}

/**
 * Gère le résultat PUSH_BACK
 */
function handlePushBack(state: GameState, attacker: Player, target: Player, rng: RNG): GameState {
  // La cible est repoussée d'une case - vérifier les directions disponibles
  const pushDirections = getPushDirections(attacker.pos, target.pos);
  const availableDirections: Position[] = [];
  let hasOutOfBounds = false;

  for (const pushDirection of pushDirections) {
    const newTargetPos = {
      x: target.pos.x + pushDirection.x,
      y: target.pos.y + pushDirection.y,
    };

    if (!inBounds(state, newTargetPos)) {
      hasOutOfBounds = true;
    } else if (!isPositionOccupied(state, newTargetPos)) {
      availableDirections.push(pushDirection);
    }
  }

  if (availableDirections.length === 0 && hasOutOfBounds) {
    // Surf! Le joueur est poussé dans la foule
    const surfLog = createLogEntry(
      'action',
      `${target.name} est poussé dans la foule par ${attacker.name} !`,
      attacker.id,
      attacker.team
    );
    state.gameLog = [...state.gameLog, surfLog];

    // Gérer le ballon si le joueur surfé le portait
    if (target.hasBall) {
      state.players = state.players.map(p =>
        p.id === target.id ? { ...p, hasBall: false } : p
      );
      state.ball = { ...target.pos };
      // Note: bounceBall sera appelé par la fonction appelante
    }

    // Blessure automatique par la foule (pas de jet d'armure, minimum KO)
    state = handleInjuryByCrowd(state, target, rng);

    // L'attaquant peut suivre (follow-up) sur la case liberee
    state.players = state.players.map(p =>
      p.id === attacker.id ? { ...p, pos: target.pos } : p
    );
  } else if (availableDirections.length === 0) {
    // Aucune direction disponible (toutes occupées, aucune hors limites) - ne pas pousser
    const noPushLog = createLogEntry(
      'action',
      `${target.name} ne peut pas être repoussé (toutes les directions bloquées)`,
      attacker.id,
      attacker.team
    );
    state.gameLog = [...state.gameLog, noPushLog];
  } else if (availableDirections.length === 1) {
    // Une seule direction disponible - pousser automatiquement
    const pushDirection = availableDirections[0];
    const newTargetPos = {
      x: target.pos.x + pushDirection.x,
      y: target.pos.y + pushDirection.y,
    };

    state.players = state.players.map(p => (p.id === target.id ? { ...p, pos: newTargetPos } : p));

    // L'attaquant peut suivre (follow-up)
    state.players = state.players.map(p => (p.id === attacker.id ? { ...p, pos: target.pos } : p));

    const pushLog = createLogEntry(
      'action',
      `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y})`,
      attacker.id,
      attacker.team
    );
    state.gameLog = [...state.gameLog, pushLog];
  } else {
    // Plusieurs directions disponibles - l'attaquant doit choisir
    state.pendingPushChoice = {
      attackerId: attacker.id,
      targetId: target.id,
      availableDirections,
      blockResult: 'PUSH_BACK',
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 3,
      targetStrength: 2,
    };

    const choiceLog = createLogEntry(
      'action',
      `${attacker.name} doit choisir la direction de poussée pour ${target.name}`,
      attacker.id,
      attacker.team
    );
    state.gameLog = [...state.gameLog, choiceLog];
  }

  return state;
}

/**
 * Gère le résultat STUMBLE
 */
function handleStumble(state: GameState, attacker: Player, target: Player, rng: RNG): GameState {
  // Si la cible a Dodge (et l'attaquant n'a pas Tackle), c'est un Push Back
  if (dodgeNegatesStumble(target, attacker)) {
    return handlePushBack(state, attacker, target, rng);
  } else {
    // Pas de Dodge - traiter comme POW (le défenseur tombe, PAS un turnover)
    state.players = state.players.map(p => (p.id === target.id ? { ...p, stunned: true } : p));

    // Log de la mise au sol
    const stumbleDownLog = createLogEntry(
      'action',
      `${target.name} est mis au sol par ${attacker.name}`,
      attacker.id,
      attacker.team
    );
    state.gameLog = [...state.gameLog, stumbleDownLog];

    // Jet d'armure + blessure avec Mighty Blow
    state = armorAndInjuryWithMightyBlow(state, target, attacker, rng);

    // Gérer la poussée avec choix de direction
    const pushResult = handlePushWithChoice(state, attacker, target, 'STUMBLE', rng);

    // Si la cible avait le ballon, le perdre
    if (target.hasBall) {
      pushResult.players = pushResult.players.map(p =>
        p.id === target.id ? { ...p, hasBall: false } : p
      );
      pushResult.ball = { ...target.pos };
      // Note: bounceBall sera appelé par la fonction appelante
    }

    return pushResult;
  }
}

/**
 * Gère le résultat POW
 */
function handlePow(state: GameState, attacker: Player, target: Player, rng: RNG): GameState {
  // La cible est repoussée puis mise au sol (le défenseur tombe, PAS un turnover)
  state.players = state.players.map(p => (p.id === target.id ? { ...p, stunned: true } : p));

  // Log de la mise au sol
  const powLog = createLogEntry(
    'action',
    `${target.name} est mis au sol par ${attacker.name} (POW!)`,
    attacker.id,
    attacker.team
  );
  state.gameLog = [...state.gameLog, powLog];

  // Jet d'armure + blessure avec Mighty Blow
  state = armorAndInjuryWithMightyBlow(state, target, attacker, rng);

  // Gérer la poussée avec choix de direction
  const pushResult = handlePushWithChoice(state, attacker, target, 'POW', rng);

  // Si la cible avait le ballon, le perdre
  if (target.hasBall) {
    pushResult.players = pushResult.players.map(p =>
      p.id === target.id ? { ...p, hasBall: false } : p
    );
    pushResult.ball = { ...target.pos };
    // Note: bounceBall sera appelé par la fonction appelante
  }

  return pushResult;
}
