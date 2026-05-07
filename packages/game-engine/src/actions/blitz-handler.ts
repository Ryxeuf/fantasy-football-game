/**
 * S27.8.8 — `handleBlitz` extrait depuis `actions/actions.ts`.
 *
 * Le handler BLITZ enchaine un mouvement (avec esquive eventuelle) puis
 * un blocage cible. C'est l'un des handlers les plus longs (~225 lignes)
 * mais il n'a aucun cycle d'import vers `actions.ts` : toutes ses
 * dependances sont externes (mecaniques + helpers core/skills).
 *
 * Aucun changement de comportement — extraction structurelle pure pour
 * reduire la taille du dispatcher monolithique. Cible S27.8 :
 * `actions.ts` <= 600 lignes.
 */
import type { GameState, Position, RNG } from '../core/types';
import {
  canBlock,
  canBlitz,
  calculateOffensiveAssists,
  calculateDefensiveAssists,
  calculateBlockDiceCount,
  getBlockDiceChooser,
} from '../mechanics/blocking';
import {
  handlePlayerSwitch,
  setPlayerAction,
  checkPlayerTurnEnd,
  incrementTeamBlitzCount,
} from '../core/game-state';
import {
  requiresDodgeRoll,
  calculateDodgeModifiers,
} from '../mechanics/movement';
import { getDodgeSkillModifiers } from '../skills/skill-bridge';
import {
  performDodgeRollWithNotification,
  performArmorRollWithNotification,
  rollBlockDiceManyWithNotification,
} from '../utils/dice-notifications';
import { rollBlockDiceManyWithRolls } from '../utils/dice';
import { performInjuryRoll } from '../mechanics/injury';
import { createLogEntry } from '../utils/logging';
import {
  isInOpponentEndzone,
  awardTouchdown,
  bounceBall,
} from '../mechanics/ball';
import { resolveShadowingAfterDodge } from '../mechanics/shadowing';
import { checkBreakTackle } from '../mechanics/break-tackle';
import { checkFoulAppearance } from '../mechanics/negative-traits';

// Suppress unused-import warning (placeholder pour symetrie avec
// dice-notifications dans `actions.ts`). `rollBlockDiceManyWithNotification`
// reste dispo si on veut migrer vers la version notifiee dans une iter
// future ; aujourd'hui handleBlitz utilise `rollBlockDiceManyWithRolls`
// (dice brutes) pour rester strictement isofonctionnel a l'extraction.
void rollBlockDiceManyWithNotification;

export function handleBlitz(
  state: GameState,
  move: { type: 'BLITZ'; playerId: string; to: Position; targetId: string },
  rng: RNG,
): GameState {
  const attacker = state.players.find((p) => p.id === move.playerId);
  const target = state.players.find((p) => p.id === move.targetId);

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
      },
    );
    newState.gameLog = [...newState.gameLog, dodgeLogEntry];

    // Le joueur se déplace toujours, que le jet d'esquive réussisse ou échoue
    const attackerIdx = newState.players.findIndex((p) => p.id === attacker.id);
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
        dodgeResult.success,
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
        },
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
          attacker.team,
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
    const attackerIdx = newState.players.findIndex((p) => p.id === attacker.id);
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
  const updatedAttacker = newState.players.find((p) => p.id === attacker.id);
  const updatedTarget = newState.players.find((p) => p.id === target.id);

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
    attacker.team,
  );
  newState.gameLog = [...newState.gameLog, blitzLogEntry];

  // Enregistrer l'action de blitz AVANT de créer le pendingBlock
  newState = setPlayerAction(newState, attacker.id, 'BLITZ');

  // Incrémenter le compteur de blitz de l'équipe
  newState = incrementTeamBlitzCount(newState, attacker.team);

  // Vérifier si le joueur porte la balle et est dans l'en-but adverse après le mouvement
  const mover = newState.players.find((p) => p.id === attacker.id);
  if (mover && mover.hasBall && isInOpponentEndzone(newState, mover)) {
    return awardTouchdown(newState, mover.team, mover);
  }

  return {
    ...newState,
    pendingBlock: {
      attackerId: updatedAttacker.id,
      targetId: updatedTarget.id,
      options: options.map((o) => o.result),
      chooser,
      offensiveAssists,
      defensiveAssists,
      totalStrength: attackerStrength,
      targetStrength,
    },
  };
}
