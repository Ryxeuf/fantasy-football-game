/**
 * Actions et mouvements pour Blood Bowl
 * Gère l'application des mouvements, les jets de dés et la logique de jeu
 */

import { GameState, Move, Player, Position, TeamId, RNG, BlockResult, ActionType } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { getDodgeSkillModifiers, getPickupSkillModifiers, canSkillReroll } from '../skills/skill-bridge';
import {
  inBounds,
  samePos,
  requiresDodgeRoll,
  calculateDodgeModifiers,
  calculatePickupModifiers,
} from '../mechanics/movement';
import {
  performDodgeRoll,
  performPickupRoll,
  performArmorRoll,
  rollBlockDice,
  rollBlockDiceManyWithRolls,
  blockResultFromRoll,
} from '../utils/dice';
import {
  performDodgeRollWithNotification,
  performPickupRollWithNotification,
  performArmorRollWithNotification,
  rollBlockDiceWithNotification,
  rollBlockDiceManyWithNotification,
} from '../utils/dice-notifications';
import { performInjuryRoll } from '../mechanics/injury';
import { createLogEntry } from '../utils/logging';
import {
  checkTouchdowns,
  isInOpponentEndzone,
  awardTouchdown,
  bounceBall,
} from '../mechanics/ball';
import { hasAnimosityAgainst, checkAnimosity } from '../mechanics/animosity';
import {
  canBlock,
  canBlitz,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  calculateBlockDiceCount,
  getBlockDiceChooser,
  resolveBlockResult,
} from '../mechanics/blocking';
import {
  hasPlayerActed,
  canPlayerMove,
  canPlayerContinueMoving,
  setPlayerAction,
  checkPlayerTurnEnd,
  shouldAutoEndTurn,
  handlePlayerSwitch,
  getPlayerAction,
  incrementTeamBlitzCount,
  advanceHalfIfNeeded,
  handlePostTouchdown,
} from '../core/game-state';
import { executePass, executeHandoff, getPassRange } from '../mechanics/passing';
import { canFoul, executeFoul } from '../mechanics/foul';
import { isAdjacent } from '../mechanics/movement';
import { applyApothecaryChoice } from '../mechanics/apothecary';
import { canThrowTeamMate, getThrowRange, executeThrowTeamMate } from '../mechanics/throw-team-mate';
import { canHypnoticGaze, executeHypnoticGaze } from '../mechanics/hypnotic-gaze';
import { canProjectileVomit, executeProjectileVomit } from '../mechanics/projectile-vomit';
import {
  resolveKickoffPerfectDefence,
  resolveKickoffHighKick,
  resolveKickoffQuickSnap,
  resolveKickoffBlitz,
} from '../mechanics/kickoff-resolution';

/**
 * Obtient tous les mouvements légaux pour l'état actuel
 * @param state - État du jeu
 * @returns Liste des mouvements possibles
 */
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [{ type: 'END_TURN' }];
  const team = state.currentPlayer;

  // Si le match est terminé, aucune action possible
  if (state.gamePhase === 'ended') {
    return [];
  }

  // Vérifier que state.players existe
  if (!state.players || !Array.isArray(state.players)) {
    return moves;
  }

  // Si un pendingKickoffEvent est en attente, seules les actions kickoff sont possibles
  if (state.pendingKickoffEvent) {
    switch (state.pendingKickoffEvent.type) {
      case 'perfect-defence':
        return [{ type: 'KICKOFF_PERFECT_DEFENCE', positions: [] } as Move];
      case 'high-kick':
        return [{ type: 'KICKOFF_HIGH_KICK', playerId: null } as Move];
      case 'quick-snap':
        return [{ type: 'KICKOFF_QUICK_SNAP', moves: [] } as Move];
      case 'blitz':
        return [{ type: 'KICKOFF_BLITZ_RESOLVE' } as Move];
    }
  }

  // Si un pendingApothecary est en attente, seul le choix d'apothecaire est possible
  if (state.pendingApothecary) {
    return [
      { type: 'APOTHECARY_CHOOSE', useApothecary: true } as Move,
      { type: 'APOTHECARY_CHOOSE', useApothecary: false } as Move,
    ];
  }

  // Si un pendingReroll est en attente, seules les relances sont possibles
  if (state.pendingReroll) {
    return [
      { type: 'REROLL_CHOOSE', useReroll: true } as Move,
      { type: 'REROLL_CHOOSE', useReroll: false } as Move,
    ];
  }

  // Si c'est un turnover, seul END_TURN est possible
  if (state.isTurnover) {
    return moves;
  }

  // Si tous les joueurs de l'équipe ont agi ou ne peuvent plus agir, seul END_TURN est possible
  if (shouldAutoEndTurn(state)) {
    return moves;
  }

  const myPlayers = state.players.filter(
    p => p.team === team && (canPlayerMove(state, p.id) || canPlayerContinueMoving(state, p.id))
  );
  const occ = new Map<string, Player>();
  state.players.forEach(p => occ.set(`${p.pos.x},${p.pos.y}`, p));

  for (const p of myPlayers) {
    // Mouvements orthogonaux ET diagonaux (Blood Bowl rules)
    const dirs = [
      // Orthogonaux
      { x: 1, y: 0 }, // droite
      { x: -1, y: 0 }, // gauche
      { x: 0, y: 1 }, // bas
      { x: 0, y: -1 }, // haut
      // Diagonaux
      { x: 1, y: 1 }, // bas-droite
      { x: 1, y: -1 }, // haut-droite
      { x: -1, y: 1 }, // bas-gauche
      { x: -1, y: -1 }, // haut-gauche
    ];
    for (const d of dirs) {
      const to = { x: p.pos.x + d.x, y: p.pos.y + d.y };
      if (!inBounds(state, to)) continue;
      if (occ.has(`${to.x},${to.y}`)) continue; // pas de chevauchement
      moves.push({ type: 'MOVE', playerId: p.id, to });
    }

    // Actions de blocage
    const adjacentOpponents = getAdjacentOpponents(state, p.pos, p.team);
    for (const opponent of adjacentOpponents) {
      if (canBlock(state, p.id, opponent.id)) {
        moves.push({ type: 'BLOCK', playerId: p.id, targetId: opponent.id });
      }
    }

    // Actions de blitz (mouvement + blocage)
    // Pour chaque direction de mouvement possible
    for (const d of dirs) {
      const to = { x: p.pos.x + d.x, y: p.pos.y + d.y };
      if (!inBounds(state, to)) continue;
      if (occ.has(`${to.x},${to.y}`)) continue; // pas de chevauchement

      // Vérifier si on peut faire un blitz vers cette position
      // Chercher tous les adversaires qui seraient adjacents après le mouvement
      const allOpponents = state.players.filter(opp => opp.team !== p.team && !opp.stunned);
      for (const opponent of allOpponents) {
        if (canBlitz(state, p.id, to, opponent.id)) {
          moves.push({ type: 'BLITZ', playerId: p.id, to, targetId: opponent.id });
        }
      }
    }

    // Actions de passe (PASS) - le joueur doit avoir le ballon et pas encore agi
    // Passes interdites pendant le tour de blitz kickoff
    if (p.hasBall && !hasPlayerActed(state, p.id) && !state.kickoffBlitzTurn) {
      const teammates = state.players.filter(
        t => t.team === team && t.id !== p.id && !t.stunned && t.state === 'active'
      );
      for (const target of teammates) {
        const range = getPassRange(p.pos, target.pos);
        if (range) {
          moves.push({ type: 'PASS', playerId: p.id, targetId: target.id });
        }
      }
    }

    // Actions de remise (HANDOFF) - le joueur doit avoir le ballon, cible adjacente
    // Remises interdites pendant le tour de blitz kickoff
    if (p.hasBall && !hasPlayerActed(state, p.id) && !state.kickoffBlitzTurn) {
      const teammates = state.players.filter(
        t => t.team === team && t.id !== p.id && !t.stunned && t.state === 'active'
      );
      for (const target of teammates) {
        if (isAdjacent(p.pos, target.pos)) {
          moves.push({ type: 'HANDOFF', playerId: p.id, targetId: target.id });
        }
      }
    }

    // Actions de faute (FOUL) - sur un joueur au sol, max 1 par tour
    if (!hasPlayerActed(state, p.id) && ((state.teamFoulCount && state.teamFoulCount[team]) || 0) === 0) {
      const groundedOpponents = state.players.filter(
        opp => opp.team !== team && opp.stunned && isAdjacent(p.pos, opp.pos)
      );
      for (const target of groundedOpponents) {
        moves.push({ type: 'FOUL', playerId: p.id, targetId: target.id });
      }
    }

    // Actions de Lancer de Coéquipier (THROW_TEAM_MATE)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'throw-team-mate')) {
      // Chercher les coéquipiers adjacents avec Right Stuff
      const throwableTeammates = state.players.filter(
        t => t.team === team && t.id !== p.id && canThrowTeamMate(state, p, t)
      );
      for (const thrown of throwableTeammates) {
        // Générer les positions cibles dans la portée Long Pass max (distance ≤ 10)
        for (let dx = -10; dx <= 10; dx++) {
          for (let dy = -10; dy <= 10; dy++) {
            const targetPos = { x: p.pos.x + dx, y: p.pos.y + dy };
            if (!inBounds(state, targetPos)) continue;
            if (dx === 0 && dy === 0) continue;
            const range = getThrowRange(p.pos, targetPos);
            if (!range) continue;
            moves.push({
              type: 'THROW_TEAM_MATE',
              playerId: p.id,
              thrownPlayerId: thrown.id,
              targetPos,
            });
          }
        }
      }
    }

    // Actions de Regard Hypnotique (HYPNOTIC_GAZE)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'hypnotic-gaze')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canHypnoticGaze(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'HYPNOTIC_GAZE', playerId: p.id, targetId: target.id });
      }
    }

    // Actions de Vomissement Projectile (PROJECTILE_VOMIT)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'projectile-vomit')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canProjectileVomit(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'PROJECTILE_VOMIT', playerId: p.id, targetId: target.id });
      }
    }
  }
  return moves;
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
 * Vérifie si une équipe peut utiliser une relance d'équipe
 */
function canUseTeamReroll(state: GameState, team: TeamId): boolean {
  if (state.rerollUsedThisTurn) return false;
  const rerolls = team === 'A' ? state.teamRerolls?.teamA : state.teamRerolls?.teamB;
  return (rerolls ?? 0) > 0;
}

/**
 * Retourne le seuil Loner du joueur (3, 4 ou 5) ou null s'il n'a pas Loner.
 */
function getLonerThreshold(player: Player): number | null {
  if (hasSkill(player, 'loner-3')) return 3;
  if (hasSkill(player, 'loner-4')) return 4;
  if (hasSkill(player, 'loner-5')) return 5;
  return null;
}

/**
 * Consomme une relance d'équipe
 */
function consumeTeamReroll(state: GameState, team: TeamId): GameState {
  const newRerolls = { ...state.teamRerolls };
  if (team === 'A') {
    newRerolls.teamA = Math.max(0, (newRerolls.teamA ?? 0) - 1);
  } else {
    newRerolls.teamB = Math.max(0, (newRerolls.teamB ?? 0) - 1);
  }
  return { ...state, teamRerolls: newRerolls, rerollUsedThisTurn: true };
}

/**
 * Applique les conséquences d'un échec de jet (chute, turnover, armure, perte de balle)
 */
function applyRollFailure(state: GameState, playerIndex: number, rng: RNG): GameState {
  const player = state.players[playerIndex];
  state.isTurnover = true;
  state.players[playerIndex] = { ...player, stunned: true };

  // Jet d'armure
  const armorResult = performArmorRollWithNotification(state.players[playerIndex], rng);
  state.lastDiceResult = armorResult;
  const armorLog = createLogEntry(
    'dice',
    `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    { diceRoll: armorResult.diceRoll, targetNumber: armorResult.targetNumber, success: armorResult.success }
  );
  state.gameLog = [...state.gameLog, armorLog];

  // Si l'armure est percée (success = false), faire un jet de blessure
  if (!armorResult.success) {
    state = performInjuryRoll(state, state.players[playerIndex], rng);
  }

  // Perte de balle si le joueur la portait
  if (player.hasBall) {
    state.players[playerIndex] = { ...state.players[playerIndex], hasBall: false };
    state.ball = { ...state.players[playerIndex].pos };
    return bounceBall(state, rng);
  }

  return state;
}

/**
 * Applique les conséquences d'un échec de pickup (rebond + turnover)
 */
function applyPickupFailure(state: GameState, playerIndex: number, rng: RNG): GameState {
  state.isTurnover = true;
  const failLog = createLogEntry(
    'turnover',
    `Échec du ramassage - Turnover`,
    state.players[playerIndex].id,
    state.players[playerIndex].team
  );
  state.gameLog = [...state.gameLog, failLog];
  return bounceBall(state, rng);
}

/**
 * Applique un mouvement à l'état du jeu
 * @param state - État du jeu
 * @param move - Mouvement à appliquer
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état du jeu
 */
export function applyMove(state: GameState, move: Move, rng: RNG): GameState {
  // Si un pendingKickoffEvent est en attente, seules les actions kickoff sont acceptées
  if (state.pendingKickoffEvent) {
    const kickoffMoves = ['KICKOFF_PERFECT_DEFENCE', 'KICKOFF_HIGH_KICK', 'KICKOFF_QUICK_SNAP', 'KICKOFF_BLITZ_RESOLVE'];
    if (!kickoffMoves.includes(move.type)) return state;
  }

  // Si un pendingApothecary est en attente, seul APOTHECARY_CHOOSE est accepté
  if (state.pendingApothecary && move.type !== 'APOTHECARY_CHOOSE') {
    return state;
  }

  // Si un pendingReroll est en attente, seuls REROLL_CHOOSE et END_TURN sont acceptés
  if (state.pendingReroll && move.type !== 'REROLL_CHOOSE' && move.type !== 'END_TURN') {
    return state;
  }

  // Pendant le tour de blitz kickoff, les passes et remises sont interdites
  if (state.kickoffBlitzTurn && (move.type === 'PASS' || move.type === 'HANDOFF')) {
    return state;
  }

  // Si c'est un turnover, on ne peut que finir le tour
  // Exception : PUSH_CHOOSE, FOLLOW_UP_CHOOSE et REROLL_CHOOSE font partie de la résolution
  if (state.isTurnover && move.type !== 'END_TURN' && move.type !== 'PUSH_CHOOSE' && move.type !== 'FOLLOW_UP_CHOOSE' && move.type !== 'REROLL_CHOOSE' && move.type !== 'APOTHECARY_CHOOSE') {
    return state;
  }

  switch (move.type) {
    case 'END_TURN':
      return handleEndTurn(state, rng);
    case 'MOVE':
      return handleMove(state, move, rng);
    case 'DODGE':
      return handleDodge(state, move, rng);
    case 'BLOCK':
      return handleBlock(state, move, rng);
    case 'BLOCK_CHOOSE':
      return handleBlockChoose(state, move, rng);
    case 'PUSH_CHOOSE':
      return handlePushChoose(state, move);
    case 'FOLLOW_UP_CHOOSE':
      return handleFollowUpChoose(state, move);
    case 'BLITZ':
      return handleBlitz(state, move, rng);
    case 'REROLL_CHOOSE':
      return handleRerollChoose(state, move, rng);
    case 'APOTHECARY_CHOOSE':
      return applyApothecaryChoice(state, move.useApothecary, rng);
    case 'PASS':
      return handlePass(state, move, rng);
    case 'HANDOFF':
      return handleHandoff(state, move, rng);
    case 'THROW_TEAM_MATE':
      return handleThrowTeamMate(state, move, rng);
    case 'FOUL':
      return handleFoul(state, move, rng);
    case 'HYPNOTIC_GAZE':
      return handleHypnoticGaze(state, move, rng);
    case 'PROJECTILE_VOMIT':
      return handleProjectileVomit(state, move, rng);
    case 'KICKOFF_PERFECT_DEFENCE':
      return resolveKickoffPerfectDefence(state, move.positions);
    case 'KICKOFF_HIGH_KICK':
      return resolveKickoffHighKick(state, move.playerId);
    case 'KICKOFF_QUICK_SNAP':
      return resolveKickoffQuickSnap(state, move.moves);
    case 'KICKOFF_BLITZ_RESOLVE':
      return resolveKickoffBlitz(state);
    default:
      return checkTouchdowns(state);
  }
}

/**
 * Gère la fin de tour
 */
function handleEndTurn(state: GameState, rng: RNG): GameState {
  // Si le match est terminé, ne rien faire
  if (state.gamePhase === 'ended') return state;

  // Si on est en phase post-TD, faire le reset et kickoff
  if (state.gamePhase === 'post-td') {
    return handlePostTouchdown(state, rng);
  }

  // Si c'est un tour de blitz kickoff, le tour du kicking team est terminé
  // Retourner le contrôle à l'équipe qui reçoit
  if (state.kickoffBlitzTurn) {
    const receivingTeam = state.kickingTeam === 'A' ? 'B' : 'A';
    return {
      ...state,
      kickoffBlitzTurn: undefined,
      currentPlayer: receivingTeam,
      selectedPlayerId: null,
      players: state.players.map(p => ({ ...p, pm: p.ma, gfiUsed: 0 })),
      isTurnover: false,
      playerActions: {},
      teamBlitzCount: {},
      teamFoulCount: {},
      rerollUsedThisTurn: false,
      hypnotizedPlayers: [],
    };
  }

  // Changement de tour - le porteur de ballon garde le ballon
  const newState: GameState = {
    ...state,
    currentPlayer: state.currentPlayer === 'A' ? 'B' : 'A',
    turn: state.currentPlayer === 'B' ? state.turn + 1 : state.turn,
    selectedPlayerId: null,
    players: state.players.map(p => ({ ...p, pm: p.ma, gfiUsed: 0 })),
    isTurnover: false,
    lastDiceResult: undefined,
    playerActions: {} as Record<string, ActionType>, // Réinitialiser les actions
    teamBlitzCount: {} as Record<string, number>, // Réinitialiser les compteurs de blitz
    teamFoulCount: {} as Record<string, number>, // Réinitialiser les compteurs de foul
    rerollUsedThisTurn: false, // Réinitialiser le flag de relance
    hypnotizedPlayers: [], // Réinitialiser les joueurs hypnotisés
  };

  // Log du changement de tour
  const turnLogEntry = createLogEntry(
    'action',
    `Fin du tour - ${newState.currentPlayer === 'A' ? newState.teamNames.teamA : newState.teamNames.teamB} joue maintenant`,
    undefined,
    newState.currentPlayer
  );
  newState.gameLog = [...newState.gameLog, turnLogEntry];

  // Le porteur de ballon garde le ballon lors du changement de tour
  // Vérifier touchdowns, puis passage de mi-temps si besoin
  return advanceHalfIfNeeded(checkTouchdowns(newState), rng);
}

/**
 * Gère un mouvement simple
 */
function handleMove(
  state: GameState,
  move: { type: 'MOVE'; playerId: string; to: Position },
  rng: RNG
): GameState {
  const idx = state.players.findIndex(p => p.id === move.playerId);
  if (idx === -1) return state;

  // Gérer le changement de joueur
  const newState = handlePlayerSwitch(state, move.playerId);

  const legal = getLegalMoves(newState).some(
    m => m.type === 'MOVE' && m.playerId === move.playerId && samePos(m.to, move.to)
  );
  if (!legal) return newState;

  const player = newState.players[idx];
  const from = player.pos;
  const to = move.to;

  // Si c'est un turnover, on ne peut pas faire de mouvement
  if (newState.isTurnover) {
    return newState;
  }

  // Vérifier si un jet d'esquive est nécessaire
  const needsDodge = requiresDodgeRoll(newState, from, to, player.team);

  if (needsDodge) {
    return handleDodgeRoll(newState, player, from, to, rng, idx);
  } else {
    return handleNormalMove(newState, player, from, to, rng, idx);
  }
}

/**
 * Gère un jet d'esquive
 */
function handleDodgeRoll(
  state: GameState,
  player: Player,
  from: Position,
  to: Position,
  rng: RNG,
  idx: number
): GameState {
  // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée + skills)
  const baseDodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);
  const skillDodgeModifiers = getDodgeSkillModifiers(state, player, from);
  const dodgeModifiers = baseDodgeModifiers + skillDodgeModifiers;

  // Effectuer le jet d'esquive avec les modificateurs
  const dodgeResult = performDodgeRollWithNotification(player, rng, dodgeModifiers);

  let next = structuredClone(state) as GameState;
  next.lastDiceResult = dodgeResult;

  // Log du jet d'esquive
  const logEntry = createLogEntry(
    'dice',
    `Jet d'esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    {
      diceRoll: dodgeResult.diceRoll,
      targetNumber: dodgeResult.targetNumber,
      success: dodgeResult.success,
      modifiers: dodgeModifiers,
    }
  );
  next.gameLog = [...next.gameLog, logEntry];

  // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
  const isDodgeGFI = next.players[idx].pm <= 0;
  next.players[idx].pos = { ...to };
  if (isDodgeGFI) {
    next.players[idx].gfiUsed = (next.players[idx].gfiUsed ?? 0) + 1;
  } else {
    next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
  }

  // Enregistrer l'action de mouvement seulement si c'est le premier mouvement
  if (!hasPlayerActed(next, player.id)) {
    next = setPlayerAction(next, player.id, 'MOVE');
  }

  // Vérifier si le tour du joueur doit se terminer
  next = checkPlayerTurnEnd(next, player.id);

  // Dodge skill auto-reroll si échec (via skill registry)
  let finalDodgeSuccess = dodgeResult.success;
  if (!finalDodgeSuccess && canSkillReroll(player, 'on-dodge', state)) {
    const rerollLog = createLogEntry('dice', `Dodge : relance de l'esquive (${dodgeResult.diceRoll} raté)`, player.id, player.team);
    next.gameLog = [...next.gameLog, rerollLog];
    const rerollResult = performDodgeRollWithNotification(player, rng, dodgeModifiers);
    next.lastDiceResult = rerollResult;
    const rerollLogEntry = createLogEntry(
      'dice',
      `Relance esquive: ${rerollResult.diceRoll}/${rerollResult.targetNumber} ${rerollResult.success ? '✓' : '✗'}`,
      player.id, player.team,
      { diceRoll: rerollResult.diceRoll, targetNumber: rerollResult.targetNumber, success: rerollResult.success }
    );
    next.gameLog = [...next.gameLog, rerollLogEntry];
    finalDodgeSuccess = rerollResult.success;
  }

  if (finalDodgeSuccess) {
    // Si c'est aussi un GFI, jet supplémentaire de GFI (2+ sur D6)
    if (isDodgeGFI) {
      let gfiRoll = Math.floor(rng() * 6) + 1;
      let gfiSuccess = gfiRoll >= 2;

      // Sure Feet auto-reroll (via skill registry)
      if (!gfiSuccess && canSkillReroll(player, 'on-gfi', state)) {
        const sfLog = createLogEntry('dice', `Sure Feet : relance du GFI (${gfiRoll} raté)`, player.id, player.team);
        next.gameLog = [...next.gameLog, sfLog];
        gfiRoll = Math.floor(rng() * 6) + 1;
        gfiSuccess = gfiRoll >= 2;
      }

      const gfiLogEntry = createLogEntry(
        'dice',
        `GFI (Going For It) après esquive: ${gfiRoll}/2 ${gfiSuccess ? '✓' : '✗'}`,
        player.id, player.team,
        { diceRoll: gfiRoll, targetNumber: 2, success: gfiSuccess }
      );
      next.gameLog = [...next.gameLog, gfiLogEntry];
      next.lastDiceResult = { type: 'dodge' as any, playerId: player.id, diceRoll: gfiRoll, targetNumber: 2, success: gfiSuccess, modifiers: 0, playerName: player.name };

      if (!gfiSuccess) {
        // Offrir relance d'équipe si disponible
        if (canUseTeamReroll(next, player.team)) {
          next.pendingReroll = { rollType: 'gfi', playerId: player.id, team: player.team, targetNumber: 2, modifiers: 0, playerIndex: idx, to };
          return next;
        }
        return applyRollFailure(next, idx, rng);
      }
    }

    // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
    const mover = next.players[idx];
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }
  } else {
    // Esquive échouée (après skill reroll éventuel) : offrir relance d'équipe
    if (canUseTeamReroll(next, player.team)) {
      next.pendingReroll = { rollType: 'dodge', playerId: player.id, team: player.team, targetNumber: dodgeResult.targetNumber, modifiers: dodgeModifiers, playerIndex: idx, from, to };
      return next;
    }
    // Pas de relance disponible : appliquer l'échec
    return applyRollFailure(next, idx, rng);
  }

  return next;
}

/**
 * Gère un mouvement normal (sans jet d'esquive)
 */
function handleNormalMove(
  state: GameState,
  player: Player,
  from: Position,
  to: Position,
  rng: RNG,
  idx: number
): GameState {
  let next = structuredClone(state) as GameState;
  const isGFI = next.players[idx].pm <= 0;

  // Déplacer le joueur
  next.players[idx].pos = { ...to };

  if (isGFI) {
    // GFI : ne décrémente pas pm, incrémente gfiUsed
    next.players[idx].gfiUsed = (next.players[idx].gfiUsed ?? 0) + 1;

    // Jet de GFI : 2+ sur D6
    let gfiRoll = Math.floor(rng() * 6) + 1;
    let gfiSuccess = gfiRoll >= 2;

    // Sure Feet : relance automatique du GFI raté (via skill registry)
    if (!gfiSuccess && canSkillReroll(player, 'on-gfi', state)) {
      const rerollLog = createLogEntry(
        'dice',
        `Sure Feet : relance du GFI (${gfiRoll} raté)`,
        player.id,
        player.team
      );
      next.gameLog = [...next.gameLog, rerollLog];
      gfiRoll = Math.floor(rng() * 6) + 1;
      gfiSuccess = gfiRoll >= 2;
    }

    const gfiLogEntry = createLogEntry(
      'dice',
      `GFI (Going For It): ${gfiRoll}/2 ${gfiSuccess ? '✓' : '✗'}`,
      player.id,
      player.team,
      { diceRoll: gfiRoll, targetNumber: 2, success: gfiSuccess }
    );
    next.gameLog = [...next.gameLog, gfiLogEntry];
    next.lastDiceResult = {
      type: 'dodge' as any,
      playerId: player.id,
      diceRoll: gfiRoll,
      targetNumber: 2,
      success: gfiSuccess,
      modifiers: 0,
      playerName: player.name,
    };

    // Enregistrer l'action
    if (!hasPlayerActed(next, player.id)) {
      next = setPlayerAction(next, player.id, 'MOVE');
    }

    if (!gfiSuccess) {
      // GFI échoué : offrir relance d'équipe si disponible
      if (canUseTeamReroll(next, player.team)) {
        next.pendingReroll = { rollType: 'gfi', playerId: player.id, team: player.team, targetNumber: 2, modifiers: 0, playerIndex: idx, to };
        return next;
      }
      // Pas de relance : appliquer l'échec
      return applyRollFailure(next, idx, rng);
    }

    // GFI réussi : continuer normalement
    next = checkPlayerTurnEnd(next, player.id);

    // Touchdown check
    const mover = next.players[idx];
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }

    // Ramassage de balle
    if (next.ball && samePos(next.ball, to)) {
      return handleBallPickup(next, player, rng, idx);
    }

    return next;
  }

  // Mouvement normal (a des PM)
  next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);

  // Enregistrer l'action de mouvement seulement si c'est le premier mouvement
  if (!hasPlayerActed(next, player.id)) {
    next = setPlayerAction(next, player.id, 'MOVE');
  }

  // Vérifier si le tour du joueur doit se terminer
  next = checkPlayerTurnEnd(next, player.id);

  // Log du mouvement
  const moveLogEntry = createLogEntry(
    'action',
    `Mouvement vers (${to.x}, ${to.y})`,
    player.id,
    player.team
  );
  next.gameLog = [...next.gameLog, moveLogEntry];
  // Réinitialiser le résultat de dés après un mouvement normal
  next.lastDiceResult = undefined;

  // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
  const mover = next.players[idx];
  if (mover.hasBall && isInOpponentEndzone(next, mover)) {
    return awardTouchdown(next, mover.team, mover);
  }

  // Ramassage de balle avec jet d'agilité
  if (next.ball && samePos(next.ball, to)) {
    return handleBallPickup(next, player, rng, idx);
  }

  return next;
}

/**
 * Gère le ramassage de balle
 */
function handleBallPickup(state: GameState, player: Player, rng: RNG, idx: number): GameState {
  // Calculer les modificateurs de pickup (malus pour adversaires + bonus skills)
  const basePickupModifiers = calculatePickupModifiers(state, state.ball!, player.team);
  const skillPickupModifiers = getPickupSkillModifiers(state, player);
  const pickupModifiers = basePickupModifiers + skillPickupModifiers;

  // Effectuer le jet de pickup
  let pickupResult = performPickupRollWithNotification(player, rng, pickupModifiers);

  // Sure Hands : relance automatique du pickup raté (via skill registry)
  if (!pickupResult.success && canSkillReroll(player, 'on-pickup', state)) {
    const rerollLog = createLogEntry(
      'dice',
      `Sure Hands : relance du ramassage (${pickupResult.diceRoll} raté)`,
      player.id,
      player.team
    );
    state.gameLog = [...state.gameLog, rerollLog];
    pickupResult = performPickupRollWithNotification(player, rng, pickupModifiers);
  }

  // Stocker le résultat pour l'affichage
  state.lastDiceResult = pickupResult;

  // Log du jet de pickup
  const pickupLogEntry = createLogEntry(
    'dice',
    `Jet de pickup: ${pickupResult.diceRoll}/${pickupResult.targetNumber} ${pickupResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    {
      diceRoll: pickupResult.diceRoll,
      targetNumber: pickupResult.targetNumber,
      success: pickupResult.success,
      modifiers: pickupModifiers,
    }
  );
  state.gameLog = [...state.gameLog, pickupLogEntry];

  if (pickupResult.success) {
    // Ramassage réussi : attacher la balle au joueur
    state.ball = undefined;
    state.players[idx].hasBall = true;

    // Log du ramassage réussi
    const successLogEntry = createLogEntry(
      'action',
      `Ballon ramassé avec succès`,
      player.id,
      player.team
    );
    state.gameLog = [...state.gameLog, successLogEntry];

    // Si pickup dans l'en-but adverse, touchdown immédiat
    const picker = state.players[idx];
    if (isInOpponentEndzone(state, picker)) {
      return awardTouchdown(state, picker.team, picker);
    }
  } else {
    // Échec de pickup : offrir relance d'équipe si disponible
    if (canUseTeamReroll(state, player.team)) {
      state.pendingReroll = { rollType: 'pickup', playerId: player.id, team: player.team, targetNumber: pickupResult.targetNumber, modifiers: pickupModifiers, playerIndex: idx };
      return state;
    }
    // Pas de relance : la balle rebondit et turnover
    state.isTurnover = true;

    // Log du ramassage échoué
    const failLogEntry = createLogEntry(
      'turnover',
      `Échec du ramassage - Turnover`,
      player.id,
      player.team
    );
    state.gameLog = [...state.gameLog, failLogEntry];

    // Faire rebondir la balle
    return bounceBall(state, rng);
  }

  return state;
}

/**
 * Gère une action d'esquive explicite
 */
function handleDodge(
  state: GameState,
  move: { type: 'DODGE'; playerId: string; from: Position; to: Position },
  rng: RNG
): GameState {
  // Action d'esquive explicite (pour l'interface)
  const idx = state.players.findIndex(p => p.id === move.playerId);
  if (idx === -1) return state;

  const player = state.players[idx];
  const from = player.pos;
  const to = move.to;

  // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée + skills)
  const baseDodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);
  const skillDodgeModifiers = getDodgeSkillModifiers(state, player, from);
  const dodgeModifiers = baseDodgeModifiers + skillDodgeModifiers;

  const dodgeResult = performDodgeRollWithNotification(player, rng, dodgeModifiers);

  let next = structuredClone(state) as GameState;
  next.lastDiceResult = dodgeResult;

  // Log du jet d'esquive
  const dodgeLogEntry = createLogEntry(
    'dice',
    `Jet d'esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    {
      diceRoll: dodgeResult.diceRoll,
      targetNumber: dodgeResult.targetNumber,
      success: dodgeResult.success,
      modifiers: dodgeModifiers,
    }
  );
  next.gameLog = [...next.gameLog, dodgeLogEntry];

  // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
  next.players[idx].pos = { ...move.to };
  next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);

  if (dodgeResult.success) {
    // Avancement d'état standard après mouvement réussi
    if (!hasPlayerActed(next, player.id)) {
      next = setPlayerAction(next, player.id, 'MOVE');
    }
    next = checkPlayerTurnEnd(next, player.id);

    // Événements liés à la balle
    const mover = next.players[idx];
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }
    if (next.ball && samePos(next.ball, to)) {
      return handleBallPickup(next, player, rng, idx);
    }

    return next;
  } else {
    // En cas d'échec: jet d'armure puis potentiellement blessure/turnover
    const armorResult = performArmorRollWithNotification(player, rng);
    const armorSuccess = armorResult.success;
    next.lastDiceResult = armorResult;

    const armorLogEntry = createLogEntry(
      'dice',
      `Jet d'armure (Dodge échoué): ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorSuccess ? '✓' : '✗'}`,
      player.id,
      player.team,
      {
        diceRoll: armorResult.diceRoll,
        targetNumber: armorResult.targetNumber,
        success: armorSuccess,
      }
    );
    next.gameLog = [...next.gameLog, armorLogEntry];

    if (!armorSuccess) {
      // Armure percée: jet de blessure (stunned, KO ou casualty)
      next = performInjuryRoll(next, player, rng);
    } else {
      // Armure tient: joueur sonné (stunned)
      next.players[idx].state = 'stunned' as any;
      (next.players[idx] as any).stunned = true;
    }

    // Si le joueur portait la balle, il la perd et elle rebondit
    if (next.players[idx]?.hasBall) {
      next.players[idx].hasBall = false;
      next.ball = { ...to };
      next = bounceBall(next, rng);
    }

    // Échec d'esquive entraîne turnover
    next.isTurnover = true;
    return next;
  }
}

/**
 * Gère un blocage
 */
function handleBlock(
  state: GameState,
  move: { type: 'BLOCK'; playerId: string; targetId: string },
  rng: RNG
): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!attacker || !target) return state;

  // Vérifier que le blocage est légal
  if (!canBlock(state, move.playerId, move.targetId)) return state;

  // Calculer les assists
  const offensiveAssists = calculateOffensiveAssists(state, attacker, target);
  const defensiveAssists = calculateDefensiveAssists(state, attacker, target);

  // Nombre de dés et qui choisit
  const attackerStrength = attacker.st + offensiveAssists;
  const targetStrength = target.st + defensiveAssists;
  const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
  const chooser = getBlockDiceChooser(attackerStrength, targetStrength);

  // Enregistrer l'action de blocage
  const newState = setPlayerAction(state, attacker.id, 'BLOCK');

  // Si un seul dé, résoudre immédiatement
  if (diceCount === 1) {
    // Single RNG call: derive both diceRoll and blockResult from same value
    const diceRoll = Math.floor(rng() * 6) + 1;
    const blockResult = blockResultFromRoll(diceRoll);
    const blockDiceResult = {
      type: 'block' as const,
      playerId: attacker.id,
      targetId: target.id,
      diceRoll,
      result: blockResult,
      offensiveAssists,
      defensiveAssists,
      totalStrength: attackerStrength,
      targetStrength,
    };

    // Log du résultat de blocage
    const blockLogEntry = createLogEntry(
      'dice',
      `Blocage: ${diceRoll} → ${blockResult}`,
      attacker.id,
      attacker.team,
      { diceRoll: diceRoll, result: blockResult, offensiveAssists, defensiveAssists }
    );
    newState.gameLog = [...newState.gameLog, blockLogEntry];

    return resolveBlockResult(newState, blockDiceResult, rng);
  } else {
    // Plusieurs dés : enregistrer un choix en attente
    const options = rollBlockDiceManyWithNotification(rng, diceCount, attacker.name); // BlockResult[]

    // Log des dés lancés (on logge les résultats faute des valeurs brutes)
    const blockLogEntry = createLogEntry(
      'dice',
      `Blocage: ${options.join(', ')} (${diceCount} dés)`,
      attacker.id,
      attacker.team,
      { results: options, diceCount, offensiveAssists, defensiveAssists }
    );
    newState.gameLog = [...newState.gameLog, blockLogEntry];

    return {
      ...newState,
      pendingBlock: {
        attackerId: attacker.id,
        targetId: target.id,
        options: options,
        chooser,
        offensiveAssists,
        defensiveAssists,
        totalStrength: attackerStrength,
        targetStrength,
      },
    };
  }
}

/**
 * Gère le choix de résultat de blocage
 */
function handleBlockChoose(
  state: GameState,
  move: { type: 'BLOCK_CHOOSE'; playerId: string; targetId: string; result: BlockResult },
  rng: RNG
): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingBlock ||
    state.pendingBlock.attackerId !== attacker.id ||
    state.pendingBlock.targetId !== target.id
  ) {
    return state; // pas de choix attendu
  }

  // Construire un résultat complet à partir du choix
  const blockResult = {
    type: 'block' as const,
    playerId: attacker.id,
    targetId: target.id,
    diceRoll: 0,
    result: move.result,
    offensiveAssists: state.pendingBlock.offensiveAssists,
    defensiveAssists: state.pendingBlock.defensiveAssists,
    totalStrength: state.pendingBlock.totalStrength,
    targetStrength: state.pendingBlock.targetStrength,
  };

  let newState = resolveBlockResult({ ...state, pendingBlock: undefined }, blockResult, rng);

  // Déterminer si c'était un blitz ou un blocage normal
  // Si le joueur a déjà l'action BLITZ enregistrée, c'est un blitz
  // Sinon, c'est un blocage normal
  const isBlitz =
    hasPlayerActed(state, attacker.id) && getPlayerAction(state, attacker.id) === 'BLITZ';

  if (isBlitz) {
    // Pour un blitz, consommer 1 PM supplémentaire pour le blocage
    const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
    if (attackerIdx !== -1) {
      newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - 1);
    }

    // Enregistrer l'action de blitz
    newState = setPlayerAction(newState, attacker.id, 'BLITZ');

    // Pour un blitz, ne pas terminer l'activation du joueur - il peut continuer à bouger
    // sauf si c'est un turnover (PLAYER_DOWN, BOTH_DOWN, etc.)
    if (!newState.isTurnover) {
      // Le joueur peut continuer à bouger après le blocage
      // On ne termine pas son activation ici
    } else {
      // En cas de turnover, terminer l'activation
      newState = checkPlayerTurnEnd(newState, attacker.id);
    }
  } else {
    // Pour un blocage normal, terminer l'activation
    newState = setPlayerAction(newState, attacker.id, 'BLOCK');
    newState = checkPlayerTurnEnd(newState, attacker.id);
  }

  // lastDiceResult est déjà renseigné par resolveBlockResult pour l'armure; on peut aussi logguer le block
  newState.lastDiceResult = {
    type: 'block',
    playerId: attacker.id,
    diceRoll: 0,
    targetNumber: 0,
    success: true,
    modifiers: 0,
  };
  return newState;
}

/**
 * Gère le choix de direction de poussée
 */
function handlePushChoose(
  state: GameState,
  move: { type: 'PUSH_CHOOSE'; playerId: string; targetId: string; direction: Position }
): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingPushChoice ||
    state.pendingPushChoice.attackerId !== attacker.id ||
    state.pendingPushChoice.targetId !== target.id
  ) {
    return state; // pas de choix de poussée attendu
  }

  // Vérifier que la direction choisie est valide
  const isValidDirection = state.pendingPushChoice.availableDirections.some(
    dir => dir.x === move.direction.x && dir.y === move.direction.y
  );
  if (!isValidDirection) return state;

  // Appliquer la poussée dans la direction choisie
  const newTargetPos = {
    x: target.pos.x + move.direction.x,
    y: target.pos.y + move.direction.y,
  };

  const newState = { ...state, pendingPushChoice: undefined };
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

  // Log de la poussée
  const pushLog = createLogEntry(
    'action',
    `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y}) par ${attacker.name}`,
    attacker.id,
    attacker.team
  );
  newState.gameLog = [...newState.gameLog, pushLog];

  return checkTouchdowns(newState);
}

/**
 * Gère le choix de follow-up
 */
function handleFollowUpChoose(
  state: GameState,
  move: { type: 'FOLLOW_UP_CHOOSE'; playerId: string; targetId: string; followUp: boolean }
): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingFollowUpChoice ||
    state.pendingFollowUpChoice.attackerId !== attacker.id ||
    state.pendingFollowUpChoice.targetId !== target.id
  ) {
    return state; // pas de choix de follow-up attendu
  }

  const newState = { ...state, pendingFollowUpChoice: undefined };

  if (move.followUp) {
    // L'attaquant suit le joueur poussé
    newState.players = newState.players.map(p =>
      p.id === attacker.id ? { ...p, pos: state.pendingFollowUpChoice!.targetOldPosition } : p
    );

    const followUpLog = createLogEntry(
      'action',
      `${attacker.name} suit ${target.name} (follow-up)`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, followUpLog];
  } else {
    const noFollowUpLog = createLogEntry(
      'action',
      `${attacker.name} ne suit pas ${target.name}`,
      attacker.id,
      attacker.team
    );
    newState.gameLog = [...newState.gameLog, noFollowUpLog];
  }

  return checkTouchdowns(newState);
}

/**
 * Gère le choix de relance d'équipe
 */
function handleRerollChoose(
  state: GameState,
  move: { type: 'REROLL_CHOOSE'; useReroll: boolean },
  rng: RNG
): GameState {
  if (!state.pendingReroll) return state;

  const { rollType, playerId, team, targetNumber, modifiers, playerIndex, from, to } = state.pendingReroll;
  let newState: GameState = { ...state, pendingReroll: undefined };

  if (!move.useReroll) {
    // Relance refusée : appliquer les conséquences de l'échec
    const declineLog = createLogEntry('action', `Relance refusée`, playerId, team);
    newState.gameLog = [...newState.gameLog, declineLog];

    if (rollType === 'pickup') {
      return applyPickupFailure(newState, playerIndex, rng);
    } else {
      // dodge ou gfi : chute + turnover
      return applyRollFailure(newState, playerIndex, rng);
    }
  }

  // Vérification Loner : le joueur doit réussir un jet D6 >= seuil
  const lonerPlayer = newState.players[playerIndex];
  const lonerThreshold = getLonerThreshold(lonerPlayer);
  if (lonerThreshold !== null) {
    const lonerRoll = Math.floor(rng() * 6) + 1;
    const lonerSuccess = lonerRoll >= lonerThreshold;
    const lonerLog = createLogEntry(
      'dice',
      `Solitaire (${lonerThreshold}+) : ${lonerRoll}/${lonerThreshold} ${lonerSuccess ? '✓' : '✗'}`,
      playerId,
      team,
      { diceRoll: lonerRoll, targetNumber: lonerThreshold, success: lonerSuccess }
    );
    newState.gameLog = [...newState.gameLog, lonerLog];

    if (!lonerSuccess) {
      // Loner check failed: team reroll is consumed (wasted), original failure applies
      newState = consumeTeamReroll(newState, team);
      const wastedLog = createLogEntry('action', `Relance d'équipe gaspillée (Solitaire raté)`, playerId, team);
      newState.gameLog = [...newState.gameLog, wastedLog];

      if (rollType === 'pickup') {
        return applyPickupFailure(newState, playerIndex, rng);
      } else {
        return applyRollFailure(newState, playerIndex, rng);
      }
    }
  }

  // Relance acceptée : consommer la relance
  newState = consumeTeamReroll(newState, team);
  const rerollLog = createLogEntry('action', `Relance d'équipe utilisée !`, playerId, team);
  newState.gameLog = [...newState.gameLog, rerollLog];

  if (rollType === 'dodge') {
    // Relancer le jet d'esquive
    const dodgeResult = performDodgeRollWithNotification(
      newState.players[playerIndex],
      rng,
      modifiers
    );
    newState.lastDiceResult = dodgeResult;
    const logEntry = createLogEntry(
      'dice',
      `Relance esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
      playerId,
      team,
      { diceRoll: dodgeResult.diceRoll, targetNumber: dodgeResult.targetNumber, success: dodgeResult.success }
    );
    newState.gameLog = [...newState.gameLog, logEntry];

    if (dodgeResult.success) {
      // Touchdown check
      const mover = newState.players[playerIndex];
      if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
        return awardTouchdown(newState, mover.team, mover);
      }
      return newState;
    } else {
      return applyRollFailure(newState, playerIndex, rng);
    }
  } else if (rollType === 'gfi') {
    // Relancer le jet de GFI
    const gfiRoll = Math.floor(rng() * 6) + 1;
    const gfiSuccess = gfiRoll >= 2;
    const logEntry = createLogEntry(
      'dice',
      `Relance GFI: ${gfiRoll}/2 ${gfiSuccess ? '✓' : '✗'}`,
      playerId,
      team,
      { diceRoll: gfiRoll, targetNumber: 2, success: gfiSuccess }
    );
    newState.gameLog = [...newState.gameLog, logEntry];

    if (gfiSuccess) {
      // Touchdown check
      const mover = newState.players[playerIndex];
      if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
        return awardTouchdown(newState, mover.team, mover);
      }
      // Ball pickup check
      if (newState.ball && to && samePos(newState.ball, to)) {
        return handleBallPickup(newState, mover, rng, playerIndex);
      }
      return newState;
    } else {
      return applyRollFailure(newState, playerIndex, rng);
    }
  } else if (rollType === 'pickup') {
    // Relancer le jet de pickup
    const pickupResult = performPickupRollWithNotification(
      newState.players[playerIndex],
      rng,
      modifiers
    );
    newState.lastDiceResult = pickupResult;
    const logEntry = createLogEntry(
      'dice',
      `Relance pickup: ${pickupResult.diceRoll}/${pickupResult.targetNumber} ${pickupResult.success ? '✓' : '✗'}`,
      playerId,
      team,
      { diceRoll: pickupResult.diceRoll, targetNumber: pickupResult.targetNumber, success: pickupResult.success }
    );
    newState.gameLog = [...newState.gameLog, logEntry];

    if (pickupResult.success) {
      newState.ball = undefined;
      newState.players[playerIndex] = { ...newState.players[playerIndex], hasBall: true };
      const successLog = createLogEntry('action', `Ballon ramassé avec succès (relance)`, playerId, team);
      newState.gameLog = [...newState.gameLog, successLog];
      // Touchdown check
      const picker = newState.players[playerIndex];
      if (isInOpponentEndzone(newState, picker)) {
        return awardTouchdown(newState, picker.team, picker);
      }
      return newState;
    } else {
      return applyPickupFailure(newState, playerIndex, rng);
    }
  }

  return newState;
}

/**
 * Gère un blitz
 */
function handleBlitz(
  state: GameState,
  move: { type: 'BLITZ'; playerId: string; to: Position; targetId: string },
  rng: RNG
): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!attacker || !target) return state;

  // Vérifier que le blitz est légal
  if (!canBlitz(state, move.playerId, move.to, move.targetId)) return state;

  // Gérer le changement de joueur
  let newState = handlePlayerSwitch(state, move.playerId);

  // 1. Effectuer le mouvement
  const from = attacker.pos;
  const to = move.to;

  // Vérifier si un jet d'esquive est nécessaire pour le mouvement
  const needsDodge = requiresDodgeRoll(newState, from, to, attacker.team);

  if (needsDodge) {
    // Calculer les modificateurs de désquive (adversaires à l'arrivée + skills)
    const baseDodgeModifiers = calculateDodgeModifiers(newState, from, to, attacker.team);
    const skillDodgeModifiers = getDodgeSkillModifiers(newState, attacker, from);
    const dodgeModifiers = baseDodgeModifiers + skillDodgeModifiers;

    // Effectuer le jet d'esquive
    const dodgeResult = performDodgeRollWithNotification(attacker, rng, dodgeModifiers);

    newState.lastDiceResult = dodgeResult;

    // Log du jet d'esquive
    const dodgeLogEntry = createLogEntry(
      'dice',
      `Jet d'esquive (Blitz): ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${dodgeResult.success ? '✓' : '✗'}`,
      attacker.id,
      attacker.team,
      {
        diceRoll: dodgeResult.diceRoll,
        targetNumber: dodgeResult.targetNumber,
        success: dodgeResult.success,
        modifiers: dodgeModifiers,
      }
    );
    newState.gameLog = [...newState.gameLog, dodgeLogEntry];

    // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
    const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
    newState.players[attackerIdx].pos = { ...to };

    // Calculer le coût en PM : distance seulement (le blocage coûtera 1 PM supplémentaire)
    const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - distance);

    if (dodgeResult.success) {
      // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
      const mover = newState.players[attackerIdx];
      if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
        return awardTouchdown(newState, mover.team, mover);
      }
    } else {
      // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
      newState.isTurnover = true;

      // Vérifier si le joueur avait le ballon AVANT de le mettre à terre
      const hadBall = newState.players[attackerIdx].hasBall;

      // Le joueur chute (est mis à terre)
      newState.players[attackerIdx].stunned = true;

      // Effectuer le jet d'armure
      const armorResult = performArmorRollWithNotification(newState.players[attackerIdx], rng);
      newState.lastDiceResult = armorResult;

      // Log du jet d'armure
      const armorLogEntry = createLogEntry(
        'dice',
        `Jet d'armure (Blitz échoué): ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
        newState.players[attackerIdx].id,
        newState.players[attackerIdx].team,
        {
          diceRoll: armorResult.diceRoll,
          targetNumber: armorResult.targetNumber,
          success: armorResult.success,
        }
      );
      newState.gameLog = [...newState.gameLog, armorLogEntry];

      // Si l'armure est percée (success = false), faire un jet de blessure
      if (!armorResult.success) {
        newState = performInjuryRoll(newState, newState.players[attackerIdx], rng);
      }

      // Si le joueur avait le ballon, il le perd et le ballon rebondit
      // (même si l'armure n'est pas percée, le joueur chute et perd le ballon)
      if (hadBall) {
        newState.players[attackerIdx].hasBall = false;
        newState.ball = { ...newState.players[attackerIdx].pos };

        // Log de la perte de ballon
        const ballLossLogEntry = createLogEntry(
          'action',
          `Ballon perdu après échec de blitz`,
          attacker.id,
          attacker.team
        );
        newState.gameLog = [...newState.gameLog, ballLossLogEntry];

        // Faire rebondir le ballon depuis la position du joueur
        return bounceBall(newState, rng);
      }

      // Enregistrer l'action de blitz et terminer le tour
      newState = setPlayerAction(newState, attacker.id, 'BLITZ');
      newState = checkPlayerTurnEnd(newState, attacker.id);
      return newState;
    }
  } else {
    // Pas de jet d'esquive nécessaire, déplacer directement
    const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
    newState.players[attackerIdx].pos = { ...to };

    // Calculer le coût en PM : distance seulement (le blocage coûtera 1 PM supplémentaire)
    const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - distance);

    // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
    const mover = newState.players[attackerIdx];
    if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
      return awardTouchdown(newState, mover.team, mover);
    }
  }

  // 2. Effectuer le blocage après le mouvement
  const updatedAttacker = newState.players.find(p => p.id === attacker.id);
  const updatedTarget = newState.players.find(p => p.id === target.id);

  if (!updatedAttacker || !updatedTarget) return newState;

  // Vérifier que le blocage est toujours possible après le mouvement
  if (!canBlock(newState, updatedAttacker.id, updatedTarget.id)) {
    // Si le blocage n'est plus possible, enregistrer l'action et terminer
    newState = setPlayerAction(newState, attacker.id, 'BLITZ');
    newState = checkPlayerTurnEnd(newState, attacker.id);
    return newState;
  }

  // Calculer les assists
  const offensiveAssists = calculateOffensiveAssists(newState, updatedAttacker, updatedTarget);
  const defensiveAssists = calculateDefensiveAssists(newState, updatedAttacker, updatedTarget);

  // Nombre de dés et qui choisit
  const attackerStrength = updatedAttacker.st + offensiveAssists;
  const targetStrength = updatedTarget.st + defensiveAssists;
  const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
  const chooser = getBlockDiceChooser(attackerStrength, targetStrength);

  // Tirer les dés et enregistrer un choix en attente
  const options = rollBlockDiceManyWithRolls(rng, diceCount);

  // Log de l'action de blitz
  const blitzLogEntry = createLogEntry(
    'action',
    `Blitz: mouvement vers (${to.x}, ${to.y}) puis blocage de ${updatedTarget.name}`,
    attacker.id,
    attacker.team
  );
  newState.gameLog = [...newState.gameLog, blitzLogEntry];

  // Enregistrer l'action de blitz AVANT de créer le pendingBlock
  newState = setPlayerAction(newState, attacker.id, 'BLITZ');

  // Incrémenter le compteur de blitz de l'équipe
  newState = incrementTeamBlitzCount(newState, attacker.team);

  // Vérifier si le joueur porte la balle et est dans l'en-but adverse après le mouvement
  const mover = newState.players.find(p => p.id === attacker.id);
  if (mover && mover.hasBall && isInOpponentEndzone(newState, mover)) {
    return awardTouchdown(newState, mover.team, mover);
  }

  return {
    ...newState,
    pendingBlock: {
      attackerId: updatedAttacker.id,
      targetId: updatedTarget.id,
      options: options.map(o => o.result),
      chooser,
      offensiveAssists,
      defensiveAssists,
      totalStrength: attackerStrength,
      targetStrength,
    },
  };
}

/**
 * Gère une action de passe
 */
function handlePass(state: GameState, move: { type: 'PASS'; playerId: string; targetId: string }, rng: RNG): GameState {
  const passer = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!passer || !target) return state;
  if (!passer.hasBall) return state;
  if (passer.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, passer.id)) return state;

  // Animosity check: roll D6 before pass if passer dislikes target
  let currentState = state;
  if (hasAnimosityAgainst(passer, target)) {
    const animResult = checkAnimosity(currentState, passer, target, rng);
    currentState = animResult.newState;
    if (!animResult.passed) {
      // Player refuses — activation ends, no turnover
      currentState = setPlayerAction(currentState, passer.id, 'PASS');
      currentState = checkPlayerTurnEnd(currentState, passer.id);
      return currentState;
    }
  }

  let newState = executePass(currentState, passer, target, rng);
  newState = setPlayerAction(newState, passer.id, 'PASS');
  newState = checkPlayerTurnEnd(newState, passer.id);
  return newState;
}

/**
 * Gère une action de remise (handoff)
 */
function handleHandoff(state: GameState, move: { type: 'HANDOFF'; playerId: string; targetId: string }, rng: RNG): GameState {
  const passer = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!passer || !target) return state;
  if (!passer.hasBall) return state;
  if (passer.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, passer.id)) return state;
  if (!isAdjacent(passer.pos, target.pos)) return state;

  // Animosity check: roll D6 before handoff if passer dislikes target
  let currentState = state;
  if (hasAnimosityAgainst(passer, target)) {
    const animResult = checkAnimosity(currentState, passer, target, rng);
    currentState = animResult.newState;
    if (!animResult.passed) {
      // Player refuses — activation ends, no turnover
      currentState = setPlayerAction(currentState, passer.id, 'HANDOFF');
      currentState = checkPlayerTurnEnd(currentState, passer.id);
      return currentState;
    }
  }

  let newState = executeHandoff(currentState, passer, target, rng);
  newState = setPlayerAction(newState, passer.id, 'HANDOFF');
  newState = checkPlayerTurnEnd(newState, passer.id);
  return newState;
}

/**
 * Gère une action de Lancer de Coéquipier (Throw Team-Mate)
 */
function handleThrowTeamMate(
  state: GameState,
  move: { type: 'THROW_TEAM_MATE'; playerId: string; thrownPlayerId: string; targetPos: Position },
  rng: RNG,
): GameState {
  const thrower = state.players.find(p => p.id === move.playerId);
  const thrown = state.players.find(p => p.id === move.thrownPlayerId);

  if (!thrower || !thrown) return state;
  if (thrower.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, thrower.id)) return state;
  if (!canThrowTeamMate(state, thrower, thrown)) return state;

  // Vérifier que la cible est dans la portée
  const range = getThrowRange(thrower.pos, move.targetPos);
  if (!range) return state;

  let newState = executeThrowTeamMate(state, thrower, thrown, move.targetPos, rng);
  newState = setPlayerAction(newState, thrower.id, 'THROW_TEAM_MATE');
  newState = checkPlayerTurnEnd(newState, thrower.id);
  return newState;
}

/**
 * Gère une action de faute
 */
function handleFoul(state: GameState, move: { type: 'FOUL'; playerId: string; targetId: string }, rng: RNG): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!attacker || !target) return state;
  if (attacker.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, attacker.id)) return state;

  // Vérifier la limite de 1 foul par tour
  const team = attacker.team;
  if ((state.teamFoulCount && state.teamFoulCount[team] || 0) >= 1) return state;

  if (!canFoul(state, attacker, target)) return state;

  let newState = executeFoul(state, attacker, target, rng);

  // Incrémenter le compteur de foul
  const currentFoulCount = newState.teamFoulCount || {};
  newState.teamFoulCount = {
    ...currentFoulCount,
    [team]: (currentFoulCount[team] || 0) + 1,
  };

  newState = setPlayerAction(newState, attacker.id, 'FOUL');
  newState = checkPlayerTurnEnd(newState, attacker.id);
  return newState;
}

/**
 * Gère une action de Regard Hypnotique (Hypnotic Gaze)
 */
function handleHypnoticGaze(
  state: GameState,
  move: { type: 'HYPNOTIC_GAZE'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const gazer = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!gazer || !target) return state;
  if (gazer.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, gazer.id)) return state;
  if (!canHypnoticGaze(state, gazer, target)) return state;

  let newState = executeHypnoticGaze(state, gazer, target, rng);
  newState = setPlayerAction(newState, gazer.id, 'HYPNOTIC_GAZE');
  newState = checkPlayerTurnEnd(newState, gazer.id);
  return newState;
}

/**
 * Gère une action de Vomissement Projectile (Projectile Vomit)
 */
function handleProjectileVomit(
  state: GameState,
  move: { type: 'PROJECTILE_VOMIT'; playerId: string; targetId: string },
  rng: RNG,
): GameState {
  const vomiter = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!vomiter || !target) return state;
  if (vomiter.team !== state.currentPlayer) return state;
  if (hasPlayerActed(state, vomiter.id)) return state;
  if (!canProjectileVomit(state, vomiter, target)) return state;

  let newState = executeProjectileVomit(state, vomiter, target, rng);
  newState = setPlayerAction(newState, vomiter.id, 'PROJECTILE_VOMIT');
  newState = checkPlayerTurnEnd(newState, vomiter.id);
  return newState;
}
