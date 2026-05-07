/**
 * Actions et mouvements pour Blood Bowl
 * Gère l'application des mouvements, les jets de dés et la logique de jeu
 */

import { GameState, Move, Player, Position, TeamId, RNG, BlockResult, ActionType } from '../core/types';
import { hasSkill } from '../skills/skill-effects';
import { getDodgeSkillModifiers, getPickupSkillModifiers, canSkillReroll } from '../skills/skill-bridge';
import { collectModifiers } from '../skills/skill-registry';
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
  // S27.8.7 — `performPickupRollWithNotification` consomme uniquement
  // dans `actions/choice-handlers.ts`. Plus d'import direct ici.
  performArmorRollWithNotification,
  rollBlockDiceWithNotification,
  rollBlockDiceManyWithNotification,
} from '../utils/dice-notifications';
import { performInjuryRoll } from '../mechanics/injury';
import { createLogEntry, truncateGameLog } from '../utils/logging';
import {
  checkTouchdowns,
  isInOpponentEndzone,
  awardTouchdown,
  bounceBall,
} from '../mechanics/ball';
// S27.8.2 — `hasAnimosityAgainst` / `checkAnimosity` consommes uniquement
// dans `actions/pass-actions.ts` (handlePass + handleHandoff). Plus
// d'import direct ici.
import {
  canBlock,
  canBlitz,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  calculateBlockDiceCount,
  getBlockDiceChooser,
  resolveBlockResult,
  // S27.8.7 — `applyChainPush` consomme uniquement dans
  // `actions/choice-handlers.ts` (handlePushChoose).
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
  // S27.8.3 — `advanceHalfIfNeeded` et `handlePostTouchdown` consommes
  // uniquement dans `actions/turn-foul-actions.ts` (handleEndTurn).
  canTeamBlitz,
  // S27.8.5 — `canUseTeamReroll` deplace dans `core/game-state.ts`.
  canUseTeamReroll,
} from '../core/game-state';
// S27.8.2 — `executePass` / `executeHandoff` consommes dans
// `actions/pass-actions.ts`. `getPassRange` + `canAttemptPassForRange`
// restent ici car utilises dans `getLegalMoves`.
import { getPassRange, canAttemptPassForRange } from '../mechanics/passing';
// S27.8.2 — Running Pass consomme uniquement dans
// `actions/pass-actions.ts`. Plus d'import direct ici.
// S27.8.3 — `canFoul` / `executeFoul` consommes uniquement dans
// `actions/turn-foul-actions.ts`. Plus d'import direct ici.
import { isAdjacent } from '../mechanics/movement';
import { applyApothecaryChoice } from '../mechanics/apothecary';
// S27.8.2 — `executeThrowTeamMate` consomme dans
// `actions/pass-actions.ts`. `canThrowTeamMate` + `getThrowRange`
// restent ici car utilises dans `getLegalMoves`.
import { canThrowTeamMate, getThrowRange } from '../mechanics/throw-team-mate';
import { canHypnoticGaze } from '../mechanics/hypnotic-gaze';
import { canProjectileVomit } from '../mechanics/projectile-vomit';
import { canStab } from '../mechanics/stab';
import { canChainsaw } from '../mechanics/chainsaw';
// S27.8.1 — Les handlers d'actions speciales (gaze/vomit/stab/chainsaw/
// ball-and-chain/bomb) sont extraits dans `actions/special-actions.ts`
// pour reduire la taille de ce fichier monolithique. Les helpers `can*`
// restent importes directement ici pour `getLegalMoves` qui les
// consomme aussi.
import {
  handleHypnoticGaze,
  handleProjectileVomit,
  handleStab,
  handleChainsaw,
  handleBallAndChain,
  handleBombThrow,
} from './special-actions';
// S27.8.2 — Famille pass (PASS, ON_THE_BALL_MOVE, ON_THE_BALL_DECLINE,
// HANDOFF, THROW_TEAM_MATE) extraite dans `actions/pass-actions.ts`.
import {
  handlePass,
  handleOnTheBallMove,
  handleOnTheBallDecline,
  handleHandoff,
  handleThrowTeamMate,
} from './pass-actions';
// S27.8.3 — Fin de tour + faute (END_PLAYER_TURN, END_TURN, FOUL)
// extraits dans `actions/turn-foul-actions.ts`.
import {
  handleEndPlayerTurn,
  handleEndTurn,
  handleFoul,
} from './turn-foul-actions';
// S27.8.4 — Helpers d'echec (applyRollFailure / applyPickupFailure)
// extraits dans `actions/failure-helpers.ts`. Reutilises par
// handleNormalMove / handleDodgeRoll / handleRerollChoose / handleLeap
// / handleBallPickup. Permet aux extractions ulterieures de ces
// handlers de ne pas dependre cycliquement de `actions.ts`.
import {
  applyRollFailure,
  applyPickupFailure,
} from './failure-helpers';
// S27.8.5 — `handleBallPickup` extrait dans `actions/ball-pickup.ts`
// pour servir de feuille reutilisable par handleNormalMove /
// handleDodgeRoll / handleLeap / handleRerollChoose.
import { handleBallPickup } from './ball-pickup';
// S27.8.6 — `handleDodgeRoll` et `handleNormalMove` extraits dans
// `actions/move-handlers.ts`. Appeles depuis `handleMove` (qui reste
// dans ce fichier car couple a `getLegalMoves`).
import {
  handleDodgeRoll,
  handleNormalMove,
} from './move-handlers';
// S27.8.7 — Choix utilisateur (BLOCK_CHOOSE / PUSH_CHOOSE /
// FOLLOW_UP_CHOOSE / REROLL_CHOOSE) extraits dans
// `actions/choice-handlers.ts`. Aucun cycle vers actions.ts.
import {
  handleBlockChoose,
  handlePushChoose,
  handleFollowUpChoose,
  handleRerollChoose,
} from './choice-handlers';
import { canDumpOff, getDumpOffReceivers, executeDumpOff } from '../mechanics/dump-off';
import { checkDauntless } from '../mechanics/dauntless';
import { checkBreakTackle } from '../mechanics/break-tackle';
// S27.8.7 — `isFendActiveForFollowUp` consomme uniquement dans
// `actions/choice-handlers.ts` (handlePushChoose).
import { resolveShadowingAfterDodge } from '../mechanics/shadowing';
// S27.8.7 — `hasFrenzy` consomme uniquement dans
// `actions/choice-handlers.ts` (handlePushChoose).
import { getArmBarBonus } from '../mechanics/arm-bar';
import {
  canPerformMultipleBlock,
  markMultipleBlockUsed,
} from '../mechanics/multiple-block';
// S27.8.2 — On the Ball flow consomme uniquement dans
// `actions/pass-actions.ts`. Plus d'import direct ici.
import {
  resolveKickoffPerfectDefence,
  resolveKickoffHighKick,
  resolveKickoffQuickSnap,
  resolveKickoffBlitz,
} from '../mechanics/kickoff-resolution';
import { checkBoneHead, checkReallyStupid, checkWildAnimal, checkAnimalSavagery, checkTakeRoot, checkBloodlust, checkFoulAppearance, canInstablePerformAction, logInstablePrevention } from '../mechanics/negative-traits';
import {
  canLeap as playerCanLeap,
  getLeapModifier,
  performLeapRoll,
  getLegalLeapDestinations,
} from '../mechanics/leap';

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

    // Actions de Saut (LEAP / Pogo Stick) — 2 cases de mouvement, test d'AG,
    // ignore les zones de tacle au depart.
    // MVP: on exige p.pm >= 2 (pas de leap-via-GFI pour l'instant).
    if (playerCanLeap(p) && p.pm >= 2) {
      const leapDests = getLegalLeapDestinations(state, p.pos);
      for (const to of leapDests) {
        moves.push({ type: 'LEAP', playerId: p.id, to });
      }
    }

    // Actions de blocage
    const adjacentOpponents = getAdjacentOpponents(state, p.pos, p.team);
    for (const opponent of adjacentOpponents) {
      if (canBlock(state, p.id, opponent.id)) {
        moves.push({ type: 'BLOCK', playerId: p.id, targetId: opponent.id });
      }
    }

    // Blitz au contact : un joueur qui a commencé à se déplacer peut bloquer
    // un adversaire adjacent si l'équipe peut encore blitzer
    const playerAction = state.playerActions?.[p.id];
    if (playerAction === 'MOVE' && canTeamBlitz(state, p.team) && p.pm > 0) {
      for (const opponent of adjacentOpponents) {
        // Éviter les doublons si canBlock a déjà ajouté ce BLOCK
        const alreadyHasBlock = moves.some(
          m => m.type === 'BLOCK' && m.playerId === p.id && m.targetId === opponent.id
        );
        if (!alreadyHasBlock && !opponent.stunned && opponent.team !== p.team) {
          moves.push({ type: 'BLOCK', playerId: p.id, targetId: opponent.id });
        }
      }
    }

    // Actions de blitz (mouvement + blocage atomique, pour les joueurs pas encore déplacés)
    if (!playerAction) {
      for (const d of dirs) {
        const to = { x: p.pos.x + d.x, y: p.pos.y + d.y };
        if (!inBounds(state, to)) continue;
        if (occ.has(`${to.x},${to.y}`)) continue;

        const allOpponents = state.players.filter(opp => opp.team !== p.team && !opp.stunned);
        for (const opponent of allOpponents) {
          if (canBlitz(state, p.id, to, opponent.id)) {
            moves.push({ type: 'BLITZ', playerId: p.id, to, targetId: opponent.id });
          }
        }
      }
    }

    // Actions de passe (PASS) - le joueur doit avoir le ballon et pas encore agi
    // Passes interdites pendant le tour de blitz kickoff
    // Instable: prohibition — le joueur ne peut pas declarer d'action de passe
    if (p.hasBall && !hasPlayerActed(state, p.id) && !state.kickoffBlitzTurn && canInstablePerformAction(p, 'PASS')) {
      const teammates = state.players.filter(
        t => t.team === team && t.id !== p.id && !t.stunned && t.state === 'active'
      );
      for (const target of teammates) {
        const range = getPassRange(p.pos, target.pos);
        if (canAttemptPassForRange(p, range)) {
          moves.push({ type: 'PASS', playerId: p.id, targetId: target.id });
        }
      }
    }

    // Actions de remise (HANDOFF) - le joueur doit avoir le ballon, cible adjacente
    // Remises interdites pendant le tour de blitz kickoff
    // Instable: prohibition — le joueur ne peut pas declarer d'action de remise
    if (p.hasBall && !hasPlayerActed(state, p.id) && !state.kickoffBlitzTurn && canInstablePerformAction(p, 'HANDOFF')) {
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
    // Instable: prohibition — le joueur ne peut pas declarer d'action de lancer de coequipier
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'throw-team-mate') && canInstablePerformAction(p, 'THROW_TEAM_MATE')) {
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

    // Actions de Poignard (STAB)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'stab')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canStab(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'STAB', playerId: p.id, targetId: target.id });
      }
    }

    // Actions de Tronçonneuse (CHAINSAW)
    if (!hasPlayerActed(state, p.id) && hasSkill(p, 'chainsaw')) {
      const adjacentOpponents = state.players.filter(
        opp => opp.team !== team && canChainsaw(state, p, opp)
      );
      for (const target of adjacentOpponents) {
        moves.push({ type: 'CHAINSAW', playerId: p.id, targetId: target.id });
      }
    }

    // END_PLAYER_TURN : permet d'arrêter l'activation d'un joueur en cours
    const pAction = state.playerActions?.[p.id];
    if (pAction === 'MOVE' || pAction === 'BLITZ') {
      moves.push({ type: 'END_PLAYER_TURN', playerId: p.id });
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

// S27.8.5 — `canUseTeamReroll` deplace dans `core/game-state.ts` pour
// pouvoir etre consomme par les handlers extraits (ball-leap-actions
// notamment) sans creer de cycle d'import vers `actions.ts`.

/**
 * Résout le second bloc Frenzy si `pendingFrenzyBlock` est défini et qu'il
 * n'y a plus de choix en attente (push / follow-up). Appel conditionnel
 * depuis `applyMove` après chaque handler susceptible de terminer un push.
 */
function resolveFrenzyBlock(state: GameState, rng: RNG): GameState {
  if (!state.pendingFrenzyBlock) return state;
  // Ne pas résoudre tant qu'un choix de push ou follow-up est en attente
  if (state.pendingPushChoice || state.pendingFollowUpChoice) return state;

  const { attackerId, targetId } = state.pendingFrenzyBlock;
  const attacker = state.players.find(p => p.id === attackerId);
  const target = state.players.find(p => p.id === targetId);

  // Consommer le pending
  const next: GameState = { ...state, pendingFrenzyBlock: undefined };

  // Conditions pour le second bloc : attaquant et cible debout et adjacents
  if (!attacker || !target) return next;
  if (attacker.stunned || target.stunned) return next;
  if (!isAdjacent(attacker.pos, target.pos)) return next;

  const frenzyLog = createLogEntry(
    'action',
    `${attacker.name} effectue un second blocage (Frenzy) contre ${target.name} !`,
    attacker.id,
    attacker.team,
    { skill: 'frenzy' },
  );
  next.gameLog = [...next.gameLog, frenzyLog];

  // Exécuter le second bloc via handleBlock — en passant par la mécanique
  // standard (assists, dés, résolution).
  return handleBlock(
    next,
    { type: 'BLOCK', playerId: attackerId, targetId },
    rng,
  );
}

/**
 * Declare un Multiple Block : l'attaquant cible deux adversaires adjacents.
 * Applique le premier bloc ; le second est differe via `pendingMultipleBlock`
 * et resolu par `resolveMultipleBlock` apres la fin du premier (push/follow-up
 * eventuels termines).
 */
function handleMultiBlock(
  state: GameState,
  move: { type: 'MULTI_BLOCK'; playerId: string; firstTargetId: string; secondTargetId: string },
  rng: RNG,
): GameState {
  if (!canPerformMultipleBlock(state, move.playerId, move.firstTargetId, move.secondTargetId)) {
    return state;
  }
  const attacker = state.players.find(p => p.id === move.playerId);
  if (!attacker) return state;

  // Marquer l'usage AVANT le premier bloc (one-shot par tour d'equipe) et
  // poser le flag actif qui provoque le -2 ST dans handleBlock.
  const prepared: GameState = markMultipleBlockUsed(state, attacker.team);
  const withPending: GameState = {
    ...prepared,
    pendingMultipleBlock: {
      attackerId: attacker.id,
      secondTargetId: move.secondTargetId,
    },
  };

  const declareLog = createLogEntry(
    'action',
    `${attacker.name} declare un Blocage Multiple (Multiple Block) !`,
    attacker.id,
    attacker.team,
    { skill: 'multiple-block' },
  );
  const logged: GameState = { ...withPending, gameLog: [...withPending.gameLog, declareLog] };

  return handleBlock(
    logged,
    { type: 'BLOCK', playerId: move.playerId, targetId: move.firstTargetId },
    rng,
  );
}

/**
 * Resout le second bloc d'une sequence Multiple Block une fois que le premier
 * bloc est entierement resolu (plus de pending block/push/follow-up/reroll et
 * pas de turnover). Si l'attaquant n'est plus adjacent a la seconde cible, le
 * second bloc est annule (loggue).
 */
function resolveMultipleBlock(state: GameState, rng: RNG): GameState {
  if (!state.pendingMultipleBlock) return state;
  // Attendre la fin de toute resolution en cours (dice / push / follow-up / reroll / frenzy).
  if (
    state.pendingBlock ||
    state.pendingPushChoice ||
    state.pendingFollowUpChoice ||
    state.pendingReroll ||
    state.pendingFrenzyBlock
  ) {
    return state;
  }

  const { attackerId, secondTargetId } = state.pendingMultipleBlock;

  // Si le second bloc a deja ete lance (secondTargetId absent), la sequence est
  // terminee : on nettoie le flag.
  if (!secondTargetId) {
    return { ...state, pendingMultipleBlock: undefined };
  }

  const attacker = state.players.find(p => p.id === attackerId);
  const target = state.players.find(p => p.id === secondTargetId);

  // Un turnover interrompt la sequence — on nettoie sans lancer le second bloc.
  if (state.isTurnover || !attacker || !target) {
    return { ...state, pendingMultipleBlock: undefined };
  }

  // Adjacence obligatoire au moment du second bloc (follow-up peut l'avoir
  // deplace). Attaquant et cible debout.
  const secondBlockPossible =
    !attacker.stunned &&
    attacker.pm > 0 &&
    !target.stunned &&
    target.pm > 0 &&
    isAdjacent(attacker.pos, target.pos);

  if (!secondBlockPossible) {
    const cancelledLog = createLogEntry(
      'info',
      `${attacker.name} ne peut pas effectuer le second Blocage Multiple (cible hors de portee).`,
      attacker.id,
      attacker.team,
      { skill: 'multiple-block' },
    );
    return {
      ...state,
      pendingMultipleBlock: undefined,
      gameLog: [...state.gameLog, cancelledLog],
    };
  }

  // Consommer le secondTargetId (mais garder attackerId pour que le -2 ST
  // s'applique aussi au second bloc).
  const launching: GameState = {
    ...state,
    pendingMultipleBlock: { attackerId, secondTargetId: undefined },
  };

  const secondLog = createLogEntry(
    'action',
    `${attacker.name} effectue le second Blocage Multiple contre ${target.name} !`,
    attacker.id,
    attacker.team,
    { skill: 'multiple-block' },
  );
  const withLog: GameState = { ...launching, gameLog: [...launching.gameLog, secondLog] };

  const afterSecondBlock = handleBlock(
    withLog,
    { type: 'BLOCK', playerId: attackerId, targetId: secondTargetId },
    rng,
  );

  // Appel recursif : si le second bloc s'est resolu immediatement sans pending,
  // on nettoie le flag dans la meme dispatch.
  return resolveMultipleBlock(afterSecondBlock, rng);
}

// S27.8.7 — `getLonerThreshold` et `consumeTeamReroll` deplaces
// dans `actions/choice-handlers.ts` (consommes uniquement par
// `handleRerollChoose`).

// S27.8.4 — applyRollFailure / applyPickupFailure extraits dans
// `actions/failure-helpers.ts` (re-importes en haut de ce fichier).

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

  // Si un pendingOnTheBall est en attente, seuls ON_THE_BALL_MOVE/DECLINE et END_TURN sont acceptés
  if (state.pendingOnTheBall && move.type !== 'ON_THE_BALL_MOVE' && move.type !== 'ON_THE_BALL_DECLINE' && move.type !== 'END_TURN') {
    return state;
  }

  // Pendant le tour de blitz kickoff, les passes et remises sont interdites
  if (state.kickoffBlitzTurn && (move.type === 'PASS' || move.type === 'HANDOFF')) {
    return state;
  }

  // Si c'est un turnover, on ne peut que finir le tour
  // Exception : PUSH_CHOOSE, FOLLOW_UP_CHOOSE et REROLL_CHOOSE font partie de la résolution
  if (state.isTurnover && move.type !== 'END_TURN' && move.type !== 'PUSH_CHOOSE' && move.type !== 'FOLLOW_UP_CHOOSE' && move.type !== 'REROLL_CHOOSE' && move.type !== 'APOTHECARY_CHOOSE' && move.type !== 'ON_THE_BALL_MOVE' && move.type !== 'ON_THE_BALL_DECLINE') {
    return state;
  }

  // ─── Negative trait activation checks (Bone Head, etc.) ───────────────
  // These run once at the start of a player's activation (first action only).
  // If the check fails, the player's activation ends without executing the action.
  let activeState = state;
  const ACTIVATION_MOVE_TYPES: string[] = [
    'MOVE', 'LEAP', 'DODGE', 'BLOCK', 'MULTI_BLOCK', 'BLITZ', 'PASS', 'HANDOFF',
    'THROW_TEAM_MATE', 'FOUL', 'HYPNOTIC_GAZE', 'PROJECTILE_VOMIT', 'STAB',
    'CHAINSAW', 'BALL_AND_CHAIN', 'BOMB_THROW',
  ];
  if (ACTIVATION_MOVE_TYPES.includes(move.type) && 'playerId' in move) {
    const playerId = (move as { playerId: string }).playerId;
    const player = state.players.find(p => p.id === playerId);
    if (player && !hasPlayerActed(state, player.id)) {
      const boneHeadCheck = checkBoneHead(state, player, rng);
      if (!boneHeadCheck.passed) return boneHeadCheck.newState;
      activeState = boneHeadCheck.newState;

      const reallyStupidCheck = checkReallyStupid(activeState, player, rng);
      if (!reallyStupidCheck.passed) return reallyStupidCheck.newState;
      activeState = reallyStupidCheck.newState;

      const wildAnimalCheck = checkWildAnimal(activeState, player, rng, move.type);
      if (!wildAnimalCheck.passed) return wildAnimalCheck.newState;
      activeState = wildAnimalCheck.newState;

      const animalSavageryCheck = checkAnimalSavagery(activeState, player, rng);
      if (!animalSavageryCheck.passed) return animalSavageryCheck.newState;
      activeState = animalSavageryCheck.newState;

      const takeRootCheck = checkTakeRoot(activeState, player, rng);
      if (!takeRootCheck.passed) return takeRootCheck.newState;
      activeState = takeRootCheck.newState;

      const bloodlustCheck = checkBloodlust(activeState, player, rng, move.type);
      if (!bloodlustCheck.passed) return bloodlustCheck.newState;
      activeState = bloodlustCheck.newState;
    }
  }

  switch (move.type) {
    case 'END_TURN':
      // S25.9 — borne `gameLog` au start-of-turn (apres END_TURN). Sans
      // ce cap, le log du serveur grandit indefiniment sur les longs
      // matches (cf. broadcasts deja tronques en S22+ via game-broadcast).
      // 200 entrees laisse une marge confortable au-dessus du seuil
      // broadcast (100) pour que les lookups historiques cote serveur
      // disposent d'un buffer.
      return truncateGameLog(handleEndTurn(activeState, rng), 200);
    case 'END_PLAYER_TURN':
      return handleEndPlayerTurn(activeState, move);
    case 'MOVE':
      return handleMove(activeState, move, rng);
    case 'LEAP':
      return handleLeap(activeState, move, rng);
    case 'DODGE':
      return handleDodge(activeState, move, rng);
    case 'BLOCK':
      return resolveMultipleBlock(resolveFrenzyBlock(handleBlock(activeState, move, rng), rng), rng);
    case 'MULTI_BLOCK':
      return resolveMultipleBlock(resolveFrenzyBlock(handleMultiBlock(activeState, move, rng), rng), rng);
    case 'BLOCK_CHOOSE':
      return resolveMultipleBlock(resolveFrenzyBlock(handleBlockChoose(activeState, move, rng), rng), rng);
    case 'PUSH_CHOOSE':
      return resolveMultipleBlock(resolveFrenzyBlock(handlePushChoose(activeState, move), rng), rng);
    case 'FOLLOW_UP_CHOOSE':
      return resolveMultipleBlock(resolveFrenzyBlock(handleFollowUpChoose(activeState, move), rng), rng);
    case 'BLITZ':
      return handleBlitz(activeState, move, rng);
    case 'REROLL_CHOOSE':
      return resolveMultipleBlock(resolveFrenzyBlock(handleRerollChoose(activeState, move, rng), rng), rng);
    case 'APOTHECARY_CHOOSE':
      return resolveMultipleBlock(resolveFrenzyBlock(applyApothecaryChoice(activeState, move.useApothecary, rng), rng), rng);
    case 'PASS':
      return handlePass(activeState, move, rng);
    case 'HANDOFF':
      return handleHandoff(activeState, move, rng);
    case 'THROW_TEAM_MATE':
      return handleThrowTeamMate(activeState, move, rng);
    case 'FOUL':
      return handleFoul(activeState, move, rng);
    case 'HYPNOTIC_GAZE':
      return handleHypnoticGaze(activeState, move, rng);
    case 'PROJECTILE_VOMIT':
      return handleProjectileVomit(activeState, move, rng);
    case 'STAB':
      return handleStab(activeState, move, rng);
    case 'CHAINSAW':
      return handleChainsaw(activeState, move, rng);
    case 'BALL_AND_CHAIN':
      return handleBallAndChain(activeState, move, rng);
    case 'BOMB_THROW':
      return handleBombThrow(activeState, move, rng);
    case 'DUMP_OFF_CHOOSE':
      return handleDumpOffChoose(activeState, move, rng);
    case 'KICKOFF_PERFECT_DEFENCE':
      return resolveKickoffPerfectDefence(activeState, move.positions);
    case 'KICKOFF_HIGH_KICK':
      return resolveKickoffHighKick(activeState, move.playerId);
    case 'KICKOFF_QUICK_SNAP':
      return resolveKickoffQuickSnap(activeState, move.moves);
    case 'KICKOFF_BLITZ_RESOLVE':
      return resolveKickoffBlitz(activeState);
    case 'ON_THE_BALL_MOVE':
      return handleOnTheBallMove(activeState, move, rng);
    case 'ON_THE_BALL_DECLINE':
      return handleOnTheBallDecline(activeState, rng);
    default:
      return checkTouchdowns(activeState);
  }
}

/**
 * Termine l'activation d'un joueur (met fin à son mouvement/action en cours)
 */
// S27.8.3 — handleEndPlayerTurn / handleEndTurn extraits dans
// `actions/turn-foul-actions.ts`.

/**
 * Gère un mouvement simple
 */
/**
 * Gère une action LEAP (Saut) — compétence Leap ou trait Pogo Stick.
 *
 * Le joueur saute 2 cases (distance Chebyshev) depuis sa position actuelle.
 * Un seul test d'Agilité est effectué, qui remplace le jet d'esquive quand le
 * joueur quitte des zones de tacle. Coûte 2 points de mouvement.
 * Échec = le joueur tombe à la case d'arrivée (armure + blessure + turnover
 * s'il portait le ballon).
 */
function handleLeap(
  state: GameState,
  move: { type: 'LEAP'; playerId: string; to: Position },
  rng: RNG
): GameState {
  const idx = state.players.findIndex(p => p.id === move.playerId);
  if (idx === -1) return state;

  // Gestion du changement de joueur actif
  const newState = handlePlayerSwitch(state, move.playerId);

  // Vérifier que ce LEAP est bien légal (skill, distance, case libre, PM suffisants)
  const legal = getLegalMoves(newState).some(
    m => m.type === 'LEAP' && m.playerId === move.playerId && samePos(m.to, move.to)
  );
  if (!legal) return newState;

  if (newState.isTurnover) return newState;

  const player = newState.players[idx];
  const modifiers = getLeapModifier(player);

  // Jet d'Agilité pour le saut
  const leapResult = performLeapRoll(player, rng, modifiers);

  let next = structuredClone(newState) as GameState;
  next.lastDiceResult = leapResult;

  const leapLogEntry = createLogEntry(
    'dice',
    `Saut (Leap): ${leapResult.diceRoll}/${leapResult.targetNumber} ${leapResult.success ? '✓' : '✗'}`,
    player.id,
    player.team,
    {
      diceRoll: leapResult.diceRoll,
      targetNumber: leapResult.targetNumber,
      success: leapResult.success,
      modifiers,
      skill: hasSkill(player, 'pogo-stick') ? 'pogo-stick' : 'leap',
    }
  );
  next.gameLog = [...next.gameLog, leapLogEntry];

  // Déplacer le joueur vers la case d'arrivée et consommer 2 PM
  next.players[idx].pos = { ...move.to };
  next.players[idx].pm = Math.max(0, next.players[idx].pm - 2);

  // Enregistrer l'action de mouvement si c'est le premier mouvement
  if (!hasPlayerActed(next, player.id)) {
    next = setPlayerAction(next, player.id, 'MOVE');
  }

  next = checkPlayerTurnEnd(next, player.id);

  if (!leapResult.success) {
    // Échec : le joueur tombe à la case d'arrivée (armure + blessure + turnover)
    return applyRollFailure(next, idx, rng);
  }

  // Succès : pas de jet d'esquive nécessaire même si on quittait des zones de tacle.
  // Touchdown si on porte la balle et qu'on atteint l'en-but adverse.
  const mover = next.players[idx];
  if (mover.hasBall && isInOpponentEndzone(next, mover)) {
    return awardTouchdown(next, mover.team, mover);
  }

  // Ramassage de balle si on atterrit sur le ballon.
  if (next.ball && samePos(next.ball, move.to)) {
    return handleBallPickup(next, player, rng, idx);
  }

  return next;
}

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

// S27.8.5 — `handleBallPickup` extrait dans `actions/ball-pickup.ts`
// (re-importe en haut de ce fichier).
// S27.8.6 — `handleDodgeRoll` et `handleNormalMove` extraits dans
// `actions/move-handlers.ts` (re-importes en haut de ce fichier).

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

  // Shadowing : résolu après le mouvement, indépendamment du résultat (BB3).
  next = resolveShadowingAfterDodge(next, player, from, rng);

  // Break Tackle (BB3): +1/+2 une fois par activation sur un Dodge raté.
  let dodgeSucceeded = dodgeResult.success;
  if (!dodgeSucceeded) {
    const breakTackleCheck = checkBreakTackle(
      next,
      next.players[idx],
      dodgeResult.diceRoll,
      dodgeResult.targetNumber,
      dodgeResult.success
    );
    if (breakTackleCheck.triggered) {
      next = breakTackleCheck.newState;
      dodgeSucceeded = true;
    }
  }

  if (dodgeSucceeded) {
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
      next.players[idx].state = 'stunned';
      next.players[idx].stunned = true;
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
  rng: RNG,
  options: { skipDumpOff?: boolean } = {}
): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!attacker || !target) return state;

  // Détecter un blitz pendant un mouvement : le joueur a déjà bougé et blitz un adversaire adjacent
  const playerAction = state.playerActions?.[move.playerId];
  const isBlitzDuringMove = playerAction === 'MOVE' && canTeamBlitz(state, attacker.team);

  if (isBlitzDuringMove) {
    // Vérifier manuellement les conditions du blitz-block (sans canBlock qui exige pm > 0)
    if (attacker.stunned || target.stunned || attacker.team === target.team) return state;
    if (!isAdjacent(attacker.pos, target.pos)) return state;
  } else {
    // Vérifier que le blocage est légal
    if (!canBlock(state, move.playerId, move.targetId)) return state;
  }

  // ─── Dump-off check ────────────────────────────────────────────────────
  // Si la cible possède le skill `dump-off` et a le ballon, elle peut
  // effectuer une Passe Rapide immédiate avant que les dés de bloc soient
  // lancés. On interrompt le blocage en posant `pendingDumpOff`. Le blocage
  // reprend ensuite via `handleDumpOffChoose` (avec `skipDumpOff: true`).
  if (!options.skipDumpOff && canDumpOff(state, target)) {
    const receivers = getDumpOffReceivers(state, target);
    if (receivers.length > 0) {
      const dumpLog = createLogEntry(
        'info',
        `${target.name} peut tenter un Délestage (Dump-off) !`,
        target.id,
        target.team,
        { skill: 'dump-off' },
      );
      return {
        ...state,
        gameLog: [...state.gameLog, dumpLog],
        pendingDumpOff: {
          attackerId: attacker.id,
          targetId: target.id,
          receiverOptions: receivers.map(r => r.id),
          pendingBlockMove: {
            type: 'BLOCK',
            playerId: move.playerId,
            targetId: move.targetId,
          },
        },
      };
    }
  }

  // ─── Foul Appearance check ─────────────────────────────────────────────
  // Rolled by the attacker before any block dice. On 1, the declared action
  // is wasted (no turnover) and the attacker's activation ends.
  const foulAppearanceCheck = checkFoulAppearance(state, attacker, target, rng, isBlitzDuringMove);
  if (!foulAppearanceCheck.shouldContinueBlock) {
    return foulAppearanceCheck.newState;
  }
  const stateAfterFA = foulAppearanceCheck.newState;

  // Calculer les assists
  const offensiveAssists = calculateOffensiveAssists(stateAfterFA, attacker, target);
  const defensiveAssists = calculateDefensiveAssists(stateAfterFA, attacker, target);

  // S27.7.3 — Modifiers ST de l'attaquant collectes via le registry :
  // Horns +1 ST (Blitz uniquement), Multiple Block -2 ST (sequence
  // active), futurs skills ST. Plus de hardcode dans la mecanique :
  // tout passe par `collectModifiers(..., 'on-block-attacker',
  // { state, opponent, isBlitz })`.
  const attackerSkillStMods = collectModifiers(attacker, 'on-block-attacker', {
    state: stateAfterFA,
    opponent: target,
    isBlitz: isBlitzDuringMove,
  });
  const attackerSkillStBonus = attackerSkillStMods.strengthModifier ?? 0;

  // Forces de base avant Dauntless (penalite Multiple Block et bonus
  // Horns inclus via `attackerSkillStBonus`).
  const baseAttackerStrength =
    attacker.st + offensiveAssists + attackerSkillStBonus;
  const targetStrength = target.st + defensiveAssists;

  // ─── Dauntless check ───────────────────────────────────────────────────
  // Si l'attaquant a Dauntless et est en desavantage, il tente d'egaliser la force.
  const dauntlessResult = checkDauntless(
    stateAfterFA,
    attacker,
    target,
    baseAttackerStrength,
    targetStrength,
    rng
  );
  const stateAfterDauntless = dauntlessResult.newState;
  const attackerStrength = dauntlessResult.newAttackerStrength;

  // Nombre de dés et qui choisit
  const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
  const chooser = getBlockDiceChooser(attackerStrength, targetStrength);

  // Enregistrer l'action — blitz consomme le compteur de blitz de l'équipe
  let newState: GameState;
  if (isBlitzDuringMove) {
    newState = setPlayerAction(stateAfterDauntless, attacker.id, 'BLITZ');
    newState.teamBlitzCount = {
      ...newState.teamBlitzCount,
      [attacker.team]: (newState.teamBlitzCount[attacker.team] || 0) + 1,
    };
  } else {
    newState = setPlayerAction(stateAfterDauntless, attacker.id, 'BLOCK');
  }

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
 * Gère le choix de Dump-off : la cible d'un blocage (porteuse du ballon, skill
 * `dump-off`) choisit un receveur pour une Passe Rapide, ou passe son tour de
 * Dump-off (receiverId = null). Après résolution, le blocage initial reprend.
 */
function handleDumpOffChoose(
  state: GameState,
  move: { type: 'DUMP_OFF_CHOOSE'; passerId: string; receiverId: string | null },
  rng: RNG
): GameState {
  if (!state.pendingDumpOff) return state;
  if (state.pendingDumpOff.targetId !== move.passerId) return state;

  const pendingMove = state.pendingDumpOff.pendingBlockMove;
  const receiverOptions = state.pendingDumpOff.receiverOptions;

  // Nettoyer le pendingDumpOff dans tous les cas
  const cleared: GameState = { ...state, pendingDumpOff: undefined };

  let afterDumpOff: GameState = cleared;

  if (move.receiverId !== null) {
    // Vérifier que le receveur choisi est bien éligible (évite triche client)
    if (!receiverOptions.includes(move.receiverId)) {
      return cleared;
    }
    afterDumpOff = executeDumpOff(cleared, move.passerId, move.receiverId, rng);
  } else {
    const skipLog = createLogEntry(
      'info',
      `Délestage refusé par le coach défenseur`,
      move.passerId,
      undefined,
      { skill: 'dump-off' },
    );
    afterDumpOff = { ...cleared, gameLog: [...cleared.gameLog, skipLog] };
  }

  // Reprendre le blocage initial en ignorant le nouveau check dump-off
  if (pendingMove.type === 'BLOCK') {
    return handleBlock(afterDumpOff, pendingMove, rng, { skipDumpOff: true });
  }
  // BLITZ : pour l'instant, non intégré (un follow-up portera l'intégration
  // complète dans `handleBlitz`). Fallback : on renvoie l'état post-dump-off.
  return afterDumpOff;
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

  // ─── Foul Appearance check ─────────────────────────────────────────────
  // Rolled by the attacker before the blitz begins. On 1, the declared
  // action is wasted (no turnover) and the attacker's activation ends.
  const foulAppearanceCheck = checkFoulAppearance(state, attacker, target, rng, true);
  if (!foulAppearanceCheck.shouldContinueBlock) {
    return foulAppearanceCheck.newState;
  }

  // Gérer le changement de joueur
  let newState = handlePlayerSwitch(foulAppearanceCheck.newState, move.playerId);

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

    // Shadowing : tentative de suivi après le mouvement (BB3).
    newState = resolveShadowingAfterDodge(newState, attacker, from, rng);

    // Break Tackle (BB3): +1/+2 une fois par activation sur un Dodge raté
    // pendant un Blitz.
    let blitzDodgeSuccess = dodgeResult.success;
    if (!blitzDodgeSuccess) {
      const breakTackleCheck = checkBreakTackle(
        newState,
        newState.players[attackerIdx],
        dodgeResult.diceRoll,
        dodgeResult.targetNumber,
        dodgeResult.success
      );
      if (breakTackleCheck.triggered) {
        newState = breakTackleCheck.newState;
        blitzDodgeSuccess = true;
      }
    }

    if (blitzDodgeSuccess) {
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

// S27.8.2 — handlePass / handleOnTheBallMove / handleOnTheBallDecline /
// handleHandoff / handleThrowTeamMate extraits dans
// `actions/pass-actions.ts` (re-importes en haut de ce fichier).

/**
 * Gère une action de faute
 */
// S27.8.3 — handleFoul extrait dans `actions/turn-foul-actions.ts`.

/**
 * Gère une action de Regard Hypnotique (Hypnotic Gaze)
 */
// S27.8.1 — handleHypnoticGaze / handleProjectileVomit / handleStab /
// handleChainsaw / handleBallAndChain / handleBombThrow extraits dans
// `actions/special-actions.ts` (re-importes en haut de ce fichier).
// S27.8.2 — handlePass / handleOnTheBallMove / handleOnTheBallDecline /
// handleHandoff / handleThrowTeamMate extraits dans
// `actions/pass-actions.ts` (re-importes en haut de ce fichier).
