/**
 * Systeme d'apothecaire pour Blood Bowl (BB2020)
 *
 * Regles:
 * - Chaque equipe peut avoir un apothecaire (une utilisation par match)
 * - Sur KO: le joueur va en Reserves au lieu de KO
 * - Sur Casualty: re-lance le D16, le coach garde le meilleur resultat,
 *   le joueur va en Reserves
 * - Ne peut PAS etre utilise sur Stunned
 */

import { GameState, TeamId, RNG, CasualtyOutcome, PendingApothecary } from '../core/types';
import { movePlayerToDugoutZone } from './dugout';
import { rollLastingInjuryType } from './injury';
import { createLogEntry } from '../utils/logging';

/** Severity ranking for casualty outcomes (lower = less severe) */
const CASUALTY_SEVERITY: Record<CasualtyOutcome, number> = {
  badly_hurt: 0,
  seriously_hurt: 1,
  serious_injury: 2,
  lasting_injury: 3,
  dead: 4,
};

/**
 * Checks if the team has an apothecary available for the given player
 */
export function isApothecaryAvailable(state: GameState, playerId: string): boolean {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return false;

  if (!state.apothecaryAvailable) return false;
  const teamKey = player.team === 'A' ? 'teamA' : 'teamB';
  return state.apothecaryAvailable[teamKey] === true;
}

/**
 * Rolls a D16 casualty outcome (same logic as in injury.ts handleCasualty)
 */
function rollCasualtyOutcome(rng: RNG): { roll: number; outcome: CasualtyOutcome } {
  const roll = Math.floor(rng() * 16) + 1;

  if (roll <= 6) return { roll, outcome: 'badly_hurt' };
  if (roll <= 9) return { roll, outcome: 'seriously_hurt' };
  if (roll <= 12) return { roll, outcome: 'serious_injury' };
  if (roll <= 14) return { roll, outcome: 'lasting_injury' };
  return { roll, outcome: 'dead' };
}

/**
 * Applies the coach's apothecary choice.
 *
 * @param state - Current game state (with pendingApothecary set)
 * @param useApothecary - Whether the coach chooses to use the apothecary
 * @param rng - RNG for re-rolling casualty
 * @returns New game state
 */
export function applyApothecaryChoice(
  state: GameState,
  useApothecary: boolean,
  rng: RNG
): GameState {
  const pending = state.pendingApothecary;
  if (!pending) return state;

  const newState = structuredClone(state) as GameState;
  newState.pendingApothecary = undefined;

  if (!useApothecary) {
    const declineLog = createLogEntry(
      'action',
      `Apothecaire décliné pour ${getPlayerName(newState, pending.playerId)}`,
      pending.playerId,
      pending.team
    );
    newState.gameLog = [...newState.gameLog, declineLog];
    return newState;
  }

  // Consume apothecary
  const teamKey = pending.team === 'A' ? 'teamA' : 'teamB';
  newState.apothecaryAvailable = {
    ...newState.apothecaryAvailable,
    [teamKey]: false,
  };

  const playerName = getPlayerName(newState, pending.playerId);

  if (pending.injuryType === 'ko') {
    return applyApothecaryOnKO(newState, pending, playerName);
  }

  return applyApothecaryOnCasualty(newState, pending, playerName, rng);
}

/**
 * Apothecary on KO: move player from KO to Reserves
 */
function applyApothecaryOnKO(
  state: GameState,
  pending: PendingApothecary,
  playerName: string
): GameState {
  const newState = movePlayerToDugoutZone(state, pending.playerId, 'reserves', pending.team);

  // Update player state
  newState.players = newState.players.map(p =>
    p.id === pending.playerId ? { ...p, state: 'active', stunned: false } : p
  );

  const log = createLogEntry(
    'action',
    `Apothecaire utilise : ${playerName} recupere du KO et rejoint les reserves`,
    pending.playerId,
    pending.team
  );
  newState.gameLog = [...newState.gameLog, log];

  return newState;
}

/**
 * Apothecary on Casualty: re-roll D16, pick better result, move to Reserves
 */
function applyApothecaryOnCasualty(
  state: GameState,
  pending: PendingApothecary,
  playerName: string,
  rng: RNG
): GameState {
  // Re-roll casualty
  const newCasualty = rollCasualtyOutcome(rng);
  const player = state.players.find(p => p.id === pending.playerId);

  const rerollLog = createLogEntry(
    'dice',
    `Apothecaire - re-lancer casualty: ${newCasualty.roll} (${newCasualty.outcome})`,
    pending.playerId,
    pending.team,
    { casualtyRoll: newCasualty.roll, outcome: newCasualty.outcome }
  );
  state.gameLog = [...state.gameLog, rerollLog];

  // Determine which result is better (lower severity)
  const originalSeverity = CASUALTY_SEVERITY[pending.originalCasualtyOutcome!];
  const newSeverity = CASUALTY_SEVERITY[newCasualty.outcome];
  const keepOriginal = originalSeverity <= newSeverity;
  const chosenOutcome = keepOriginal ? pending.originalCasualtyOutcome! : newCasualty.outcome;

  // Update casualty result
  state.casualtyResults = { ...state.casualtyResults, [pending.playerId]: chosenOutcome };

  // Handle lasting injury details
  if (keepOriginal) {
    // Keep original lasting injury (or clear if badly_hurt)
    if (pending.originalLastingInjury) {
      state.lastingInjuryDetails = {
        ...state.lastingInjuryDetails,
        [pending.playerId]: pending.originalLastingInjury,
      };
    } else {
      // badly_hurt or seriously_hurt without lasting injury
      const { [pending.playerId]: _, ...rest } = state.lastingInjuryDetails;
      state.lastingInjuryDetails = rest;
    }
  } else {
    // Apply new casualty's lasting injury
    updateLastingInjuryForOutcome(state, pending.playerId, newCasualty.outcome, newCasualty.roll, rng, player?.pa ?? 0);
  }

  // Move player from casualty to reserves
  const newState = movePlayerToDugoutZone(state, pending.playerId, 'reserves', pending.team);
  newState.players = newState.players.map(p =>
    p.id === pending.playerId ? { ...p, state: 'active', stunned: false } : p
  );

  const choiceLog = createLogEntry(
    'action',
    `Apothecaire utilise : ${playerName} est soigne (${chosenOutcome}) et rejoint les reserves`,
    pending.playerId,
    pending.team,
    { originalOutcome: pending.originalCasualtyOutcome, newOutcome: newCasualty.outcome, chosen: chosenOutcome }
  );
  newState.gameLog = [...newState.gameLog, choiceLog];

  return newState;
}

/**
 * Updates lasting injury details for a new casualty outcome
 */
function updateLastingInjuryForOutcome(
  state: GameState,
  playerId: string,
  outcome: CasualtyOutcome,
  _roll: number,
  rng: RNG,
  playerPa: number
): void {
  const { [playerId]: _, ...rest } = state.lastingInjuryDetails;
  state.lastingInjuryDetails = rest;

  if (outcome === 'seriously_hurt') {
    state.lastingInjuryDetails[playerId] = {
      outcome: 'seriously_hurt',
      injuryType: 'niggling',
      missNextMatch: true,
    };
  } else if (outcome === 'serious_injury') {
    state.lastingInjuryDetails[playerId] = {
      outcome: 'serious_injury',
      injuryType: 'niggling',
      missNextMatch: true,
    };
  } else if (outcome === 'lasting_injury') {
    const injuryType = rollLastingInjuryType(rng, playerPa);
    state.lastingInjuryDetails[playerId] = {
      outcome: 'lasting_injury',
      injuryType,
      missNextMatch: true,
    };
  }
  // badly_hurt and dead: no lasting injury details needed
}

function getPlayerName(state: GameState, playerId: string): string {
  return state.players.find(p => p.id === playerId)?.name ?? playerId;
}
