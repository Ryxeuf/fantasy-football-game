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
  it("retourne la position du carrier normalisee selon l'equipe qui drive", () => {
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
    // Audit round 5 : la convention hybrid est yardline ∈ [0..26] ou
    // 0 = own goal de l'equipe qui drive. Team B drive (receivingTeam),
    // donc yardline = 26 - carrier.pos.x (B drive vers x=0, donc
    // commence pres de son own goal qui est x=26).
    const carrier = state.players.find((p) => p.hasBall)!;
    expect(yardline).toBe(26 - carrier.pos.x);
  });

  it("audit round 5 : team A driving → yardline = ballX (non normalise)", () => {
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const state = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'A',
    });

    const yardline = getInitialBallYardline(state);
    const carrier = state.players.find((p) => p.hasBall)!;
    expect(yardline).toBe(carrier.pos.x);
  });
});
