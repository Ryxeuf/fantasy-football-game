/**
 * S27.8.6 — Sous-handlers de mouvement extraits de `actions.ts`.
 *
 * Deux fonctions appelees par `handleMove` (qui reste dans `actions.ts`
 * car couplee a `getLegalMoves`) selon que le deplacement requiert un
 * jet d'esquive ou non.
 *
 *  - `handleNormalMove` : deplacement standard. Decremente PM, ou
 *    declenche un GFI (Going For It) si PM = 0. Gere la relance Sure
 *    Feet, l'echec/turnover, le touchdown, et le ramassage de balle.
 *  - `handleDodgeRoll` : esquive complete. Modifiers (zones de tacle
 *    + skills), relance Dodge / Break Tackle, GFI surajoutee si PM=0,
 *    Shadowing apres l'esquive, touchdown, ramassage.
 *
 * Aucune dependance interne au dispatcher : les helpers utilises sont
 * tous dans `core/game-state` (canUseTeamReroll, hasPlayerActed, ...),
 * `mechanics/*`, `skills/*`, `utils/*`, et les modules deja extraits
 * (`failure-helpers`, `ball-pickup`).
 */

import type { GameState, Player, Position, RNG } from '../core/types';
import {
  hasPlayerActed,
  setPlayerAction,
  checkPlayerTurnEnd,
  canUseTeamReroll,
} from '../core/game-state';
import {
  samePos,
  calculateDodgeModifiers,
} from '../mechanics/movement';
import { performDodgeRollWithNotification } from '../utils/dice-notifications';
import { createLogEntry } from '../utils/logging';
import {
  getDodgeSkillModifiers,
  canSkillReroll,
} from '../skills/skill-bridge';
import { resolveShadowingAfterDodge } from '../mechanics/shadowing';
import { checkBreakTackle } from '../mechanics/break-tackle';
import { isInOpponentEndzone, awardTouchdown } from '../mechanics/ball';
import { getArmBarBonus } from '../mechanics/arm-bar';
import { applyRollFailure } from './failure-helpers';
import { handleBallPickup } from './ball-pickup';
import { getWeatherModifiers } from '../mechanics/weather-effects';

/**
 * BB rule : GFI target = 2+ par défaut, 3+ en Blizzard / Neige forte.
 * Avant ce fix, le code hardcodait `>= 2` sans consulter
 * `state.weatherCondition`, donc les modificateurs météo (`gfiModifier`
 * de `getWeatherModifiers`) n'étaient jamais appliqués au seuil GFI.
 *
 * Le modifier météo est négatif (-1 en Blizzard) → seuil = 2 - (-1) = 3.
 */
function gfiTargetFromWeather(state: GameState): number {
  const mods = getWeatherModifiers(state.weatherCondition);
  return 2 - mods.gfiModifier;
}

/**
 * Gere un jet d'esquive complet : modifiers, relance Dodge / Break
 * Tackle, GFI surajoute si PM=0, Shadowing post-esquive, touchdown,
 * ramassage.
 */
export function handleDodgeRoll(
  state: GameState,
  player: Player,
  from: Position,
  to: Position,
  rng: RNG,
  idx: number,
): GameState {
  // Calculer les modificateurs d'esquive (malus pour adversaires a
  // l'arrivee + skills)
  const baseDodgeModifiers = calculateDodgeModifiers(state, from, to, player.team);
  const skillDodgeModifiers = getDodgeSkillModifiers(state, player, from);
  const dodgeModifiers = baseDodgeModifiers + skillDodgeModifiers;

  // Effectuer le jet d'esquive avec les modificateurs
  const dodgeResult = performDodgeRollWithNotification(
    player,
    rng,
    dodgeModifiers,
  );

  let next = structuredClone(state) as GameState;
  next.lastDiceResult = dodgeResult;

  // Log du jet d'esquive
  const logEntry = createLogEntry(
    'dice',
    `Jet d'esquive: ${dodgeResult.diceRoll}/${dodgeResult.targetNumber} ${
      dodgeResult.success ? '✓' : '✗'
    }`,
    player.id,
    player.team,
    {
      diceRoll: dodgeResult.diceRoll,
      targetNumber: dodgeResult.targetNumber,
      success: dodgeResult.success,
      modifiers: dodgeModifiers,
    },
  );
  next.gameLog = [...next.gameLog, logEntry];

  // Le joueur se deplace toujours, que le jet d'esquive reussisse ou
  // echoue
  const isDodgeGFI = next.players[idx].pm <= 0;
  next.players[idx].pos = { ...to };
  if (isDodgeGFI) {
    next.players[idx].gfiUsed = (next.players[idx].gfiUsed ?? 0) + 1;
  } else {
    next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);
  }

  // Enregistrer l'action de mouvement seulement si c'est le premier
  // mouvement
  if (!hasPlayerActed(next, player.id)) {
    next = setPlayerAction(next, player.id, 'MOVE');
  }

  // Verifier si le tour du joueur doit se terminer
  next = checkPlayerTurnEnd(next, player.id);

  // Shadowing : les adversaires avec Shadowing adjacents a la case
  // quittee tentent de suivre le dodger. Resolu une seule fois par
  // esquive, apres que le joueur ait bouge et independamment du
  // resultat final (BB3).
  next = resolveShadowingAfterDodge(next, player, from, rng);

  // Break Tackle (BB3): une fois par activation, apres un Dodge rate,
  // ajoute +1 (ST <= 4) ou +2 (ST >= 5) au jet. Applique avant toute
  // relance.
  let finalDodgeSuccess = dodgeResult.success;
  if (!finalDodgeSuccess) {
    const breakTackleCheck = checkBreakTackle(
      next,
      next.players[idx],
      dodgeResult.diceRoll,
      dodgeResult.targetNumber,
      dodgeResult.success,
    );
    if (breakTackleCheck.triggered) {
      next = breakTackleCheck.newState;
      finalDodgeSuccess = true;
    }
  }
  if (!finalDodgeSuccess && canSkillReroll(player, 'on-dodge', state)) {
    const rerollLog = createLogEntry(
      'dice',
      `Dodge : relance de l'esquive (${dodgeResult.diceRoll} raté)`,
      player.id,
      player.team,
    );
    next.gameLog = [...next.gameLog, rerollLog];
    const rerollResult = performDodgeRollWithNotification(
      player,
      rng,
      dodgeModifiers,
    );
    next.lastDiceResult = rerollResult;
    const rerollLogEntry = createLogEntry(
      'dice',
      `Relance esquive: ${rerollResult.diceRoll}/${rerollResult.targetNumber} ${
        rerollResult.success ? '✓' : '✗'
      }`,
      player.id,
      player.team,
      {
        diceRoll: rerollResult.diceRoll,
        targetNumber: rerollResult.targetNumber,
        success: rerollResult.success,
      },
    );
    next.gameLog = [...next.gameLog, rerollLogEntry];
    finalDodgeSuccess = rerollResult.success;
  }

  if (finalDodgeSuccess) {
    // Si c'est aussi un GFI, jet supplementaire de GFI (2+ sur D6, 3+ en
    // Blizzard / Neige forte via `gfiTargetFromWeather`).
    if (isDodgeGFI) {
      const gfiTarget = gfiTargetFromWeather(state);
      let gfiRoll = Math.floor(rng() * 6) + 1;
      let gfiSuccess = gfiRoll >= gfiTarget;

      // Sure Feet auto-reroll (via skill registry)
      if (!gfiSuccess && canSkillReroll(player, 'on-gfi', state)) {
        const sfLog = createLogEntry(
          'dice',
          `Sure Feet : relance du GFI (${gfiRoll} raté)`,
          player.id,
          player.team,
        );
        next.gameLog = [...next.gameLog, sfLog];
        gfiRoll = Math.floor(rng() * 6) + 1;
        gfiSuccess = gfiRoll >= gfiTarget;
      }

      const gfiLogEntry = createLogEntry(
        'dice',
        `GFI (Going For It) après esquive: ${gfiRoll}/${gfiTarget} ${
          gfiSuccess ? '✓' : '✗'
        }`,
        player.id,
        player.team,
        { diceRoll: gfiRoll, targetNumber: gfiTarget, success: gfiSuccess },
      );
      next.gameLog = [...next.gameLog, gfiLogEntry];
      next.lastDiceResult = {
        type: 'dodge' as never,
        playerId: player.id,
        diceRoll: gfiRoll,
        targetNumber: gfiTarget,
        success: gfiSuccess,
        modifiers: 0,
        playerName: player.name,
      };

      if (!gfiSuccess) {
        // Offrir relance d'equipe si disponible
        if (canUseTeamReroll(next, player.team)) {
          next.pendingReroll = {
            rollType: 'gfi',
            playerId: player.id,
            team: player.team,
            targetNumber: gfiTarget,
            modifiers: 0,
            playerIndex: idx,
            to,
          };
          return next;
        }
        return applyRollFailure(next, idx, rng);
      }
    }

    // Si le joueur porte la balle et atteint l'en-but adverse ->
    // touchdown
    const mover = next.players[idx];
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }

    // Ramassage de balle si on atterrit sur le ballon
    if (next.ball && samePos(next.ball, to)) {
      return handleBallPickup(next, player, rng, idx);
    }

    return next;
  }

  // Echec d'esquive : offrir relance d'equipe si disponible
  if (canUseTeamReroll(next, player.team)) {
    next.pendingReroll = {
      rollType: 'dodge',
      playerId: player.id,
      team: player.team,
      targetNumber: dodgeResult.targetNumber,
      modifiers: dodgeModifiers,
      playerIndex: idx,
      from,
    };
    return next;
  }

  // Pas de relance : appliquer l'echec (chute + turnover)
  // Arm Bar (Bras Casseur) : +1 au jet d'armure du dodger si un
  // adversaire avec Arm Bar etait en zone de tacle au depart.
  return applyRollFailure(next, idx, rng, getArmBarBonus(next, player, from));
}

/**
 * Gere un mouvement standard (sans esquive). Si le joueur a 0 PM,
 * declenche un GFI 2+. Apres mouvement, verifie touchdown / pickup.
 */
export function handleNormalMove(
  state: GameState,
  player: Player,
  from: Position,
  to: Position,
  rng: RNG,
  idx: number,
): GameState {
  let next = structuredClone(state) as GameState;
  const isGFI = next.players[idx].pm <= 0;

  // Deplacer le joueur
  next.players[idx].pos = { ...to };

  if (isGFI) {
    // GFI : ne decremente pas pm, incremente gfiUsed
    next.players[idx].gfiUsed = (next.players[idx].gfiUsed ?? 0) + 1;

    // Jet de GFI : 2+ par défaut, 3+ en Blizzard / Neige forte.
    const gfiTarget = gfiTargetFromWeather(state);
    let gfiRoll = Math.floor(rng() * 6) + 1;
    let gfiSuccess = gfiRoll >= gfiTarget;

    // Sure Feet : relance automatique du GFI rate (via skill registry)
    if (!gfiSuccess && canSkillReroll(player, 'on-gfi', state)) {
      const rerollLog = createLogEntry(
        'dice',
        `Sure Feet : relance du GFI (${gfiRoll} raté)`,
        player.id,
        player.team,
      );
      next.gameLog = [...next.gameLog, rerollLog];
      gfiRoll = Math.floor(rng() * 6) + 1;
      gfiSuccess = gfiRoll >= gfiTarget;
    }

    const gfiLogEntry = createLogEntry(
      'dice',
      `GFI (Going For It): ${gfiRoll}/${gfiTarget} ${gfiSuccess ? '✓' : '✗'}`,
      player.id,
      player.team,
      { diceRoll: gfiRoll, targetNumber: gfiTarget, success: gfiSuccess },
    );
    next.gameLog = [...next.gameLog, gfiLogEntry];
    next.lastDiceResult = {
      type: 'dodge' as never,
      playerId: player.id,
      diceRoll: gfiRoll,
      targetNumber: gfiTarget,
      success: gfiSuccess,
      modifiers: 0,
      playerName: player.name,
    };

    // Enregistrer l'action
    if (!hasPlayerActed(next, player.id)) {
      next = setPlayerAction(next, player.id, 'MOVE');
    }

    if (!gfiSuccess) {
      // GFI echoue : offrir relance d'equipe si disponible
      if (canUseTeamReroll(next, player.team)) {
        next.pendingReroll = {
          rollType: 'gfi',
          playerId: player.id,
          team: player.team,
          targetNumber: gfiTarget,
          modifiers: 0,
          playerIndex: idx,
          to,
        };
        return next;
      }
      // Pas de relance : appliquer l'echec
      return applyRollFailure(next, idx, rng);
    }

    // GFI reussi : continuer normalement
    next = checkPlayerTurnEnd(next, player.id);

    // Touchdown check
    const mover = next.players[idx];
    if (mover.hasBall && isInOpponentEndzone(next, mover)) {
      return awardTouchdown(next, mover.team, mover);
    }

    // Ramassage de balle
    if (next.ball && samePos(next.ball, to)) {
      return handleBallPickup(next, player, rng, idx);
    }

    return next;
  }

  // Mouvement normal (a des PM)
  next.players[idx].pm = Math.max(0, next.players[idx].pm - 1);

  // Enregistrer l'action de mouvement seulement si c'est le premier
  // mouvement
  if (!hasPlayerActed(next, player.id)) {
    next = setPlayerAction(next, player.id, 'MOVE');
  }

  // Verifier si le tour du joueur doit se terminer
  next = checkPlayerTurnEnd(next, player.id);

  // Log du mouvement
  const moveLogEntry = createLogEntry(
    'action',
    `Mouvement vers (${to.x}, ${to.y})`,
    player.id,
    player.team,
  );
  next.gameLog = [...next.gameLog, moveLogEntry];
  // Reinitialiser le resultat de des apres un mouvement normal
  next.lastDiceResult = undefined;

  // Si le joueur porte la balle et atteint l'en-but adverse ->
  // touchdown
  const mover = next.players[idx];
  if (mover.hasBall && isInOpponentEndzone(next, mover)) {
    return awardTouchdown(next, mover.team, mover);
  }

  // Ramassage de balle avec jet d'agilite
  if (next.ball && samePos(next.ball, to)) {
    return handleBallPickup(next, player, rng, idx);
  }

  return next;
}
