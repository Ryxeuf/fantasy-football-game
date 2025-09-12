/**
 * Système de blessures pour Blood Bowl
 * Gère les jets d'armure, de blessure et les zones de dugout
 */

import { GameState, Player, RNG } from '../core/types';
import { performArmorRoll } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { movePlayerToDugoutZone } from './dugout';

/**
 * Effectue un jet de blessure contre un joueur
 * @param state - État du jeu
 * @param player - Joueur blessé
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état du jeu après le jet de blessure
 */
export function performInjuryRoll(
  state: GameState, 
  player: Player, 
  rng: RNG
): GameState {
  const newState = structuredClone(state) as GameState;
  
  // Jet de 2D6 pour la blessure
  const injuryRoll = Math.floor(rng() * 6) + 1 + Math.floor(rng() * 6) + 1;
  
  // Log du jet de blessure
  const injuryLog = createLogEntry(
    'dice',
    `Jet de blessure: ${injuryRoll}`,
    player.id,
    player.team,
    { injuryRoll }
  );
  newState.gameLog = [...newState.gameLog, injuryLog];

  // Déterminer le résultat selon la table de blessure
  if (injuryRoll <= 7) {
    // 2-7: Stunned - reste sur le terrain
    return handleStunned(newState, player);
  } else if (injuryRoll <= 9) {
    // 8-9: KO - va en zone KO
    return handleKnockedOut(newState, player);
  } else {
    // 10+: Casualty - va en zone blessés
    return handleCasualty(newState, player, rng);
  }
}

/**
 * Gère un joueur sonné (2-7)
 */
function handleStunned(state: GameState, player: Player): GameState {
  // Le joueur reste sur le terrain mais devient sonné
  state.players = state.players.map(p => 
    p.id === player.id ? { ...p, stunned: true, state: 'stunned' } : p
  );

  const stunnedLog = createLogEntry(
    'action',
    `${player.name} est sonné`,
    player.id,
    player.team
  );
  state.gameLog = [...state.gameLog, stunnedLog];

  return state;
}

/**
 * Gère un joueur KO (8-9)
 */
function handleKnockedOut(state: GameState, player: Player): GameState {
  // Le joueur va en zone KO
  const newState = movePlayerToDugoutZone(state, player.id, 'knockedOut', player.team);
  
  const koLog = createLogEntry(
    'action',
    `${player.name} est KO et retiré du terrain`,
    player.id,
    player.team
  );
  newState.gameLog = [...newState.gameLog, koLog];

  return newState;
}

/**
 * Gère un joueur blessé (10+)
 */
function handleCasualty(state: GameState, player: Player, rng: RNG): GameState {
  // Le joueur va en zone blessés
  let newState = movePlayerToDugoutZone(state, player.id, 'casualty', player.team);
  
  // Jet de casualty (D16)
  const casualtyRoll = Math.floor(rng() * 16) + 1;
  
  const casualtyLog = createLogEntry(
    'dice',
    `Jet de casualty: ${casualtyRoll}`,
    player.id,
    player.team,
    { casualtyRoll }
  );
  newState.gameLog = [...newState.gameLog, casualtyLog];

  // Déterminer le type de blessure
  if (casualtyRoll <= 6) {
    // Badly Hurt - manque le reste du match
    const badlyHurtLog = createLogEntry(
      'action',
      `${player.name} est gravement blessé - manque le reste du match`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, badlyHurtLog];
  } else if (casualtyRoll <= 9) {
    // Seriously Hurt - MNG (Miss Next Game)
    const seriouslyHurtLog = createLogEntry(
      'action',
      `${player.name} est sérieusement blessé - manquera le prochain match`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, seriouslyHurtLog];
  } else if (casualtyRoll <= 12) {
    // Serious Injury - NI + MNG
    const seriousInjuryLog = createLogEntry(
      'action',
      `${player.name} a une blessure sérieuse - blessure gênante + manquera le prochain match`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, seriousInjuryLog];
  } else if (casualtyRoll <= 14) {
    // Lasting Injury - réduction de caractéristique + MNG
    const lastingInjuryLog = createLogEntry(
      'action',
      `${player.name} a une blessure permanente - réduction de caractéristique + manquera le prochain match`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, lastingInjuryLog];
  } else {
    // DEAD - mort
    const deadLog = createLogEntry(
      'action',
      `${player.name} est MORT !`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, deadLog];
  }

  return newState;
}

/**
 * Gère l'exclusion d'un joueur (Sent off)
 */
export function handleSentOff(state: GameState, player: Player): GameState {
  const newState = movePlayerToDugoutZone(state, player.id, 'sentOff', player.team);
  
  const sentOffLog = createLogEntry(
    'action',
    `${player.name} est exclu par l'arbitre`,
    player.id,
    player.team
  );
  newState.gameLog = [...newState.gameLog, sentOffLog];

  return newState;
}

/**
 * Gère une blessure par la foule
 */
export function handleInjuryByCrowd(state: GameState, player: Player, rng: RNG): GameState {
  // Pas de jet d'armure pour les blessures de foule
  return performInjuryRoll(state, player, rng);
}
