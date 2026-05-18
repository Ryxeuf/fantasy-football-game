/**
 * BUG fixes audit round 3 :
 *  - C3 : ball carrier idx=9 hardcode → undefined si roster < 10.
 *  - H2 : ballYardline=4 magique au TURN_START initial.
 */
import { describe, it, expect } from 'vitest';
import { buildGameStateFromRosters } from './full-driver-roster';
import { getInitialBallYardline } from './full-driver-events';
import type { SimRosterPlayer } from '../types';

function rosterPlayer(over: Partial<SimRosterPlayer> = {}): SimRosterPlayer {
  return {
    id: 'p',
    name: 'P',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 8, skills: [],
    ...over,
  };
}

describe('Ball carrier idx variable (C3)', () => {
  it("roster complet (11 joueurs) : ball carrier = idx 9", () => {
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const state = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'B',
    });

    const carrier = state.players.find((p) => p.hasBall);
    expect(carrier).toBeDefined();
    expect(carrier?.id).toBe('A9'); // idx 9 du roster away
  });

  it("roster court (7 joueurs) : ball carrier = dernier joueur (idx=6)", () => {
    // Avant le fix, idx=9 → awayPlayers[9] undefined → personne n'a la balle
    // → la team receveuse ne marque jamais. Resultat : tous les matches en
    // 0-0 ou victoire kicker.
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 7 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const state = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'B',
    });

    const carrier = state.players.find((p) => p.hasBall);
    expect(carrier).toBeDefined();
    expect(carrier?.id).toBe('A6'); // dernier joueur place
  });
});

describe('getInitialBallYardline (H2)', () => {
  it("retourne la position du carrier au lieu d'un hardcode 4", () => {
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const state = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'B',
    });

    const yardline = getInitialBallYardline(state);
    // Le carrier est place sur TEAM_B_FORMATION[9] — sa position x est
    // utilisee comme yardline.
    const carrier = state.players.find((p) => p.hasBall)!;
    expect(yardline).toBe(carrier.pos.x);
  });
});
