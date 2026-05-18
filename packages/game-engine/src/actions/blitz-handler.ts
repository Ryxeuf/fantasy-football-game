/**
 * S27.8.13 — Module dedie au handler `handleBlitz` (~226 lignes), le
 * plus gros des handlers restants dans `actions.ts`. Sortie de ce
 * dispatcher pour atteindre la cible DoD `actions.ts <= 600 lignes`.
 *
 * Le flux complet est preserve :
 * 1. Foul Appearance check sur l'attaquant (sur 1 = activation gachee).
 * 2. Mouvement vers la case cible avec dodge eventuel (Shadowing,
 *    Break Tackle, jet d'armure + injury sur echec, gestion balle).
 * 3. Blocage post-mouvement (assists offensifs/defensifs, calcul dice,
 *    setPlayerAction `BLITZ`, incrementTeamBlitzCount, pendingBlock).
 *
 * Aucune dependance vers `actions.ts` : tous les helpers proviennent
 * de `mechanics/*`, `core/*`, `utils/*`, `skills/*`. Aucun cycle.
 */

import { GameState, Position, RNG } from '../core/types';
import { getDodgeSkillModifiers } from '../skills/skill-bridge';
import {
  requiresDodgeRoll,
  calculateDodgeModifiers,
} from '../mechanics/movement';
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
import {
  setPlayerAction,
  checkPlayerTurnEnd,
  handlePlayerSwitch,
  incrementTeamBlitzCount,
} from '../core/game-state';
import { checkBreakTackle } from '../mechanics/break-tackle';
import { resolveShadowingAfterDodge } from '../mechanics/shadowing';
import { checkFoulAppearance } from '../mechanics/negative-traits';

/**
 * Gere une action de Blitz : mouvement vers la cible puis blocage.
 *
 * Le coup est gate par `canBlitz` puis par un Foul Appearance check
 * defensif. Le mouvement peut declencher un jet d'esquive (avec
 * Shadowing et Break Tackle BB3). Sur echec, le joueur chute, fait un
 * jet d'armure + blessure et perd la balle s'il la portait. Sur
 * succes, le blocage post-mouvement est mis en attente via
 * `pendingBlock` (resolution differee par `handleBlockChoose`).
 */
export function handleBlitz(
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

    // BB rule : le coût en PM d'un déplacement est la distance Chebyshev
    // (king-move) — 1 PM par case adjacente, diagonales incluses. Avant ce
    // fix, on utilisait la distance Manhattan (|dx| + |dy|) qui comptait
    // un déplacement diagonal comme 2 PM au lieu d'1. `getLegalMoves` énumère
    // pourtant les 8 directions comme BLITZ steps single-PM.
    const distance = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
    // BUG fix : `handlePlayerSwitch` retourne `{...state, selectedPlayerId}`
    // donc `newState.players` est la MÊME référence que `state.players`.
    // Toute mutation via `newState.players[i].x = ...` casse l'invariant
    // d'immutabilite et corrompt le state du caller (les autres joueurs
    // gardent un alias vers le snapshot d'avant). On remplace par un
    // `map` qui produit une nouvelle copie du joueur deplacé.
    newState = {
      ...newState,
      players: newState.players.map((p) =>
        p.id === attacker.id
          ? { ...p, pos: { ...to }, pm: Math.max(0, p.pm - distance) }
          : p,
      ),
    };

    // Shadowing : tentative de suivi après le mouvement (BB3).
    newState = resolveShadowingAfterDodge(newState, attacker, from, rng);

    // Re-resolve l'attaquant apres shadowing (pos peut avoir change).
    const attackerAfterMove = newState.players.find((p) => p.id === attacker.id);
    if (!attackerAfterMove) return newState;

    // Break Tackle (BB3): +1/+2 une fois par activation sur un Dodge raté
    // pendant un Blitz.
    let blitzDodgeSuccess = dodgeResult.success;
    if (!blitzDodgeSuccess) {
      const breakTackleCheck = checkBreakTackle(
        newState,
        attackerAfterMove,
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
      const mover = newState.players.find((p) => p.id === attacker.id);
      if (mover && mover.hasBall && isInOpponentEndzone(newState, mover)) {
        return awardTouchdown(newState, mover.team, mover);
      }
    } else {
      // Jet d'esquive échoué : le joueur chute et doit faire un jet d'armure
      // Vérifier si le joueur avait le ballon AVANT de le mettre à terre
      const beforeFall = newState.players.find((p) => p.id === attacker.id);
      if (!beforeFall) return newState;
      const hadBall = beforeFall.hasBall;

      // Le joueur chute (est mis à terre) — immutable update.
      newState = {
        ...newState,
        isTurnover: true,
        players: newState.players.map((p) =>
          p.id === attacker.id ? { ...p, stunned: true } : p,
        ),
      };

      const downed = newState.players.find((p) => p.id === attacker.id);
      if (!downed) return newState;

      // Effectuer le jet d'armure
      const armorResult = performArmorRollWithNotification(downed, rng);
      newState = { ...newState, lastDiceResult: armorResult };

      // Log du jet d'armure
      const armorLogEntry = createLogEntry(
        'dice',
        `Jet d'armure (Blitz échoué): ${armorResult.diceRoll}/${armorResult.targetNumber} ${armorResult.success ? '✓' : '✗'}`,
        downed.id,
        downed.team,
        {
          diceRoll: armorResult.diceRoll,
          targetNumber: armorResult.targetNumber,
          success: armorResult.success,
        }
      );
      newState = { ...newState, gameLog: [...newState.gameLog, armorLogEntry] };

      // Si l'armure est percée (success = false), faire un jet de blessure
      if (!armorResult.success) {
        newState = performInjuryRoll(newState, downed, rng);
      }

      // Si le joueur avait le ballon, il le perd et le ballon rebondit
      // (même si l'armure n'est pas percée, le joueur chute et perd le ballon)
      if (hadBall) {
        const ballPos = { ...downed.pos };
        newState = {
          ...newState,
          ball: ballPos,
          players: newState.players.map((p) =>
            p.id === attacker.id ? { ...p, hasBall: false } : p,
          ),
        };

        // Log de la perte de ballon
        const ballLossLogEntry = createLogEntry(
          'action',
          `Ballon perdu après échec de blitz`,
          attacker.id,
          attacker.team
        );
        newState = { ...newState, gameLog: [...newState.gameLog, ballLossLogEntry] };

        // Faire rebondir le ballon depuis la position du joueur
        return bounceBall(newState, rng);
      }

      // Enregistrer l'action de blitz et terminer le tour
      newState = setPlayerAction(newState, attacker.id, 'BLITZ');
      newState = checkPlayerTurnEnd(newState, attacker.id);
      return newState;
    }
  } else {
    // Pas de jet d'esquive nécessaire, déplacer directement (immutable).
    // BB rule : distance Chebyshev (king-move) — 1 PM par case adjacente.
    const distance = Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
    newState = {
      ...newState,
      players: newState.players.map((p) =>
        p.id === attacker.id
          ? { ...p, pos: { ...to }, pm: Math.max(0, p.pm - distance) }
          : p,
      ),
    };

    // Si le joueur porte la balle et atteint l'en-but adverse -> touchdown
    const mover = newState.players.find((p) => p.id === attacker.id);
    if (mover && mover.hasBall && isInOpponentEndzone(newState, mover)) {
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
