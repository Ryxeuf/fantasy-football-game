/**
 * Tests post-kickoff-implementation :
 *  - `buildGameStateFromRosters` ne pré-attribue plus le ballon
 *    (la vraie séquence kickoff dans `executeHeadlessKickoff` s'en charge).
 *  - `getInitialBallYardline` calcule un yardline cohérent avec la
 *    position courante du ballon ou du porteur.
 */
import { describe, it, expect } from 'vitest';
import { buildGameStateFromRosters } from './full-driver-roster';
import { getInitialBallYardline } from './full-driver-events';
import { executeHeadlessKickoff } from './full-driver-kickoff';
import { makeRNG } from '@bb/game-engine';
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

describe('buildGameStateFromRosters — pas de pré-attribution du ballon', () => {
  it("roster complet : aucun joueur n'a hasBall et state.ball est undefined", () => {
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const state = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'B',
    });

    expect(state.players.some((p) => p.hasBall)).toBe(false);
    expect(state.ball).toBeUndefined();
  });

  it("roster court (7 joueurs) : aucun ball carrier auto-attribué", () => {
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 7 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const state = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'B',
    });

    expect(state.players.some((p) => p.hasBall)).toBe(false);
    expect(state.ball).toBeUndefined();
  });
});

describe('executeHeadlessKickoff — produit un état BB-conforme', () => {
  it("après kickoff : soit un porteur receveur, soit un ballon au sol/touchback", () => {
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const built = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'B',
    });

    const rng = makeRNG(42);
    const state = executeHeadlessKickoff(built, 'A', rng);

    // Soit un joueur receveur a le ballon (pickup réussi ou touchback)
    // soit le ballon est au sol dans la moitié receveuse.
    const carrier = state.players.find((p) => p.hasBall);
    if (carrier) {
      expect(carrier.team).toBe('B');
    } else {
      expect(state.ball).toBeDefined();
    }
  });
});

describe('getInitialBallYardline (H2) — après kickoff', () => {
  it("retourne un yardline cohérent avec la position du ballon", () => {
    const homeRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `H${i}`, name: `H${i}`, number: i + 1 }),
    );
    const awayRoster = Array.from({ length: 11 }, (_, i) =>
      rosterPlayer({ id: `A${i}`, name: `A${i}`, number: i + 1 }),
    );
    const built = buildGameStateFromRosters({
      homeRoster, awayRoster, receivingTeam: 'B',
    });
    const rng = makeRNG(42);
    const state = executeHeadlessKickoff(built, 'A', rng);

    const yardline = getInitialBallYardline(state);
    // Le yardline est calculé à partir de la position du carrier ou
    // du ballon au sol post-kickoff. La valeur exacte dépend du
    // scatter D8/D6 — on vérifie juste qu'elle est dans le terrain.
    expect(yardline).toBeGreaterThanOrEqual(0);
    expect(yardline).toBeLessThanOrEqual(state.width);
  });
});
