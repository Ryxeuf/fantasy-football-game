/**
 * S27.8.9 — Handler de Blitz extrait de `actions.ts`.
 *
 * Un Blitz combine un mouvement (avec eventuellement esquive + Break Tackle
 * + Shadowing) suivi d'un blocage sur la cible declaree. Le flux :
 *  1. Foul Appearance check sur l'attaquant — un 1 termine l'activation
 *     sans turnover.
 *  2. Mouvement vers `move.to` :
 *     - Si `requiresDodgeRoll`, on calcule les modificateurs (de base +
 *       skills) et on lance le jet d'esquive avec notification. Le
 *       joueur se deplace toujours (succes ou echec).
 *     - Shadowing : tentative de suivi par les adversaires apres dodge.
 *     - Break Tackle (BB3) : peut convertir un dodge rate en succes une
 *       fois par activation.
 *     - Echec final = chute, jet d'armure, blessure si percee, perte de
 *       balle (avec bounce), turnover, fin d'activation.
 *  3. Blocage : recalcul des assists offensifs/defensifs, des dices et
 *     du chooser. On pose un `pendingBlock` resolvable par
 *     `handleBlockChoose`. Compteur de blitz d'equipe incremente
 *     (`incrementTeamBlitzCount`).
 *
 * Aucune dependance vers `actions.ts` : helpers leaf uniquement, donc
 * pas de cycle. Re-importe par `actions.ts` dans le dispatcher.
 */

import type { GameState, Position, RNG } from '../core/types';
import {
  setPlayerAction,
  checkPlayerTurnEnd,
  handlePlayerSwitch,
  incrementTeamBlitzCount,
} from '../core/game-state';
import {
  requiresDodgeRoll,
  calculateDodgeModifiers,
} from '../mechanics/movement';
import { getDodgeSkillModifiers } from '../skills/skill-bridge';
import { rollBlockDiceManyWithRolls } from '../utils/dice';
import {
  performDodgeRollWithNotification,
  performArmorRollWithNotification,
} from '../utils/dice-notifications';
import { performInjuryRoll } from '../mechanics/injury';
import { createLogEntry } from '../utils/logging';
import {
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
import { resolveShadowingAfterDodge } from '../mechanics/shadowing';
import { checkBreakTackle } from '../mechanics/break-tackle';
import { checkFoulAppearance } from '../mechanics/negative-traits';

/**
 * Gere un blitz : mouvement vers `move.to` puis blocage de `move.targetId`.
 */
export function handleBlitz(
  state: GameState,
  move: { type: 'BLITZ'; playerId: string; to: Position; targetId: string },
  rng: RNG
): GameState {
  const attacker = state.players.find(p => p.id === move.playerId);
  const target = state.players.find(p => p.id === move.targetId);

  if (!attacker || !target) return state;

  // Verifier que le blitz est legal
  if (!canBlitz(state, move.playerId, move.to, move.targetId)) return state;

  // ─── Foul Appearance check ─────────────────────────────────────────────
  // Rolled by the attacker before the blitz begins. On 1, the declared
  // action is wasted (no turnover) and the attacker's activation ends.
  const foulAppearanceCheck = checkFoulAppearance(state, attacker, target, rng, true);
  if (!foulAppearanceCheck.shouldContinueBlock) {
    return foulAppearanceCheck.newState;
  }

  // Gerer le changement de joueur
  let newState = handlePlayerSwitch(foulAppearanceCheck.newState, move.playerId);

  // 1. Effectuer le mouvement
  const from = attacker.pos;
  const to = move.to;

  // Verifier si un jet d'esquive est necessaire pour le mouvement
  const needsDodge = requiresDodgeRoll(newState, from, to, attacker.team);

  if (needsDodge) {
    // Calculer les modificateurs de desquive (adversaires a l'arrivee + skills)
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

    // Le joueur se deplace toujours, que le jet d'esquive reussisse ou echoue
    const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
    newState.players[attackerIdx].pos = { ...to };

    // Calculer le cout en PM : distance seulement (le blocage coutera 1 PM supplementaire)
    const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - distance);

    // Shadowing : tentative de suivi apres le mouvement (BB3).
    newState = resolveShadowingAfterDodge(newState, attacker, from, rng);

    // Break Tackle (BB3): +1/+2 une fois par activation sur un Dodge rate
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
      // Jet d'esquive echoue : le joueur chute et doit faire un jet d'armure
      newState.isTurnover = true;

      // Verifier si le joueur avait le ballon AVANT de le mettre a terre
      const hadBall = newState.players[attackerIdx].hasBall;

      // Le joueur chute (est mis a terre)
      newState.players[attackerIdx].stunned = true;

      // Effectuer le jet d'armure
      const armorResult = performArmorRollWithNotification(newState.players[attackerIdx], rng);
      newState.lastDiceResult = armorResult;

      // Log du jet d'armure
      const armorLogEntry = createLogEntry(
        'dice',
        `Jet d'armure (Blitz echoue): ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
        newState.players[attackerIdx].id,
        newState.players[attackerIdx].team,
        {
          diceRoll: armorResult.diceRoll,
          targetNumber: armorResult.targetNumber,
          success: armorResult.success,
        }
      );
      newState.gameLog = [...newState.gameLog, armorLogEntry];

      // Si l'armure est percee (success = false), faire un jet de blessure
      if (!armorResult.success) {
        newState = performInjuryRoll(newState, newState.players[attackerIdx], rng);
      }

      // Si le joueur avait le ballon, il le perd et le ballon rebondit
      // (meme si l'armure n'est pas percee, le joueur chute et perd le ballon)
      if (hadBall) {
        newState.players[attackerIdx].hasBall = false;
        newState.ball = { ...newState.players[attackerIdx].pos };

        // Log de la perte de ballon
        const ballLossLogEntry = createLogEntry(
          'action',
          `Ballon perdu apres echec de blitz`,
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
    // Pas de jet d'esquive necessaire, deplacer directement
    const attackerIdx = newState.players.findIndex(p => p.id === attacker.id);
    newState.players[attackerIdx].pos = { ...to };

    // Calculer le cout en PM : distance seulement (le blocage coutera 1 PM supplementaire)
    const distance = Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
    newState.players[attackerIdx].pm = Math.max(0, newState.players[attackerIdx].pm - distance);

    // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
    const mover = newState.players[attackerIdx];
    if (mover.hasBall && isInOpponentEndzone(newState, mover)) {
      return awardTouchdown(newState, mover.team, mover);
    }
  }

  // 2. Effectuer le blocage apres le mouvement
  const updatedAttacker = newState.players.find(p => p.id === attacker.id);
  const updatedTarget = newState.players.find(p => p.id === target.id);

  if (!updatedAttacker || !updatedTarget) return newState;

  // Verifier que le blocage est toujours possible apres le mouvement
  if (!canBlock(newState, updatedAttacker.id, updatedTarget.id)) {
    // Si le blocage n'est plus possible, enregistrer l'action et terminer
    newState = setPlayerAction(newState, attacker.id, 'BLITZ');
    newState = checkPlayerTurnEnd(newState, attacker.id);
    return newState;
  }

  // Calculer les assists
  const offensiveAssists = calculateOffensiveAssists(newState, updatedAttacker, updatedTarget);
  const defensiveAssists = calculateDefensiveAssists(newState, updatedAttacker, updatedTarget);

  // Nombre de des et qui choisit
  const attackerStrength = updatedAttacker.st + offensiveAssists;
  const targetStrength = updatedTarget.st + defensiveAssists;
  const diceCount = calculateBlockDiceCount(attackerStrength, targetStrength);
  const chooser = getBlockDiceChooser(attackerStrength, targetStrength);

  // Tirer les des et enregistrer un choix en attente
  const options = rollBlockDiceManyWithRolls(rng, diceCount);

  // Log de l'action de blitz
  const blitzLogEntry = createLogEntry(
    'action',
    `Blitz: mouvement vers (${to.x}, ${to.y}) puis blocage de ${updatedTarget.name}`,
    attacker.id,
    attacker.team
  );
  newState.gameLog = [...newState.gameLog, blitzLogEntry];

  // Enregistrer l'action de blitz AVANT de creer le pendingBlock
  newState = setPlayerAction(newState, attacker.id, 'BLITZ');

  // Incrementer le compteur de blitz de l'equipe
  newState = incrementTeamBlitzCount(newState, attacker.team);

  // Verifier si le joueur porte la balle et est dans l'en-but adverse apres le mouvement
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
