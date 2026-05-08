/**
 * S27.8.10 / S27.8.12 / S27.8.15 — Module dedie aux flux block-related
 * autres que `handleBlock` lui-meme :
 *  - `resolveFrenzyBlock` : second bloc Frenzy automatique apres
 *    resolution d'un push.
 *  - `handleMultiBlock` : second bloc declenche par le skill
 *    `multiple-block`.
 *  - `resolveMultipleBlock` : nettoie le flag `pendingMultipleBlock`.
 *  - `handleDumpOffChoose` : choix Dump-off de la cible (S27.8.12).
 *
 * S27.8.15 — `handleBlock` (le plus gros, ~200 lignes) extrait dans
 * `actions/block-handler.ts` pour ramener ce module sous la cible
 * secondaire DoD `<= 400 lignes`. Re-exporte ici pour preserver
 * l'API consommee par `actions.ts` et les tests.
 *
 * Aucune dependance interne au dispatcher. Les fonctions de ce
 * module appellent `handleBlock` (depuis `block-handler.ts`) et
 * elles-memes en boucle controlee — dependance unidirectionnelle.
 */

import type { GameState, RNG } from '../core/types';
// S27.8.15 — `setPlayerAction` consomme uniquement par `block-handler.ts`
// (handleBlock). Plus d'import direct ici.
import { isAdjacent } from '../mechanics/movement';
import { executeDumpOff } from '../mechanics/dump-off';
import {
  canPerformMultipleBlock,
  markMultipleBlockUsed,
} from '../mechanics/multiple-block';
import { createLogEntry } from '../utils/logging';

// S27.8.15 — `handleBlock` extrait dans `actions/block-handler.ts`.
// Re-export pour preserver l'API consommee par `actions.ts` et les
// tests existants.
import { handleBlock } from './block-handler';
export { handleBlock };


/**
 * S27.8.10 — Resout le second bloc Frenzy si `pendingFrenzyBlock` est defini
 * et qu'il n'y a plus de choix en attente (push / follow-up). Appel
 * conditionnel depuis `applyMove` apres chaque handler susceptible de
 * terminer un push.
 */
export function resolveFrenzyBlock(state: GameState, rng: RNG): GameState {
  if (!state.pendingFrenzyBlock) return state;
  // Ne pas resoudre tant qu'un choix de push ou follow-up est en attente
  if (state.pendingPushChoice || state.pendingFollowUpChoice) return state;

  const { attackerId, targetId } = state.pendingFrenzyBlock;
  const attacker = state.players.find((p) => p.id === attackerId);
  const target = state.players.find((p) => p.id === targetId);

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

  // Executer le second bloc via handleBlock — en passant par la mecanique
  // standard (assists, des, resolution).
  return handleBlock(
    next,
    { type: 'BLOCK', playerId: attackerId, targetId },
    rng,
  );
}

/**
 * S27.8.10 — Declare un Multiple Block : l'attaquant cible deux adversaires
 * adjacents. Applique le premier bloc ; le second est differe via
 * `pendingMultipleBlock` et resolu par `resolveMultipleBlock` apres la fin du
 * premier (push/follow-up eventuels termines).
 */
export function handleMultiBlock(
  state: GameState,
  move: {
    type: 'MULTI_BLOCK';
    playerId: string;
    firstTargetId: string;
    secondTargetId: string;
  },
  rng: RNG,
): GameState {
  if (
    !canPerformMultipleBlock(
      state,
      move.playerId,
      move.firstTargetId,
      move.secondTargetId,
    )
  ) {
    return state;
  }
  const attacker = state.players.find((p) => p.id === move.playerId);
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
  const logged: GameState = {
    ...withPending,
    gameLog: [...withPending.gameLog, declareLog],
  };

  return handleBlock(
    logged,
    { type: 'BLOCK', playerId: move.playerId, targetId: move.firstTargetId },
    rng,
  );
}

/**
 * S27.8.10 — Resout le second bloc d'une sequence Multiple Block une fois que
 * le premier bloc est entierement resolu (plus de pending block/push/follow-up
 * /reroll et pas de turnover). Si l'attaquant n'est plus adjacent a la
 * seconde cible, le second bloc est annule (loggue).
 */
export function resolveMultipleBlock(state: GameState, rng: RNG): GameState {
  if (!state.pendingMultipleBlock) return state;
  // Attendre la fin de toute resolution en cours (dice / push / follow-up /
  // reroll / frenzy).
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

  // Si le second bloc a deja ete lance (secondTargetId absent), la sequence
  // est terminee : on nettoie le flag.
  if (!secondTargetId) {
    return { ...state, pendingMultipleBlock: undefined };
  }

  const attacker = state.players.find((p) => p.id === attackerId);
  const target = state.players.find((p) => p.id === secondTargetId);

  // Un turnover interrompt la sequence — on nettoie sans lancer le second
  // bloc.
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
  const withLog: GameState = {
    ...launching,
    gameLog: [...launching.gameLog, secondLog],
  };

  const afterSecondBlock = handleBlock(
    withLog,
    { type: 'BLOCK', playerId: attackerId, targetId: secondTargetId },
    rng,
  );

  // Appel recursif : si le second bloc s'est resolu immediatement sans
  // pending, on nettoie le flag dans la meme dispatch.
  return resolveMultipleBlock(afterSecondBlock, rng);
}

/**
 * S27.8.12 — `handleDumpOffChoose` migre depuis `actions.ts`.
 *
 * Gere le choix de Dump-off : la cible d'un blocage (porteuse du
 * ballon, skill `dump-off`) choisit un receveur pour une Passe Rapide,
 * ou passe son tour de Dump-off (`receiverId = null`). Apres
 * resolution, le blocage initial reprend via `handleBlock` avec
 * `skipDumpOff: true` pour eviter une nouvelle demande de delestage.
 *
 * Cohesion thematique avec `block-action.ts` : la fonction termine en
 * relancant `handleBlock` ; elle n'avait aucune raison de rester dans
 * le dispatcher monolithique.
 */
export function handleDumpOffChoose(
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
