/**
 * Système de blessures pour Blood Bowl
 * Gère les jets d'armure, de blessure et les zones de dugout
 */

import { GameState, Player, RNG, CasualtyOutcome, LastingInjuryType, LastingInjuryDetail, PendingApothecary } from '../core/types';
import { performArmorRoll } from '../utils/dice';
import { createLogEntry } from '../utils/logging';
import { movePlayerToDugoutZone } from './dugout';
import { isApothecaryAvailable } from './apothecary';

/**
 * Effectue un jet de blessure contre un joueur
 * @param state - État du jeu
 * @param player - Joueur blessé
 * @param rng - Générateur de nombres aléatoires
 * @returns Nouvel état du jeu après le jet de blessure
 */
export function performInjuryRoll(state: GameState, player: Player, rng: RNG, bonus: number = 0, causedById?: string): GameState {
  const newState = structuredClone(state) as GameState;

  // Jet de 2D6 pour la blessure (+ bonus de Mighty Blow éventuel)
  const injuryRoll = Math.floor(rng() * 6) + 1 + Math.floor(rng() * 6) + 1 + bonus;

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
    return handleCasualty(newState, player, rng, causedById);
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

  const stunnedLog = createLogEntry('action', `${player.name} est sonné`, player.id, player.team);
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

  // Verifier si l'apothecaire est disponible
  if (isApothecaryAvailable(newState, player.id)) {
    newState.pendingApothecary = {
      playerId: player.id,
      team: player.team,
      injuryType: 'ko',
    };
  }

  return newState;
}

/**
 * BB2020/BB3 lasting injury table (D6 roll for characteristic reduction).
 * 1: -1 MA, 2: -1 AV, 3: -1 PA (or -1 AG if no PA), 4-5: -1 AG, 6: -1 ST
 */
export function rollLastingInjuryType(rng: RNG, playerPa: number): LastingInjuryType {
  const roll = Math.floor(rng() * 6) + 1;
  switch (roll) {
    case 1: return '-1ma';
    case 2: return '-1av';
    case 3: return playerPa === 0 ? '-1ag' : '-1pa';
    case 4:
    case 5: return '-1ag';
    case 6: return '-1st';
    default: return '-1ag'; // safety fallback
  }
}

const LASTING_INJURY_LABELS: Record<LastingInjuryType, string> = {
  'niggling': 'Blessure gênante (Niggling Injury)',
  '-1ma': '-1 Mouvement (MA)',
  '-1av': '-1 Armure (AV)',
  '-1pa': '-1 Passe (PA)',
  '-1ag': '-1 Agilité (AG)',
  '-1st': '-1 Force (ST)',
};

/**
 * Gère un joueur blessé (10+)
 */
function handleCasualty(state: GameState, player: Player, rng: RNG, causedById?: string): GameState {
  // Tracker la casualty dans les stats (SPP pour l'attaquant)
  if (causedById) {
    if (!state.matchStats[causedById]) {
      state.matchStats[causedById] = { touchdowns: 0, casualties: 0, completions: 0, interceptions: 0, mvp: false };
    }
    state.matchStats[causedById].casualties += 1;
  }

  // Le joueur va en zone blessés
  const newState = movePlayerToDugoutZone(state, player.id, 'casualty', player.team);

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

  // Initialize lastingInjuryDetails if not present
  if (!newState.lastingInjuryDetails) {
    newState.lastingInjuryDetails = {};
  }

  // Déterminer le type de blessure
  let outcome: CasualtyOutcome;
  if (casualtyRoll <= 6) {
    outcome = 'badly_hurt';
    const badlyHurtLog = createLogEntry(
      'action',
      `${player.name} est gravement blessé - manque le reste du match`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, badlyHurtLog];
  } else if (casualtyRoll <= 9) {
    outcome = 'seriously_hurt';
    const seriouslyHurtLog = createLogEntry(
      'action',
      `${player.name} est sérieusement blessé - manquera le prochain match`,
      player.id,
      player.team
    );
    newState.gameLog = [...newState.gameLog, seriouslyHurtLog];
    // Seriously hurt: miss next match, no permanent stat change
    newState.lastingInjuryDetails[player.id] = {
      outcome: 'seriously_hurt',
      injuryType: 'niggling', // placeholder, only missNextMatch matters here
      missNextMatch: true,
    };
  } else if (casualtyRoll <= 12) {
    outcome = 'serious_injury';
    // Serious injury: Niggling Injury + miss next match
    newState.lastingInjuryDetails[player.id] = {
      outcome: 'serious_injury',
      injuryType: 'niggling',
      missNextMatch: true,
    };
    const seriousInjuryLog = createLogEntry(
      'action',
      `${player.name} a une blessure sérieuse - ${LASTING_INJURY_LABELS['niggling']} + manquera le prochain match`,
      player.id,
      player.team,
      { injuryType: 'niggling' }
    );
    newState.gameLog = [...newState.gameLog, seriousInjuryLog];
  } else if (casualtyRoll <= 14) {
    outcome = 'lasting_injury';
    // Lasting injury: roll D6 for specific stat reduction
    const injuryType = rollLastingInjuryType(rng, player.pa);
    newState.lastingInjuryDetails[player.id] = {
      outcome: 'lasting_injury',
      injuryType,
      missNextMatch: true,
    };
    const lastingInjuryLog = createLogEntry(
      'action',
      `${player.name} a une blessure permanente - ${LASTING_INJURY_LABELS[injuryType]} + manquera le prochain match`,
      player.id,
      player.team,
      { injuryType }
    );
    newState.gameLog = [...newState.gameLog, lastingInjuryLog];
  } else {
    outcome = 'dead';
    const deadLog = createLogEntry('action', `${player.name} est MORT !`, player.id, player.team);
    newState.gameLog = [...newState.gameLog, deadLog];
  }

  // Enregistrer le résultat de la blessure dans l'état du jeu
  newState.casualtyResults = { ...newState.casualtyResults, [player.id]: outcome };

  // Verifier si l'apothecaire est disponible
  if (isApothecaryAvailable(newState, player.id)) {
    const pendingApothecary: PendingApothecary = {
      playerId: player.id,
      team: player.team,
      injuryType: 'casualty',
      originalCasualtyOutcome: outcome,
      originalCasualtyRoll: casualtyRoll,
      causedById,
    };
    // Store lasting injury if applicable
    if (newState.lastingInjuryDetails[player.id]) {
      pendingApothecary.originalLastingInjury = { ...newState.lastingInjuryDetails[player.id] };
    }
    newState.pendingApothecary = pendingApothecary;
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
 * Gère une blessure par la foule (surf).
 * Pas de jet d'armure. Le résultat minimum est KO (Stunned est promu en KO).
 */
export function handleInjuryByCrowd(state: GameState, player: Player, rng: RNG): GameState {
  const newState = structuredClone(state) as GameState;

  // Jet de 2D6 pour la blessure (pas de bonus)
  const injuryRoll = Math.floor(rng() * 6) + 1 + Math.floor(rng() * 6) + 1;

  const injuryLog = createLogEntry(
    'dice',
    `Jet de blessure (foule): ${injuryRoll}`,
    player.id,
    player.team,
    { injuryRoll }
  );
  newState.gameLog = [...newState.gameLog, injuryLog];

  // En Blood Bowl, une blessure par la foule est au minimum un KO.
  // Stunned (2-7) est promu en KO.
  if (injuryRoll <= 9) {
    // 2-9: KO (inclut le résultat Stunned promu)
    const koState = movePlayerToDugoutZone(newState, player.id, 'knockedOut', player.team);
    const koLog = createLogEntry(
      'action',
      `${player.name} est KO par la foule et retiré du terrain`,
      player.id,
      player.team
    );
    koState.gameLog = [...koState.gameLog, koLog];
    return koState;
  } else {
    // 10+: Casualty
    return handleCasualty(newState, player, rng);
  }
}
