/**
 * S27.8.8 — Handler de blocage extrait de `actions.ts`.
 *
 * `handleBlock` couvre l'ensemble du flux de blocage standard :
 *  - detection blitz pendant un mouvement (gate `canTeamBlitz`)
 *    vs blocage classique (`canBlock`).
 *  - Dump-off check : la cible peut interrompre le bloc avec une
 *    passe rapide (gate via `canDumpOff` + `getDumpOffReceivers`,
 *    pose `pendingDumpOff`).
 *  - Foul Appearance (1+) : annule le bloc sans turnover.
 *  - Calcul de force : assists offensifs/defensifs, modifiers ST de
 *    skills via `collectModifiers('on-block-attacker')` (Horns sur
 *    Blitz, Multiple Block en sequence).
 *  - Dauntless : tentative d'egalisation si en desavantage.
 *  - Resolution :
 *    - 1 de : roule immediatement et resout via `resolveBlockResult`.
 *    - >1 des : pose `pendingBlock` pour resolution differee par
 *      `handleBlockChoose`.
 *
 * Aucune dependance interne au dispatcher (handleDumpOffChoose,
 * handleMultiBlock, resolveFrenzyBlock, resolveMultipleBlock
 * appellent handleBlock — la dependance est unidirectionnelle, pas
 * cyclique).
 */

import type { GameState, RNG } from '../core/types';
import {
  setPlayerAction,
  canTeamBlitz,
} from '../core/game-state';
import { isAdjacent } from '../mechanics/movement';
import {
  canBlock,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  calculateBlockDiceCount,
  getBlockDiceChooser,
  resolveBlockResult,
} from '../mechanics/blocking';
import { canDumpOff, getDumpOffReceivers, executeDumpOff } from '../mechanics/dump-off';
import { checkFoulAppearance } from '../mechanics/negative-traits';
import { checkDauntless } from '../mechanics/dauntless';
import {
  canPerformMultipleBlock,
  markMultipleBlockUsed,
} from '../mechanics/multiple-block';
import { collectModifiers } from '../skills/skill-registry';
import { blockResultFromRoll } from '../utils/dice';
import { rollBlockDiceManyWithNotification } from '../utils/dice-notifications';
import { createLogEntry } from '../utils/logging';

/**
 * Gere une action de blocage (BLOCK ou Blitz pendant un mouvement).
 *
 * @param options.skipDumpOff Defini a true par `handleDumpOffChoose`
 *   apres resolution d'un dump-off pour eviter une boucle infinie.
 */
export function handleBlock(
  state: GameState,
  move: { type: 'BLOCK'; playerId: string; targetId: string },
  rng: RNG,
  options: { skipDumpOff?: boolean } = {},
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

  if (!attacker || !target) return state;

  // Detecter un blitz pendant un mouvement : le joueur a deja bouge
  // et blitz un adversaire adjacent
  const playerAction = state.playerActions?.[move.playerId];
  const isBlitzDuringMove =
    playerAction === 'MOVE' && canTeamBlitz(state, attacker.team);

  if (isBlitzDuringMove) {
    // Verifier manuellement les conditions du blitz-block (sans
    // canBlock qui exige pm > 0)
    if (attacker.stunned || target.stunned || attacker.team === target.team)
      return state;
    if (!isAdjacent(attacker.pos, target.pos)) return state;
  } else {
    // Verifier que le blocage est legal
    if (!canBlock(state, move.playerId, move.targetId)) return state;
  }

  // ─── Dump-off check ────────────────────────────────────────────────────
  // Si la cible possede le skill `dump-off` et a le ballon, elle peut
  // effectuer une Passe Rapide immediate avant que les des de bloc
  // soient lances. On interrompt le blocage en posant `pendingDumpOff`.
  // Le blocage reprend ensuite via `handleDumpOffChoose` (avec
  // `skipDumpOff: true`).
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
          receiverOptions: receivers.map((r) => r.id),
          pendingBlockMove: {
            type: 'BLOCK',
            playerId: move.playerId,
            targetId: move.targetId,
          },
        },
      };
    }
  }

  // ─── Foul Appearance check ───────────────────────────────────────────
  // Rolled by the attacker before any block dice. On 1, the declared
  // action is wasted (no turnover) and the attacker's activation ends.
  const foulAppearanceCheck = checkFoulAppearance(
    state,
    attacker,
    target,
    rng,
    isBlitzDuringMove,
  );
  if (!foulAppearanceCheck.shouldContinueBlock) {
    return foulAppearanceCheck.newState;
  }
  const stateAfterFA = foulAppearanceCheck.newState;

  // Calculer les assists
  const offensiveAssists = calculateOffensiveAssists(
    stateAfterFA,
    attacker,
    target,
  );
  const defensiveAssists = calculateDefensiveAssists(
    stateAfterFA,
    attacker,
    target,
  );

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
  // Si l'attaquant a Dauntless et est en desavantage, il tente
  // d'egaliser la force.
  const dauntlessResult = checkDauntless(
    stateAfterFA,
    attacker,
    target,
    baseAttackerStrength,
    targetStrength,
    rng,
  );
  const stateAfterDauntless = dauntlessResult.newState;
  const attackerStrength = dauntlessResult.newAttackerStrength;

  // Nombre de des et qui choisit
  const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
  const chooser = getBlockDiceChooser(attackerStrength, targetStrength);

  // Enregistrer l'action — blitz consomme le compteur de blitz de
  // l'equipe
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

  // Si un seul de, resoudre immediatement
  if (diceCount === 1) {
    // Single RNG call: derive both diceRoll and blockResult from same
    // value
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

    // Log du resultat de blocage
    const blockLogEntry = createLogEntry(
      'dice',
      `Blocage: ${diceRoll} → ${blockResult}`,
      attacker.id,
      attacker.team,
      { diceRoll, result: blockResult, offensiveAssists, defensiveAssists },
    );
    newState.gameLog = [...newState.gameLog, blockLogEntry];

    return resolveBlockResult(newState, blockDiceResult, rng);
  } else {
    // Plusieurs des : enregistrer un choix en attente
    const options = rollBlockDiceManyWithNotification(
      rng,
      diceCount,
      attacker.name,
    );

    // Log des des lances (on logge les resultats faute des valeurs
    // brutes)
    const blockLogEntry = createLogEntry(
      'dice',
      `Blocage: ${options.join(', ')} (${diceCount} dés)`,
      attacker.id,
      attacker.team,
      { results: options, diceCount, offensiveAssists, defensiveAssists },
    );
    newState.gameLog = [...newState.gameLog, blockLogEntry];

    return {
      ...newState,
      pendingBlock: {
        attackerId: attacker.id,
        targetId: target.id,
        options,
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
