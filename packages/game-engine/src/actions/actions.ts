/**
 * Actions et mouvements pour Blood Bowl
 * Gère l'application des mouvements, les jets de dés et la logique de jeu
 */

// S27.8.13 — Apres extraction de `handleBlitz` dans `blitz-handler.ts`,
// `actions.ts` ne contient plus que le dispatcher `applyMove`. Tous les
// imports specifiques aux handlers extraits S27.8.x ont ete nettoyes.
// Les seuls imports restants sont :
//  - les types de l'API publique (`GameState`, `Move`, `RNG`),
//  - les helpers utilises directement dans le dispatcher
//    (`hasPlayerActed`, `applyApothecaryChoice`, `checkTouchdowns`,
//    `truncateGameLog`),
//  - les fonctions de check de traits negatifs (Bone Head, Really
//    Stupid, etc.) appelees au debut de chaque action,
//  - les resolutions kickoff (4 routes du dispatcher),
//  - tous les `handle*` extraits dans des modules dedies.
import { GameState, Move, RNG } from '../core/types';
import { truncateGameLog } from '../utils/logging';
import { checkTouchdowns } from '../mechanics/ball';
import { hasPlayerActed } from '../core/game-state';
import { applyApothecaryChoice } from '../mechanics/apothecary';
// S27.8.1 — Handlers d'actions speciales (gaze/vomit/stab/chainsaw/
// ball-and-chain/bomb) extraits dans `actions/special-actions.ts`.
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
// S27.8.13 — `handleBlitz` extrait dans `actions/blitz-handler.ts`.
import { handleBlitz } from './blitz-handler';
// S27.8.13 — Helpers Kickoff + traits negatifs consommes directement
// dans `applyMove`. Tous les autres helpers ont migre avec leurs
// handlers respectifs (block-action, move-leap-dodge-handlers,
// blitz-handler, pass-actions, turn-foul-actions, etc.).
import {
  resolveKickoffPerfectDefence,
  resolveKickoffHighKick,
  resolveKickoffQuickSnap,
  resolveKickoffBlitz,
} from '../mechanics/kickoff-resolution';
import { checkBoneHead, checkReallyStupid, checkWildAnimal, checkAnimalSavagery, checkTakeRoot, checkBloodlust } from '../mechanics/negative-traits';

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

  // Si c'est un turnover, on ne peut que finir le tour OU compléter la
  // résolution d'un coup en cours (push/follow-up choice, reroll,
  // apothecary, on-the-ball, block-choice multi-dés, dump-off receiver).
  //
  // BUG fix : avant, BLOCK_CHOOSE et DUMP_OFF_CHOOSE étaient absents de
  // cette whitelist. Si un turnover était set après le jet de dés d'un
  // BLOCK multi-dés mais AVANT que le coach ne choisisse le résultat
  // (e.g. cascade Frenzy / chained Push), le dispatcher rejetait le
  // BLOCK_CHOOSE → seul END_TURN restait → **softlock** car le choix
  // de dé n'était jamais résolu.
  if (
    state.isTurnover &&
    move.type !== 'END_TURN' &&
    move.type !== 'PUSH_CHOOSE' &&
    move.type !== 'FOLLOW_UP_CHOOSE' &&
    move.type !== 'REROLL_CHOOSE' &&
    move.type !== 'APOTHECARY_CHOOSE' &&
    move.type !== 'ON_THE_BALL_MOVE' &&
    move.type !== 'ON_THE_BALL_DECLINE' &&
    move.type !== 'BLOCK_CHOOSE' &&
    move.type !== 'DUMP_OFF_CHOOSE'
  ) {
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
      return resolveMultipleBlock(resolveFrenzyBlock(handlePushChoose(activeState, move, rng), rng), rng);
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


// S27.8.13 — `handleBlitz` extrait dans `actions/blitz-handler.ts`.
// Aucun cycle vers `actions.ts` (helpers leaf uniquement). Avec cette
// extraction, `actions.ts` descend sous la cible DoD `<= 600 lignes`.
//
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
