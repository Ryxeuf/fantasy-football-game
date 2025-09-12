/**
 * Actions et mouvements pour Blood Bowl
 * Gère l'application des mouvements, les jets de dés et la logique de jeu
 */

import { GameState, Move, Player, Position, TeamId, RNG, BlockResult } from '../core/types';
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
} from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { checkTouchdowns, isInOpponentEndzone, awardTouchdown, bounceBall } from '../mechanics/ball';
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
} from '../core/game-state';

/**
 * Obtient tous les mouvements légaux pour l'état actuel
 * @param state - État du jeu
 * @returns Liste des mouvements possibles
 */
export function getLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [{ type: 'END_TURN' }];
  const team = state.currentPlayer;

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
 * Applique un mouvement à l'état du jeu
 * @param state - État du jeu
 * @param move - Mouvement à appliquer
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état du jeu
 */
export function applyMove(state: GameState, move: Move, rng: RNG): GameState {
  // Si c'est un turnover, on ne peut que finir le tour
  if (state.isTurnover && move.type !== 'END_TURN') {
    return state;
  }

  switch (move.type) {
    case 'END_TURN':
      return handleEndTurn(state);
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
    default:
      return checkTouchdowns(state);
  }
}

/**
 * Gère la fin de tour
 */
function handleEndTurn(state: GameState): GameState {
  // Changement de tour - le porteur de ballon garde le ballon
  const newState: GameState = {
    ...state,
    currentPlayer: state.currentPlayer === 'A' ? 'B' : 'A',
    turn: state.currentPlayer === 'B' ? state.turn + 1 : state.turn,
    selectedPlayerId: null,
    players: state.players.map(p => ({ ...p, pm: p.ma })),
    isTurnover: false,
    lastDiceResult: undefined,
    playerActions: new Map<string, any>(), // Réinitialiser les actions
    teamBlitzCount: new Map<TeamId, number>(), // Réinitialiser les compteurs de blitz
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
  return advanceHalfIfNeeded(checkTouchdowns(newState));
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
  // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée)
  const dodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);

  // Effectuer le jet d'esquive avec les modificateurs
  const dodgeResult = performDodgeRoll(player, rng, dodgeModifiers);

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
  next.players[idx].pos = { ...to };
  next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);

  // Enregistrer l'action de mouvement seulement si c'est le premier mouvement
  if (!hasPlayerActed(next, player.id)) {
    next = setPlayerAction(next, player.id, 'MOVE');
  }

  // Vérifier si le tour du joueur doit se terminer
  next = checkPlayerTurnEnd(next, player.id);

  if (dodgeResult.success) {
    // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
    const mover = next.players[idx];
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }
  } else {
    // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
    next.isTurnover = true;

    // Le joueur chute (est mis à terre)
    next.players[idx].stunned = true;

    // Effectuer le jet d'armure
    const armorResult = performArmorRoll(next.players[idx], rng);
    next.lastDiceResult = armorResult;

    // Log du jet d'armure
    const armorLogEntry = createLogEntry(
      'dice',
      `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
      next.players[idx].id,
      next.players[idx].team,
      {
        diceRoll: armorResult.diceRoll,
        targetNumber: armorResult.targetNumber,
        success: armorResult.success,
      }
    );
    next.gameLog = [...next.gameLog, armorLogEntry];

    // Si le joueur avait le ballon, il le perd et le ballon rebondit
    if (next.players[idx].hasBall) {
      next.players[idx].hasBall = false;
      next.ball = { ...next.players[idx].pos };
      // Faire rebondir le ballon depuis la position du joueur
      return bounceBall(next, rng);
    }
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
  // Pas de jet nécessaire : mouvement normal
  let next = structuredClone(state) as GameState;
  next.players[idx].pos = { ...to };
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
  // Calculer les modificateurs de pickup (malus pour adversaires marquant la balle)
  const pickupModifiers = calculatePickupModifiers(state, state.ball!, player.team);

  // Effectuer le jet de pickup
  const pickupResult = performPickupRoll(player, rng, pickupModifiers);

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
    // Échec de pickup : la balle rebondit et turnover
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

  // Calculer les modificateurs de désquive (malus pour adversaires à l'arrivée)
  const dodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);

  const dodgeResult = performDodgeRoll(player, rng, dodgeModifiers);

  const next = structuredClone(state) as GameState;
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
    // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
    const mover = next.players[idx];
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }
  } else {
    // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
    next.isTurnover = true;

    // Le joueur chute (est mis à terre)
    next.players[idx].stunned = true;

    // Log de la chute
    const fallLogEntry = createLogEntry(
      'action',
      `Joueur sonné après échec d'esquive`,
      player.id,
      player.team
    );
    next.gameLog = [...next.gameLog, fallLogEntry];

    // Effectuer le jet d'armure
    const armorResult = performArmorRoll(next.players[idx], rng);
    next.lastDiceResult = armorResult;

    // Log du jet d'armure
    const armorLogEntry = createLogEntry(
      'dice',
      `Jet d'armure: ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
      next.players[idx].id,
      next.players[idx].team,
      {
        diceRoll: armorResult.diceRoll,
        targetNumber: armorResult.targetNumber,
        success: armorResult.success,
      }
    );
    next.gameLog = [...next.gameLog, armorLogEntry];

    // Si le joueur avait le ballon, il le perd et le ballon rebondit
    if (next.players[idx].hasBall) {
      next.players[idx].hasBall = false;
      next.ball = { ...next.players[idx].pos };

      // Log de la perte de ballon
      const ballLossLogEntry = createLogEntry(
        'action',
        `Ballon perdu après chute`,
        player.id,
        player.team
      );
      next.gameLog = [...next.gameLog, ballLossLogEntry];

      // Faire rebondir le ballon depuis la position du joueur
      return bounceBall(next, rng);
    }
  }

  return next;
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
    const blockResult = rollBlockDice(rng);
    const diceRoll = Math.floor(rng() * 6) + 1; // Simuler le jet de dé pour le log (1-6)
    const blockDiceResult = {
      type: 'block' as const,
      playerId: attacker.id,
      targetId: target.id,
      diceRoll: diceRoll,
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
    const options = rollBlockDiceManyWithRolls(rng, diceCount);

    // Log des dés lancés
    const blockLogEntry = createLogEntry(
      'dice',
      `Blocage: ${options.map(o => o.diceRoll).join(', ')} (${diceCount} dés)`,
      attacker.id,
      attacker.team,
      { diceRolls: options.map(o => o.diceRoll), diceCount, offensiveAssists, defensiveAssists }
    );
    newState.gameLog = [...newState.gameLog, blockLogEntry];

    return {
      ...newState,
      pendingBlock: {
        attackerId: attacker.id,
        targetId: target.id,
        options: options.map(o => o.result),
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
    // Calculer les modificateurs de désquive
    const dodgeModifiers = calculateDodgeModifiers(newState, from, to, attacker.team);

    // Effectuer le jet d'esquive
    const dodgeResult = performDodgeRoll(attacker, rng, dodgeModifiers);

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
      const armorResult = performArmorRoll(newState.players[attackerIdx], rng);
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
