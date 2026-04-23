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
import { checkGuard, checkBlockNegatesBothDown, checkDodgeNegatesStumble, getMightyBlowBonusFromRegistry, checkWrestleOnBothDown, getArmorSkillContext, getInjurySkillModifiers } from '../skills/skill-bridge';
import { hasSkill } from '../skills/skill-effects';
import { performArmorRoll, roll2D6 } from '../utils/dice';
import { performArmorRollWithNotification } from '../utils/dice-notifications';
import { createLogEntry } from '../utils/logging';
import { canTeamBlitz } from '../core/game-state';
import { performInjuryRoll, handleSentOff, handleInjuryByCrowd } from './injury';
import { shouldConvertBothDownToPushBack } from './juggernaut';
import { bounceBall } from './ball';
import {
  isStandFirmActiveForBlock,
  isStandFirmActiveForChainPush,
} from './stand-firm';
import { isFendActiveForFollowUp } from './fend';
import { hasFrenzy } from './frenzy';
import { isGuardCancelledByDefensive } from './defensive';

/**
 * Applique un chain push : si la case de destination est occupée, le joueur qui s'y trouve
 * est poussé dans la même direction (récursif). Si hors-limites, le joueur est surfé.
 * @returns Le nouvel état après tous les déplacements en chaîne
 */
export function applyChainPush(
  state: GameState,
  pushedPlayerId: string,
  direction: Position,
  rng: RNG,
): GameState {
  const pushed = state.players.find(p => p.id === pushedPlayerId);
  if (!pushed) return state;

  // Stand Firm : un joueur debout avec Stand Firm peut refuser d'etre pousse
  // en chaine. Le chain stoppe ici, personne ne bouge.
  if (isStandFirmActiveForChainPush(pushed)) {
    const standFirmLog = createLogEntry(
      'action',
      `${pushed.name} utilise Stand Firm : refuse d'etre pousse en chaine`,
      undefined,
      pushed.team,
      { skill: 'stand-firm' },
    );
    return { ...state, gameLog: [...state.gameLog, standFirmLog] };
  }

  const newPos = {
    x: pushed.pos.x + direction.x,
    y: pushed.pos.y + direction.y,
  };

  // Hors-limites → surf
  if (!inBounds(state, newPos)) {
    const surfLog = createLogEntry(
      'action',
      `${pushed.name} est poussé dans la foule (chain push) !`,
      undefined,
      pushed.team === 'A' ? 'B' : 'A'
    );
    const newState = { ...state, gameLog: [...state.gameLog, surfLog] };
    if (pushed.hasBall) {
      newState.players = newState.players.map(p =>
        p.id === pushedPlayerId ? { ...p, hasBall: false } : p
      );
      newState.ball = { ...pushed.pos };
    }
    return handleInjuryByCrowd(newState, pushed, rng);
  }

  // Case occupée → chain push récursif
  const occupant = state.players.find(
    p => p.pos.x === newPos.x && p.pos.y === newPos.y && p.id !== pushedPlayerId
  );
  let newState = state;
  if (occupant) {
    const chainLog = createLogEntry(
      'action',
      `${occupant.name} est repoussé en chaîne !`,
      undefined,
      pushed.team === 'A' ? 'B' : 'A'
    );
    newState = { ...newState, gameLog: [...newState.gameLog, chainLog] };
    newState = applyChainPush(newState, occupant.id, direction, rng);

    // Si la case de destination est toujours occupee (p.ex. Stand Firm du
    // chain target qui refuse de bouger), on ne peut pas pousser le joueur
    // initial : personne ne bouge.
    const stillOccupied = newState.players.some(
      p => p.pos.x === newPos.x && p.pos.y === newPos.y && p.id !== pushedPlayerId
    );
    if (stillOccupied) {
      return newState;
    }
  }

  // Déplacer le joueur poussé
  newState = {
    ...newState,
    players: newState.players.map(p =>
      p.id === pushedPlayerId ? { ...p, pos: newPos } : p
    ),
  };

  return newState;
}

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
  const mbBonusRaw = getMightyBlowBonusFromRegistry(attacker, state);
  const diceRoll = roll2D6(rng);

  // Claws: armor breaks on 8+ regardless of AV (unless defender has Iron Hard Skin)
  // Iron Hard Skin: bloque les modificateurs positifs de l'attaquant sur le jet
  // d'armure (Mighty Blow notamment). La blessure n'est pas concernée.
  // Stunty: la valeur d'armure du joueur cible est reduite de 1 (plus fragile).
  // Le malus s'applique toujours, cumulatif avec Claws et Mighty Blow.
  const { clawsActive, ironHardSkinActive } = getArmorSkillContext(state, attacker, victim);
  const mbBonusOnArmor = ironHardSkinActive ? 0 : mbBonusRaw;
  const stuntyAdjust = hasSkill(victim, 'stunty') ? -1 : 0;
  const baseTarget = clawsActive ? Math.min(victim.av, 8) : victim.av;
  const armorTarget = baseTarget + stuntyAdjust;

  const armorBrokenNaturally = diceRoll >= armorTarget;
  const armorBrokenWithMB = (diceRoll + mbBonusOnArmor) >= armorTarget;

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
  const effectiveRoll = mbUsedOnArmor ? diceRoll + mbBonusOnArmor : diceRoll;
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure: ${effectiveRoll}/${armorTarget} ${armorBroken ? '✗ (percée)' : '✓ (tient)'}${mbBonusOnArmor > 0 && mbUsedOnArmor ? ' [Mighty Blow +1]' : ''}${clawsActive ? ' [Claws]' : ''}${ironHardSkinActive ? ' [Iron Hard Skin]' : ''}`,
    victim.id,
    victim.team,
    {
      diceRoll: effectiveRoll,
      targetNumber: armorTarget,
      success: !armorBroken,
      mightyBlow: mbBonusRaw > 0,
      mightyBlowAppliedTo: mbUsedOnArmor ? 'armor' : 'injury',
      ironHardSkin: ironHardSkinActive,
    }
  );
  state.gameLog = [...state.gameLog, armorLog];

  state.lastDiceResult = {
    type: 'armor',
    playerId: victim.id,
    diceRoll: effectiveRoll,
    targetNumber: armorTarget,
    success: !armorBroken,
    modifiers: mbUsedOnArmor ? mbBonusOnArmor : 0,
  };

  if (armorBroken) {
    // Le bonus Mighty Blow est reporté sur la blessure si non utilisé sur
    // l'armure. Iron Hard Skin NE bloque PAS Mighty Blow sur la blessure.
    const injuryBonus = mbUsedOnArmor ? 0 : mbBonusRaw;
    // Thick Skull: -1 to injury roll (KO on 9+ instead of 8+)
    const injuryDefenderMod = getInjurySkillModifiers(state, victim);
    state = performInjuryRoll(state, victim, rng, injuryBonus + injuryDefenderMod, attacker.id);
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

  // O.1 batch 3g : un joueur avec Titchy ne peut pas declarer d'action de Blocage.
  if (player.skills.includes('titchy')) return false;

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
      // Guard : un joueur avec Guard peut assister même s'il est marqué par d'autres adversaires.
      // Defensive (BB3) : pendant le tour adverse, le Guard est annulé si un adversaire
      // Defensive adjacent marque le joueur Guard.
      const guardActive =
        checkGuard(teammate, state) && !isGuardCancelledByDefensive(state, teammate);
      if (guardActive) {
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
      if (checkGuard(teammate, state)) {
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

  // Les directions de poussée sont dans la même direction que attaquant→cible
  // (la cible est poussée loin de l'attaquant)
  const pushX = normalizedX;
  const pushY = normalizedY;

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
  // Stand Firm : la cible peut refuser la poussee. Note : pour POW, la cible
  // est deja marquee stunned=true AVANT cet appel, donc elle tombera bien sur
  // sa case actuelle sans etre deplacee.
  if (isStandFirmActiveForBlock(state, attacker, target)) {
    const standFirmLog = createLogEntry(
      'action',
      `${target.name} utilise Stand Firm : refuse d'etre pousse`,
      target.id,
      target.team,
      { skill: 'stand-firm', blockResult },
    );
    return { ...state, gameLog: [...state.gameLog, standFirmLog] };
  }

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
    } else {
      // Case libre ou occupée (chain push) — les deux sont des directions valides
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

    // Fend : verifier avant la blessure par la foule (qui stun la cible)
    const fendActiveSurf = isFendActiveForFollowUp(state, attacker, target);

    // Blessure automatique par la foule (pas de jet d'armure, minimum KO)
    let resultState = handleInjuryByCrowd(newState, target, rng);

    if (fendActiveSurf) {
      const fendLog = createLogEntry(
        'action',
        `${target.name} utilise Fend : ${attacker.name} ne peut pas suivre`,
        target.id,
        target.team,
        { skill: 'fend' },
      );
      resultState = { ...resultState, gameLog: [...resultState.gameLog, fendLog] };
    } else {
      // L'attaquant peut suivre (follow-up) sur la case liberee
      resultState.players = resultState.players.map(p =>
        p.id === attacker.id ? { ...p, pos: target.pos } : p
      );
    }

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
    // Une seule direction disponible - pousser automatiquement (avec chain push)
    const pushDirection = availableDirections[0];
    const newTargetPos = {
      x: target.pos.x + pushDirection.x,
      y: target.pos.y + pushDirection.y,
    };

    // Fend : verifier avant la poussee (la cible doit etre debout). En
    // pratique, quand handlePushWithChoice est appele depuis POW/STUMBLE
    // knockdown, la cible est deja stunned et Fend n'est pas actif ; mais on
    // verifie quand meme pour le cas Dodge → PUSH_BACK si on passait par ici.
    const fendActive = isFendActiveForFollowUp(state, attacker, target);

    const newState = applyChainPush(state, target.id, pushDirection, rng);

    if (fendActive) {
      const fendLog = createLogEntry(
        'action',
        `${target.name} utilise Fend : ${attacker.name} ne peut pas suivre`,
        target.id,
        target.team,
        { skill: 'fend' },
      );
      newState.gameLog = [...newState.gameLog, fendLog];
    } else {
      // Demander confirmation pour le follow-up
      newState.pendingFollowUpChoice = {
        attackerId: attacker.id,
        targetId: target.id,
        targetNewPosition: newTargetPos,
        targetOldPosition: target.pos,
      };
    }

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
  // Juggernaut : pendant un Blitz, l'attaquant peut convertir BOTH_DOWN en
  // PUSH_BACK. `shouldConvertBothDownToPushBack` auto-resout le choix "may" :
  // on garde BOTH_DOWN quand l'attaquant a Block (Block donne un meilleur
  // resultat : defenseur au sol, attaquant debout). La regle annule aussi
  // Wrestle/Fend/Stand Firm du defenseur cible (traites ici / dans handlePushBack).
  if (shouldConvertBothDownToPushBack(state, attacker)) {
    const juggernautLog = createLogEntry(
      'action',
      `${attacker.name} utilise Juggernaut : BOTH_DOWN devient PUSH_BACK`,
      attacker.id,
      attacker.team,
      { skill: 'juggernaut', convertedFrom: 'BOTH_DOWN', convertedTo: 'PUSH_BACK' },
    );
    const stateWithLog: GameState = {
      ...state,
      gameLog: [...state.gameLog, juggernautLog],
    };
    return handlePushBack(stateWithLog, attacker, target, rng);
  }

  const attackerHasWrestle = checkWrestleOnBothDown(attacker, state);
  const targetHasWrestle = checkWrestleOnBothDown(target, state);
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

    // Pas de jets d'armure avec Wrestle
    // Mais si l'attaquant perd le ballon en tombant, c'est un turnover (BB2020)

    // Si l'attaquant avait le ballon, il le perd → turnover
    if (attacker.hasBall) {
      state.players = state.players.map(p => (p.id === attacker.id ? { ...p, hasBall: false } : p));
      state.ball = { ...attacker.pos };
      state.isTurnover = true;
    }

    // Si le défenseur avait le ballon, il le perd
    if (target.hasBall) {
      state.players = state.players.map(p => (p.id === target.id ? { ...p, hasBall: false } : p));
      state.ball = { ...target.pos };
    }

    return state;
  }

  // Comportement standard Block
  const attackerHasBlock = checkBlockNegatesBothDown(attacker, state);
  const targetHasBlock = checkBlockNegatesBothDown(target, state);

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
  // Strip Ball (BB2020, O.1 batch 3) : si l'attaquant possede `strip-ball`
  // et la cible porte le ballon, la cible lache la balle lors du PUSH_BACK,
  // meme si elle n'est pas mise au sol. La balle rebondit depuis la case
  // d'origine de la cible.
  // Monstrous Mouth (O.1 batch 3f) : la cible est immunisee contre Strip Ball.
  const attackerHasStripBall =
    attacker.skills.includes('strip-ball') ||
    attacker.skills.includes('strip_ball');
  const targetHasMonstrousMouth =
    target.skills.includes('monstrous-mouth') ||
    target.skills.includes('monstrous_mouth');
  if (attackerHasStripBall && target.hasBall && !targetHasMonstrousMouth) {
    const stripLog = createLogEntry(
      'action',
      `${attacker.name} utilise Strip Ball : ${target.name} lache le ballon !`,
      attacker.id,
      attacker.team,
      { skill: 'strip-ball' },
    );
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === target.id ? { ...p, hasBall: false } : p,
      ),
      ball: { ...target.pos },
      gameLog: [...state.gameLog, stripLog],
    };
    // Mettre a jour la reference locale target pour que le reste de la
    // resolution ne ressuscite pas hasBall.
    target = { ...target, hasBall: false };
    // Rebondir la balle depuis la case d'origine de la cible.
    state = bounceBall(state, rng);
  }

  // Stand Firm : la cible peut refuser d'etre poussee. Elle reste sur sa case,
  // l'attaquant ne fait pas de follow-up.
  if (isStandFirmActiveForBlock(state, attacker, target)) {
    const standFirmLog = createLogEntry(
      'action',
      `${target.name} utilise Stand Firm : refuse d'etre pousse`,
      target.id,
      target.team,
      { skill: 'stand-firm' },
    );
    return { ...state, gameLog: [...state.gameLog, standFirmLog] };
  }

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
    } else {
      // Case libre ou occupée (chain push) — les deux sont des directions valides
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

    // Fend : l'attaquant ne peut pas suivre (meme vers la case liberee par la
    // foule). Verifier AVANT d'appliquer la blessure (qui stun la cible).
    const fendActiveSurf = isFendActiveForFollowUp(state, attacker, target);

    // Blessure automatique par la foule (pas de jet d'armure, minimum KO)
    state = handleInjuryByCrowd(state, target, rng);

    if (fendActiveSurf) {
      const fendLog = createLogEntry(
        'action',
        `${target.name} utilise Fend : ${attacker.name} ne peut pas suivre`,
        target.id,
        target.team,
        { skill: 'fend' },
      );
      state.gameLog = [...state.gameLog, fendLog];
    } else {
      // L'attaquant peut suivre (follow-up) sur la case liberee
      state.players = state.players.map(p =>
        p.id === attacker.id ? { ...p, pos: target.pos } : p
      );
    }
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
    // Une seule direction disponible - pousser automatiquement (avec chain push)
    const pushDirection = availableDirections[0];
    const newTargetPos = {
      x: target.pos.x + pushDirection.x,
      y: target.pos.y + pushDirection.y,
    };

    // Fend : verifier avant la poussee (la cible doit etre debout)
    const fendActive = isFendActiveForFollowUp(state, attacker, target);
    const frenzyActive = hasFrenzy(attacker);

    state = applyChainPush(state, target.id, pushDirection, rng);

    if (fendActive) {
      const fendLog = createLogEntry(
        'action',
        `${target.name} utilise Fend : ${attacker.name} ne peut pas suivre`,
        target.id,
        target.team,
        { skill: 'fend' },
      );
      state.gameLog = [...state.gameLog, fendLog];
    } else if (frenzyActive) {
      // Frenzy : follow-up obligatoire + second bloc
      state.players = state.players.map(p =>
        p.id === attacker.id ? { ...p, pos: target.pos } : p
      );
      const frenzyFollowLog = createLogEntry(
        'action',
        `${attacker.name} suit ${target.name} (Frenzy — obligatoire)`,
        attacker.id,
        attacker.team,
        { skill: 'frenzy' },
      );
      state.gameLog = [...state.gameLog, frenzyFollowLog];
      state.pendingFrenzyBlock = {
        attackerId: attacker.id,
        targetId: target.id,
      };
    } else {
      // Follow-up is optional on PUSH_BACK — let the attacker choose
      state.pendingFollowUpChoice = {
        attackerId: attacker.id,
        targetId: target.id,
        targetNewPosition: newTargetPos,
        targetOldPosition: target.pos,
      };
    }

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
    // Frenzy : marquer le second bloc en attente pour après le choix de
    // direction + follow-up automatique
    if (hasFrenzy(attacker)) {
      state.pendingFrenzyBlock = {
        attackerId: attacker.id,
        targetId: target.id,
      };
    }

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
  if (checkDodgeNegatesStumble(target, attacker, state)) {
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
