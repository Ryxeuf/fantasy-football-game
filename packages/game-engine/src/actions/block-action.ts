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
import { canDumpOff, getDumpOffReceivers } from '../mechanics/dump-off';
import { checkFoulAppearance } from '../mechanics/negative-traits';
import { checkDauntless } from '../mechanics/dauntless';
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
