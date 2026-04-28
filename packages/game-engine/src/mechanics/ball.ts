/**
 * Gestion de la balle pour Blood Bowl
 * Gère le rebond, le ramassage, les touchdowns et les jets de réception
 */

import { GameState, Player, Position, TeamId, RNG } from '../core/types';
import { samePos, calculatePickupModifiers } from './movement';
import { performPickupRoll } from '../utils/dice';
import { createLogEntry, addLogEntry } from '../utils/logging';
import { hasSkill } from '../skills/skill-effects';

/**
 * Vérifie si un joueur est dans l'en-but adverse
 * @param state - État du jeu
 * @param player - Joueur à vérifier
 * @returns True si le joueur est dans l'en-but adverse
 */
export function isInOpponentEndzone(state: GameState, player: Player): boolean {
  // Orientation du terrain (26x15) :
  // L'équipe A marque dans la ligne d'en-but de droite (x = state.width - 1)
  // L'équipe B marque dans la ligne d'en-but de gauche (x = 0)
  const endzoneX = player.team === 'A' ? state.width - 1 : 0;
  return player.pos.x === endzoneX;
}

/**
 * Attribue un touchdown à une équipe
 * @param state - État du jeu
 * @param scoringTeam - Équipe qui marque
 * @param scorer - Joueur qui marque (optionnel)
 * @returns Nouvel état du jeu avec le touchdown
 */
export function awardTouchdown(state: GameState, scoringTeam: TeamId, scorer?: Player): GameState {
  let next = structuredClone(state) as GameState;

  // Mettre à jour le score
  const newScore = {
    teamA: scoringTeam === 'A' ? next.score.teamA + 1 : next.score.teamA,
    teamB: scoringTeam === 'B' ? next.score.teamB + 1 : next.score.teamB,
  };

  // Tracker le TD dans les stats du match
  if (scorer) {
    if (!next.matchStats[scorer.id]) {
      next.matchStats[scorer.id] = { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: false };
    }
    next.matchStats[scorer.id].touchdowns += 1;
  }

  // Nettoyer la balle et arrêter le drive (Turnover satisfaisant)
  next.ball = undefined;
  next.players = next.players.map(p => ({ ...p, hasBall: false }));
  next.isTurnover = true;

  // Log du score
  const teamName = scoringTeam === 'A' ? next.teamNames.teamA : next.teamNames.teamB;
  const message = `Touchdown pour ${teamName} !`;
  const logEntry = createLogEntry('score', message, scorer?.id, scoringTeam, {
    scorer: scorer?.name,
    score: newScore,
  });

  next = addLogEntry(next, logEntry);

  return {
    ...next,
    score: newScore,
    gamePhase: 'post-td' as const,
  };
}

/**
 * Vérifie les touchdowns en cours
 * @param state - État du jeu
 * @returns Nouvel état du jeu après vérification des touchdowns
 */
export function checkTouchdowns(state: GameState): GameState {
  // Vérifier tous les joueurs qui ont le ballon et sont debout
  const playersWithBall = state.players.filter(p => p.hasBall && !p.stunned);

  for (const player of playersWithBall) {
    if (isInOpponentEndzone(state, player)) {
      return awardTouchdown(state, player.team, player);
    }
  }

  return state;
}

/**
 * Calcule une direction aléatoire pour le rebond de balle
 * @param rng - Générateur de nombres aléatoires
 * @returns Direction aléatoire
 */
export function getRandomDirection(rng: RNG): Position {
  // 1D8 sur le Gabarit de Direction Aléatoire
  // 1: Nord, 2: Nord-Est, 3: Est, 4: Sud-Est, 5: Sud, 6: Sud-Ouest, 7: Ouest, 8: Nord-Ouest
  const direction = Math.min(8, Math.floor(rng() * 8) + 1);

  switch (direction) {
    case 1:
      return { x: 0, y: -1 }; // Nord
    case 2:
      return { x: 1, y: -1 }; // Nord-Est
    case 3:
      return { x: 1, y: 0 }; // Est
    case 4:
      return { x: 1, y: 1 }; // Sud-Est
    case 5:
      return { x: 0, y: 1 }; // Sud
    case 6:
      return { x: -1, y: 1 }; // Sud-Ouest
    case 7:
      return { x: -1, y: 0 }; // Ouest
    case 8:
      return { x: -1, y: -1 }; // Nord-Ouest
    default:
      return { x: 0, y: 0 }; // Ne devrait jamais arriver
  }
}

/**
 * Fait rebondir la balle
 * @param state - État du jeu
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état du jeu après rebond
 */
export function bounceBall(state: GameState, rng: RNG): GameState {
  if (!state.ball) return state;

  const newState = structuredClone(state) as GameState;
  const currentBallPos = { ...state.ball };

  // Calculer la nouvelle position après rebond
  const direction = getRandomDirection(rng);
  const newBallPos: Position = {
    x: Math.max(0, Math.min(state.width - 1, currentBallPos.x + direction.x)),
    y: Math.max(0, Math.min(state.height - 1, currentBallPos.y + direction.y)),
  };

  // Log du rebond
  const bounceLogEntry = createLogEntry(
    'action',
    `Ballon rebondit vers (${newBallPos.x}, ${newBallPos.y})`,
    undefined,
    undefined
  );
  newState.gameLog = [...newState.gameLog, bounceLogEntry];

  // Vérifier si la balle atterrit sur un joueur debout avec sa Zone de Tackle
  const playerAtNewPos = newState.players.find(
    p => samePos(p.pos, newBallPos) && !p.stunned && p.pm > 0 // Zone de Tackle = joueur non étourdi avec des PM
  );

  if (playerAtNewPos) {
    // No Hands: ball bounces off this player (no catch roll)
    if (hasSkill(playerAtNewPos, 'no-hands')) {
      const noHandsLog = createLogEntry(
        'info',
        `Sans Ballon: ${playerAtNewPos.name} ne peut pas réceptionner le ballon !`,
        playerAtNewPos.id,
        playerAtNewPos.team,
        { skill: 'no-hands' }
      );
      newState.gameLog = [...newState.gameLog, noHandsLog];
      newState.ball = newBallPos;
      return bounceBall(newState, rng);
    }

    // Le joueur doit tenter de réceptionner la balle
    const catchModifiers = calculatePickupModifiers(newState, newBallPos, playerAtNewPos.team);
    const catchResult = performPickupRoll(playerAtNewPos, rng, catchModifiers);

    newState.lastDiceResult = {
      type: 'catch',
      playerId: playerAtNewPos.id,
      diceRoll: catchResult.diceRoll,
      targetNumber: catchResult.targetNumber,
      success: catchResult.success,
      modifiers: catchResult.modifiers,
    };

    // Log du jet de réception
    const catchLogEntry = createLogEntry(
      'dice',
      `Jet de réception: ${catchResult.diceRoll}/${catchResult.targetNumber} ${catchResult.success ? '✓' : '✗'}`,
      playerAtNewPos.id,
      playerAtNewPos.team,
      {
        diceRoll: catchResult.diceRoll,
        targetNumber: catchResult.targetNumber,
        success: catchResult.success,
        modifiers: catchModifiers,
      }
    );
    newState.gameLog = [...newState.gameLog, catchLogEntry];

    if (catchResult.success) {
      // Réception réussie : attacher la balle au joueur
      newState.ball = undefined;
      newState.players = newState.players.map(p =>
        p.id === playerAtNewPos.id ? { ...p, hasBall: true } : p
      );

      // Log de la réception réussie
      const successCatchLogEntry = createLogEntry(
        'action',
        `Ballon réceptionné avec succès`,
        playerAtNewPos.id,
        playerAtNewPos.team
      );
      newState.gameLog = [...newState.gameLog, successCatchLogEntry];

      // Si réception dans l'en-but adverse, touchdown immédiat
      const scorer = newState.players.find(p => p.id === playerAtNewPos.id)!;
      if (isInOpponentEndzone(newState, scorer)) {
        return awardTouchdown(newState, scorer.team, scorer);
      }
    } else {
      // Échec de réception : la balle continue à rebondir
      newState.ball = newBallPos;

      // Log de l'échec de réception
      const failCatchLogEntry = createLogEntry(
        'action',
        `Échec de réception - le ballon continue à rebondir`,
        playerAtNewPos.id,
        playerAtNewPos.team
      );
      newState.gameLog = [...newState.gameLog, failCatchLogEntry];

      // Appel récursif pour continuer le rebond
      return bounceBall(newState, rng);
    }
  } else {
    // Case vide ou joueur sans Zone de Tackle : la balle s'arrête là
    newState.ball = newBallPos;

    // Log de l'arrêt du ballon
    const stopLogEntry = createLogEntry(
      'action',
      `Ballon s'arrête à (${newBallPos.x}, ${newBallPos.y})`,
      undefined,
      undefined
    );
    newState.gameLog = [...newState.gameLog, stopLogEntry];
  }

  return checkTouchdowns(newState);
}

/**
 * Résout l'atterrissage du ballon après la déviation du kickoff.
 *
 * Règles BB 2020 appliquées :
 * - Touchback si le ballon atterrit hors du terrain ou dans la moitié de
 *   l'équipe qui frappe : le ballon est attribué automatiquement à un
 *   joueur de l'équipe receveuse (le plus proche du centre du terrain).
 * - Si le ballon atterrit sur un joueur debout (de n'importe quelle
 *   équipe), tentative de réception ; échec → rebond.
 * - Sinon, le ballon reste au sol pour être ramassé manuellement.
 *
 * @param state - État de jeu post-`startMatchFromKickoff` (ball positionné)
 * @param receivingTeam - Équipe qui reçoit (= receivingTeam du préMatch)
 * @param rng - Générateur aléatoire (pour catch rolls et rebonds)
 */
export function resolveKickoffBallLanding(
  state: GameState,
  receivingTeam: TeamId,
  rng: RNG,
): GameState {
  if (!state.ball) return state;

  const ballPos = state.ball;
  const inReceivingHalf = isInReceivingHalf(state, ballPos, receivingTeam);

  if (!inReceivingHalf) {
    return applyTouchback(state, receivingTeam);
  }

  const playerAtBall = state.players.find(
    p => samePos(p.pos, ballPos) && !p.stunned && p.pm > 0,
  );

  if (!playerAtBall) {
    return state;
  }

  if (hasSkill(playerAtBall, 'no-hands')) {
    const noHandsLog = createLogEntry(
      'info',
      `Sans Ballon: ${playerAtBall.name} ne peut pas réceptionner le ballon !`,
      playerAtBall.id,
      playerAtBall.team,
      { skill: 'no-hands' },
    );
    return bounceBall(addLogEntry(state, noHandsLog), rng);
  }

  const catchModifiers = calculatePickupModifiers(state, ballPos, playerAtBall.team);
  const catchResult = performPickupRoll(playerAtBall, rng, catchModifiers);

  const catchLog = createLogEntry(
    'dice',
    `Réception du kickoff: ${catchResult.diceRoll}/${catchResult.targetNumber} ${catchResult.success ? '✓' : '✗'}`,
    playerAtBall.id,
    playerAtBall.team,
    {
      diceRoll: catchResult.diceRoll,
      targetNumber: catchResult.targetNumber,
      success: catchResult.success,
      modifiers: catchModifiers,
    },
  );

  let nextState: GameState = {
    ...state,
    lastDiceResult: {
      type: 'catch',
      playerId: playerAtBall.id,
      diceRoll: catchResult.diceRoll,
      targetNumber: catchResult.targetNumber,
      success: catchResult.success,
      modifiers: catchResult.modifiers,
    },
    gameLog: [...state.gameLog, catchLog],
  };

  if (catchResult.success) {
    nextState = {
      ...nextState,
      ball: undefined,
      players: nextState.players.map(p =>
        p.id === playerAtBall.id ? { ...p, hasBall: true } : p,
      ),
    };
    return nextState;
  }

  return bounceBall(nextState, rng);
}

function isInReceivingHalf(
  state: GameState,
  pos: Position,
  receivingTeam: TeamId,
): boolean {
  if (pos.x <= 0 || pos.x >= state.width - 1) return false;
  if (pos.y < 0 || pos.y >= state.height) return false;
  const midX = Math.floor(state.width / 2);
  return receivingTeam === 'A' ? pos.x < midX : pos.x >= midX;
}

function applyTouchback(state: GameState, receivingTeam: TeamId): GameState {
  const receivers = state.players.filter(
    p => p.team === receivingTeam && !p.stunned && p.pm > 0 && p.pos.x >= 0,
  );

  if (receivers.length === 0) {
    const noReceiverLog = createLogEntry(
      'info',
      `Touchback : aucun joueur valide dans l'équipe receveuse, le ballon reste au sol.`,
      undefined,
      receivingTeam,
    );
    return addLogEntry(state, noReceiverLog);
  }

  const midX = Math.floor(state.width / 2);
  const midY = Math.floor(state.height / 2);
  const chosen = [...receivers].sort((a, b) => {
    const distA = Math.abs(a.pos.x - midX) + Math.abs(a.pos.y - midY);
    const distB = Math.abs(b.pos.x - midX) + Math.abs(b.pos.y - midY);
    return distA - distB;
  })[0];

  const touchbackLog = createLogEntry(
    'action',
    `Touchback : le ballon est donné à ${chosen.name}.`,
    chosen.id,
    receivingTeam,
  );

  return {
    ...state,
    ball: undefined,
    players: state.players.map(p =>
      p.id === chosen.id ? { ...p, hasBall: true } : p,
    ),
    gameLog: [...state.gameLog, touchbackLog],
  };
}

/**
 * Fait tomber la balle d'un joueur
 * @param state - État du jeu
 * @returns Nouvel état du jeu avec la balle au sol
 */
export function dropBall(state: GameState): GameState {
  // Trouver le joueur qui a la balle
  const playerWithBall = state.players.find(p => p.hasBall);
  if (!playerWithBall) return state;

  // Retirer la balle du joueur et la placer sur le terrain
  return {
    ...state,
    players: state.players.map(p => (p.id === playerWithBall.id ? { ...p, hasBall: false } : p)),
    ball: { ...playerWithBall.pos },
  };
}
