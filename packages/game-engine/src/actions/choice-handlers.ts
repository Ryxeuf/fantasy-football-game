/**
 * S27.8.7 — Handlers de choix (suite a un blocage / poussee /
 * follow-up / relance d'equipe) extraits de `actions.ts`.
 *
 * Trois handlers cohesifs autour des phases de choix utilisateur
 * apres un evenement initial :
 *  - `handleBlockChoose` : choix du resultat de des de bloc apres
 *    un blocage qui a roule plusieurs des (l'attaquant ou le
 *    defenseur via Both Down + Block / Wrestle).
 *  - `handlePushChoose` : choix de la direction de poussee parmi
 *    celles disponibles (Fend, Frenzy, chain push).
 *  - `handleFollowUpChoose` : confirmation du suivi (follow-up)
 *    apres une poussee classique.
 *
 * S27.8.14 — `handleRerollChoose` (le plus gros, ~199 lignes incluant
 * `getLonerThreshold` et `consumeTeamReroll`) extrait dans
 * `actions/reroll-choose-handler.ts` pour ramener ce module sous la
 * cible secondaire DoD `<= 400 lignes`. Re-exporte ici pour preserver
 * l'API consommee par `actions.ts` et les tests.
 *
 * Aucune dependance interne au dispatcher : tout passe par les
 * modules deja extraits (`failure-helpers`, `ball-pickup`,
 * `reroll-choose-handler`) + `core/game-state` + `mechanics/*`.
 */

// S27.8.14 — `Player` consomme uniquement par `getLonerThreshold` qui
// a migre vers `reroll-choose-handler.ts`. Plus d'import direct ici.
import type {
  GameState,
  Position,
  RNG,
  BlockResult,
} from '../core/types';
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
  getPlayerAction,
} from '../core/game-state';
import {
  resolveBlockResult,
  applyChainPush,
} from '../mechanics/blocking';
import { isFendActiveForFollowUp } from '../mechanics/fend';
import { hasFrenzy } from '../mechanics/frenzy';
// S27.8.14 — `isInOpponentEndzone`, `awardTouchdown`, `samePos`
// consommes uniquement par `reroll-choose-handler.ts`. Plus d'import
// direct ici. `checkTouchdowns` reste utilise par `handleBlockChoose`
// et `handleFollowUpChoose`.
import { checkTouchdowns } from '../mechanics/ball';
import { createLogEntry } from '../utils/logging';

// S27.8.14 — `handleRerollChoose` (incluant les helpers prives
// `getLonerThreshold` et `consumeTeamReroll`) extrait dans
// `actions/reroll-choose-handler.ts`. Re-export pour preserver
// l'API consommee par `actions.ts`.
export { handleRerollChoose } from './reroll-choose-handler';

/**
 * Gere le choix de resultat de blocage parmi les des roules.
 */
export function handleBlockChoose(
  state: GameState,
  move: {
    type: 'BLOCK_CHOOSE';
    playerId: string;
    targetId: string;
    result: BlockResult;
  },
  rng: RNG,
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingBlock ||
    state.pendingBlock.attackerId !== attacker.id ||
    state.pendingBlock.targetId !== target.id
  ) {
    return state; // pas de choix attendu
  }

  // Construire un resultat complet a partir du choix
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

  let newState = resolveBlockResult(
    { ...state, pendingBlock: undefined, lastDiceResult: undefined },
    blockResult,
    rng,
  );

  // Determiner si c'etait un blitz ou un blocage normal
  // Si le joueur a deja l'action BLITZ enregistree, c'est un blitz
  // Sinon, c'est un blocage normal
  const isBlitz =
    hasPlayerActed(state, attacker.id) &&
    getPlayerAction(state, attacker.id) === 'BLITZ';

  if (isBlitz) {
    // Pour un blitz, consommer 1 PM supplementaire pour le blocage
    const attackerIdx = newState.players.findIndex(
      (p) => p.id === attacker.id,
    );
    if (attackerIdx !== -1) {
      newState.players[attackerIdx].pm = Math.max(
        0,
        newState.players[attackerIdx].pm - 1,
      );
    }

    // Enregistrer l'action de blitz
    newState = setPlayerAction(newState, attacker.id, 'BLITZ');

    // Pour un blitz, ne pas terminer l'activation du joueur - il
    // peut continuer a bouger sauf si c'est un turnover.
    if (!newState.isTurnover) {
      // Le joueur peut continuer a bouger apres le blocage
    } else {
      // En cas de turnover, terminer l'activation
      newState = checkPlayerTurnEnd(newState, attacker.id);
    }
  } else {
    // Pour un blocage normal, terminer l'activation
    newState = setPlayerAction(newState, attacker.id, 'BLOCK');
    newState = checkPlayerTurnEnd(newState, attacker.id);
  }

  return newState;
}

/**
 * Gere le choix de direction de poussee.
 *
 * BUG fix : avant, l'appel a `applyChainPush` utilisait
 * `() => Math.random()` localement. Le chain push peut surfer un
 * joueur dans la foule (jet d'injury crowd) : avec Math.random,
 * le resultat etait non-deterministe et brisait la rejouabilite
 * des replays (seed -> outcome). Passer le RNG seede du dispatcher.
 */
export function handlePushChoose(
  state: GameState,
  move: {
    type: 'PUSH_CHOOSE';
    playerId: string;
    targetId: string;
    direction: Position;
  },
  rng: RNG,
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);
  if (!attacker || !target) return state;
  if (
    !state.pendingPushChoice ||
    state.pendingPushChoice.attackerId !== attacker.id ||
    state.pendingPushChoice.targetId !== target.id
  ) {
    return state; // pas de choix de poussee attendu
  }

  // Verifier que la direction choisie est valide
  const isValidDirection = state.pendingPushChoice.availableDirections.some(
    (dir) => dir.x === move.direction.x && dir.y === move.direction.y,
  );
  if (!isValidDirection) return state;

  // Appliquer la poussee dans la direction choisie (avec chain push
  // si occupee)
  const newTargetPos = {
    x: target.pos.x + move.direction.x,
    y: target.pos.y + move.direction.y,
  };

  let newState = { ...state, pendingPushChoice: undefined } as GameState;

  // Fend : verifier avant la poussee (la cible doit etre debout). Sur
  // POW/STUMBLE sans Dodge, la cible est deja stunned avant d'arriver
  // ici, donc isFendActiveForFollowUp renverra false naturellement.
  const fendActive = isFendActiveForFollowUp(newState, attacker, target);

  // Chain push : si la destination est occupee, pousser le joueur qui
  // y est d'abord. Utilise le RNG seede du dispatcher pour conserver
  // la rejouabilite (surfs en chaine peuvent declencher des injury
  // crowd rolls).
  newState = applyChainPush(newState, target.id, move.direction, rng);

  const frenzyActive = hasFrenzy(attacker) && !!newState.pendingFrenzyBlock;

  if (fendActive) {
    const fendLog = createLogEntry(
      'action',
      `${target.name} utilise Fend : ${attacker.name} ne peut pas suivre`,
      target.id,
      target.team,
      { skill: 'fend' },
    );
    newState.gameLog = [...newState.gameLog, fendLog];
    // Fend annule le suivi -> pas de second bloc frenzy
    newState.pendingFrenzyBlock = undefined;
  } else if (frenzyActive) {
    // Frenzy : follow-up obligatoire
    newState.players = newState.players.map((p) =>
      p.id === attacker.id ? { ...p, pos: target.pos } : p,
    );
    const frenzyFollowLog = createLogEntry(
      'action',
      `${attacker.name} suit ${target.name} (Frenzy — obligatoire)`,
      attacker.id,
      attacker.team,
      { skill: 'frenzy' },
    );
    newState.gameLog = [...newState.gameLog, frenzyFollowLog];
  } else {
    // Demander confirmation pour le follow-up
    newState.pendingFollowUpChoice = {
      attackerId: attacker.id,
      targetId: target.id,
      targetNewPosition: newTargetPos,
      targetOldPosition: target.pos,
    };
  }

  // Log de la poussee
  const pushLog = createLogEntry(
    'action',
    `${target.name} repoussé vers (${newTargetPos.x}, ${newTargetPos.y}) par ${attacker.name}`,
    attacker.id,
    attacker.team,
  );
  newState.gameLog = [...newState.gameLog, pushLog];

  return checkTouchdowns(newState);
}

/**
 * Gere le choix de follow-up apres une poussee classique.
 */
export function handleFollowUpChoose(
  state: GameState,
  move: {
    type: 'FOLLOW_UP_CHOOSE';
    playerId: string;
    targetId: string;
    followUp: boolean;
  },
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);
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
    // L'attaquant suit le joueur pousse
    newState.players = newState.players.map((p) =>
      p.id === attacker.id
        ? { ...p, pos: state.pendingFollowUpChoice!.targetOldPosition }
        : p,
    );

    const followUpLog = createLogEntry(
      'action',
      `${attacker.name} suit ${target.name} (follow-up)`,
      attacker.id,
      attacker.team,
    );
    newState.gameLog = [...newState.gameLog, followUpLog];
  } else {
    const noFollowUpLog = createLogEntry(
      'action',
      `${attacker.name} ne suit pas ${target.name}`,
      attacker.id,
      attacker.team,
    );
    newState.gameLog = [...newState.gameLog, noFollowUpLog];
  }

  return checkTouchdowns(newState);
}
