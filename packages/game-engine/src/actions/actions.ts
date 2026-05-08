/**
 * Actions et mouvements pour Blood Bowl
 * Gère l'application des mouvements, les jets de dés et la logique de jeu
 */

import { GameState, Move, Position, RNG } from '../core/types';
// S27.8.12 — `hasSkill` consomme uniquement par `move-leap-dodge-handlers.ts`
// (handleLeap log entry skill discrimination). Plus d'import direct ici.
import { getDodgeSkillModifiers } from '../skills/skill-bridge';
// S27.8.11 — `inBounds` consomme uniquement dans `actions/legal-moves.ts`.
// S27.8.12 — `samePos` consomme uniquement par `move-leap-dodge-handlers.ts`
// (handleLeap/handleMove/handleDodge legality checks et ball pickup).
// `requiresDodgeRoll` / `calculateDodgeModifiers` consommes par les
// memes handlers extraits — plus d'import direct ici, mais conserves
// pour `handleBlitz` qui reste dans ce fichier (consommateur direct).
import {
  requiresDodgeRoll,
  calculateDodgeModifiers,
} from '../mechanics/movement';
// S27.8.8 — Tous les helpers de des bruts (`performDodgeRoll`,
// `rollBlockDice`, `blockResultFromRoll`, etc.) sont consommes dans
// les modules extraits (`block-action`, `move-handlers`,
// `choice-handlers`, `failure-helpers`, `ball-pickup`, `pass-actions`).
// `actions.ts` ne consomme plus que les variantes With Notification
// pour handleDodge et handleBlitz.
import { rollBlockDiceManyWithRolls } from '../utils/dice';
import {
  performDodgeRollWithNotification,
  performArmorRollWithNotification,
} from '../utils/dice-notifications';
import { performInjuryRoll } from '../mechanics/injury';
import { createLogEntry, truncateGameLog } from '../utils/logging';
import {
  checkTouchdowns,
  isInOpponentEndzone,
  awardTouchdown,
  bounceBall,
} from '../mechanics/ball';
import {
  canBlock,
  canBlitz,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  calculateBlockDiceCount,
  getBlockDiceChooser,
} from '../mechanics/blocking';
// S27.8.11 — `canPlayerMove` / `canPlayerContinueMoving` /
// `shouldAutoEndTurn` / `canTeamBlitz` consommes uniquement dans
// `actions/legal-moves.ts`. Plus d'import direct ici.
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
  handlePlayerSwitch,
  incrementTeamBlitzCount,
} from '../core/game-state';
// S27.8.2 — `executePass` / `executeHandoff` / `getPassRange` /
// `canAttemptPassForRange` consommes dans `actions/pass-actions.ts`
// et (pour les helpers `can*`/`get*Range`) dans `actions/legal-moves.ts`
// depuis S27.8.11. Plus d'import direct ici.
// S27.8.3 — `canFoul` / `executeFoul` consommes uniquement dans
// `actions/turn-foul-actions.ts`. Plus d'import direct ici.
import { applyApothecaryChoice } from '../mechanics/apothecary';
// S27.8.2 — `executeThrowTeamMate` consomme dans
// `actions/pass-actions.ts`. S27.8.11 — `canThrowTeamMate` + `getThrowRange`
// consommes dans `actions/legal-moves.ts`. Plus d'import direct ici.
// S27.8.1 — Les handlers d'actions speciales (gaze/vomit/stab/chainsaw/
// ball-and-chain/bomb) sont extraits dans `actions/special-actions.ts`.
// S27.8.11 — Les helpers `canHypnoticGaze` / `canProjectileVomit` /
// `canStab` / `canChainsaw` consommes uniquement dans
// `actions/legal-moves.ts`. Plus d'import direct ici.
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
// S27.8.11 — `applyPickupFailure` consomme uniquement par les
// modules extraits (ball-pickup, move-handlers). Plus d'import
// direct ici.
// S27.8.12 — `applyRollFailure` consomme uniquement par
// `move-leap-dodge-handlers.ts` (handleLeap echec). Plus d'import ici.
// S27.8.5 — `handleBallPickup` extrait dans `actions/ball-pickup.ts`.
// S27.8.6 — `handleDodgeRoll` et `handleNormalMove` extraits dans
// `actions/move-handlers.ts`. S27.8.12 — handleMove (qui les appelle)
// rejoint `move-leap-dodge-handlers.ts` ; plus d'import direct ici.
// S27.8.7 — Choix utilisateur (BLOCK_CHOOSE / PUSH_CHOOSE /
// FOLLOW_UP_CHOOSE / REROLL_CHOOSE) extraits dans
// `actions/choice-handlers.ts`. Aucun cycle vers actions.ts.
import {
  handleBlockChoose,
  handlePushChoose,
  handleFollowUpChoose,
  handleRerollChoose,
} from './choice-handlers';
// S27.8.8 — `handleBlock` extrait dans `actions/block-action.ts`.
// S27.8.10 — `handleMultiBlock`, `resolveMultipleBlock`, `resolveFrenzyBlock`
// rejoignent egalement `block-action.ts` (toutes block-related, sans
// dependance vers `actions.ts`).
// S27.8.12 — `handleDumpOffChoose` rejoint aussi `block-action.ts`
// (cohesion : termine en relancant `handleBlock`).
import {
  handleBlock,
  handleMultiBlock,
  resolveFrenzyBlock,
  resolveMultipleBlock,
  handleDumpOffChoose,
} from './block-action';
// S27.8.12 — `handleLeap`, `handleMove`, `handleDodge` extraits dans
// `actions/move-leap-dodge-handlers.ts` (apres S27.8.11 qui a brise
// le cycle via `legal-moves.ts`).
import {
  handleLeap,
  handleMove,
  handleDodge,
} from './move-leap-dodge-handlers';
// S27.8.11 — `canDumpOff` / `getDumpOffReceivers` consommes par
// `block-action.ts` (handleBlock pendingDumpOff).
// S27.8.12 — `executeDumpOff` consomme par `block-action.ts`
// (`handleDumpOffChoose` y a migre). Plus d'import direct ici.
// S27.8.11 — `checkDauntless` consomme uniquement par `block-action.ts`
// (handleBlock) et `blitz-handler.ts` (s'il existe). Plus d'import ici.
// S27.8.12 — `checkBreakTackle` consomme uniquement par
// `move-leap-dodge-handlers.ts` (handleDodge break tackle gate) et
// par `handleBlitz` qui reste ici. On garde l'import car `handleBlitz`
// l'utilise encore.
import { checkBreakTackle } from '../mechanics/break-tackle';
// S27.8.7 — `isFendActiveForFollowUp` consomme uniquement dans
// `actions/choice-handlers.ts` (handlePushChoose).
// S27.8.12 — `resolveShadowingAfterDodge` consomme uniquement par
// `move-leap-dodge-handlers.ts` (handleDodge). `handleBlitz` qui
// reste ici l'importe directement aussi — on garde l'import.
import { resolveShadowingAfterDodge } from '../mechanics/shadowing';
// S27.8.7 — `hasFrenzy` consomme uniquement dans
// `actions/choice-handlers.ts` (handlePushChoose).
// S27.8.11 — `getArmBarBonus` consomme uniquement par `block-action.ts`.
// Plus d'import direct ici.
// S27.8.10 — `canPerformMultipleBlock` / `markMultipleBlockUsed` consommes
// uniquement dans `actions/block-action.ts` (handleMultiBlock).
// S27.8.2 — On the Ball flow consomme uniquement dans
// `actions/pass-actions.ts`. Plus d'import direct ici.
import {
  resolveKickoffPerfectDefence,
  resolveKickoffHighKick,
  resolveKickoffQuickSnap,
  resolveKickoffBlitz,
} from '../mechanics/kickoff-resolution';
// S27.8.11 — `canInstablePerformAction` et `logInstablePrevention`
// consommes uniquement dans `actions/legal-moves.ts` (et les autres
// modules block/move qui les importent directement). Plus d'import
// direct ici.
import { checkBoneHead, checkReallyStupid, checkWildAnimal, checkAnimalSavagery, checkTakeRoot, checkBloodlust, checkFoulAppearance } from '../mechanics/negative-traits';
// S27.8.11 — `canLeap` (re-alias `playerCanLeap`) et
// `getLegalLeapDestinations` consommes uniquement dans
// `actions/legal-moves.ts`.
// S27.8.12 — `getLeapModifier` + `performLeapRoll` consommes
// uniquement par `move-leap-dodge-handlers.ts` (handleLeap). Plus
// d'import direct ici.

// S27.8.11 — `getLegalMoves` + `getAdjacentOpponents` (variante locale)
// extraits dans `actions/legal-moves.ts`. Re-export pour preserver
// l'API publique consommee par `index.ts`, `ai/*`, `utils/referee.ts`,
// etc. Import local separe car `handleLeap`/`handleMove`/`handleDodge`
// continuent a verifier la legalite via `getLegalMoves`. La variante
// locale de `getAdjacentOpponents` reste privee au nouveau module
// (comportement preserve : ne filtre que `stunned`).
import { getLegalMoves } from './legal-moves';
export { getLegalMoves };

// S27.8.5 — `canUseTeamReroll` deplace dans `core/game-state.ts` pour
// pouvoir etre consomme par les handlers extraits (ball-leap-actions
// notamment) sans creer de cycle d'import vers `actions.ts`.

// S27.8.10 — `resolveFrenzyBlock` / `handleMultiBlock` / `resolveMultipleBlock`
// extraits dans `actions/block-action.ts` (re-importes en haut de ce fichier).

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

// S27.8.12 — `handleLeap`, `handleMove`, `handleDodge` extraits dans
// `actions/move-leap-dodge-handlers.ts`. L'extraction est devenue
// possible apres S27.8.11 qui a sorti `getLegalMoves` dans son
// propre module : le cycle d'import qui empechait jusque-la cette
// migration est leve.
// `handleDumpOffChoose` rejoint `actions/block-action.ts` car il
// termine en relancant `handleBlock` (cohesion thematique avec le
// flux de blocage / dump-off).
//
// S27.8.5 — `handleBallPickup` extrait dans `actions/ball-pickup.ts`.
// S27.8.6 — `handleDodgeRoll` / `handleNormalMove` extraits dans
// `actions/move-handlers.ts`.
// S27.8.8 — `handleBlock` extrait dans `actions/block-action.ts`.


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
