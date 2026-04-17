import { describe, it, expect } from 'vitest';
import {
  isEligibleKickPlayer,
  hasEligibleKickPlayer,
  halveScatterD6,
  applyKickSkillToDeviation,
} from './kick-skill';
import {
  setup,
  calculateKickDeviation,
  placeKickoffBall,
  type ExtendedGameState,
} from '../core/game-state';
import type { GameState, Player } from '../core/types';

/**
 * Regle BB3 — skill Kick :
 *  - Si l'equipe qui botte a sur le terrain un joueur avec Kick, on peut
 *    diviser par deux le D6 de deviation du kickoff, arrondi a l'entier
 *    inferieur (1 -> 0, 2 -> 1, 3 -> 1, 4 -> 2, 5 -> 2, 6 -> 3).
 *  - Le joueur doit etre sur le terrain (pas en reserve / dugout).
 *  - Le joueur ne doit pas etre sur la Ligne de Scrimmage.
 *  - Le joueur ne doit pas etre dans une Wide Zone.
 */

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 7 },
    name: 'Kicker',
    number: 1,
    position: 'Lineman',
    ma: 5,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 5,
    state: 'active',
    ...overrides,
  };
}

function makeState(players: Player[]): GameState {
  return {
    width: 26,
    height: 15,
    players,
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: true, teamB: true },
    teamNames: { teamA: 'Team A', teamB: 'Team B' },
    gameLog: [],
    half: 1,
    score: { teamA: 0, teamB: 0 },
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    rerollUsedThisTurn: false,
    teamRerolls: { teamA: 0, teamB: 0 },
    dedicatedFans: { teamA: 0, teamB: 0 },
  } as unknown as GameState;
}

describe('Regle: Kick — halveScatterD6 (arrondi inferieur)', () => {
  it('1 -> 0', () => {
    expect(halveScatterD6(1)).toBe(0);
  });
  it('2 -> 1', () => {
    expect(halveScatterD6(2)).toBe(1);
  });
  it('3 -> 1', () => {
    expect(halveScatterD6(3)).toBe(1);
  });
  it('4 -> 2', () => {
    expect(halveScatterD6(4)).toBe(2);
  });
  it('5 -> 2', () => {
    expect(halveScatterD6(5)).toBe(2);
  });
  it('6 -> 3', () => {
    expect(halveScatterD6(6)).toBe(3);
  });
});

describe('Regle: Kick — isEligibleKickPlayer', () => {
  it('retourne vrai pour un joueur Kick en zone centrale de sa moitie', () => {
    const kicker = makePlayer({ team: 'A', skills: ['kick'], pos: { x: 5, y: 7 } });
    expect(isEligibleKickPlayer(kicker, 'A')).toBe(true);
  });

  it('retourne faux si le joueur n\'a pas le skill Kick', () => {
    const p = makePlayer({ team: 'A', skills: [], pos: { x: 5, y: 7 } });
    expect(isEligibleKickPlayer(p, 'A')).toBe(false);
  });

  it('retourne faux si le joueur est en reserve (pos.x < 0)', () => {
    const p = makePlayer({ team: 'A', skills: ['kick'], pos: { x: -1, y: 0 } });
    expect(isEligibleKickPlayer(p, 'A')).toBe(false);
  });

  it('retourne faux si le joueur est sur la LoS equipe A (x=12)', () => {
    const p = makePlayer({ team: 'A', skills: ['kick'], pos: { x: 12, y: 7 } });
    expect(isEligibleKickPlayer(p, 'A')).toBe(false);
  });

  it('retourne faux si le joueur est sur la LoS equipe B (x=13)', () => {
    const p = makePlayer({ team: 'B', skills: ['kick'], pos: { x: 13, y: 7 } });
    expect(isEligibleKickPlayer(p, 'B')).toBe(false);
  });

  it('retourne faux si le joueur est dans la Wide Zone superieure (y<=2)', () => {
    const p = makePlayer({ team: 'A', skills: ['kick'], pos: { x: 5, y: 1 } });
    expect(isEligibleKickPlayer(p, 'A')).toBe(false);
  });

  it('retourne faux si le joueur est dans la Wide Zone inferieure (y>=12)', () => {
    const p = makePlayer({ team: 'A', skills: ['kick'], pos: { x: 5, y: 13 } });
    expect(isEligibleKickPlayer(p, 'A')).toBe(false);
  });

  it('retourne faux si le joueur appartient a une autre equipe', () => {
    const p = makePlayer({ team: 'B', skills: ['kick'], pos: { x: 20, y: 7 } });
    expect(isEligibleKickPlayer(p, 'A')).toBe(false);
  });
});

describe('Regle: Kick — hasEligibleKickPlayer', () => {
  it('retourne vrai des qu\'un joueur eligible est present', () => {
    const state = makeState([
      makePlayer({ id: 'a1', team: 'A', skills: ['kick'], pos: { x: 4, y: 7 } }),
      makePlayer({ id: 'a2', team: 'A', skills: [], pos: { x: 12, y: 6 } }),
    ]);
    expect(hasEligibleKickPlayer(state, 'A')).toBe(true);
  });

  it('retourne faux si aucun joueur Kick n\'est eligible', () => {
    const state = makeState([
      makePlayer({ id: 'a1', team: 'A', skills: ['kick'], pos: { x: 12, y: 7 } }), // sur LoS
      makePlayer({ id: 'a2', team: 'A', skills: ['kick'], pos: { x: 4, y: 1 } }), // wide zone
      makePlayer({ id: 'a3', team: 'A', skills: ['kick'], pos: { x: -1, y: 0 } }), // reserve
    ]);
    expect(hasEligibleKickPlayer(state, 'A')).toBe(false);
  });

  it('n\'est pas influencee par un joueur Kick dans l\'equipe adverse', () => {
    const state = makeState([
      makePlayer({ id: 'b1', team: 'B', skills: ['kick'], pos: { x: 20, y: 7 } }),
    ]);
    expect(hasEligibleKickPlayer(state, 'A')).toBe(false);
    expect(hasEligibleKickPlayer(state, 'B')).toBe(true);
  });
});

describe('Regle: Kick — integration avec calculateKickDeviation', () => {
  /**
   * Construit un etat pre-match pret pour la deviation de kickoff.
   * Team A botte, le ballon est place sur (20, 7) (moitie de B).
   */
  function makeKickoffState(kickerSkills: string[]): ExtendedGameState {
    const base = setup();
    const kicker: Player = {
      id: 'A-kicker',
      team: 'A',
      pos: { x: 5, y: 7 }, // zone centrale, hors LoS, hors wide zone
      name: 'Kicker',
      number: 99,
      position: 'Lineman',
      ma: 5,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: kickerSkills,
      pm: 5,
      state: 'active',
    };
    const extended: ExtendedGameState = {
      ...base,
      players: [...base.players, kicker],
      preMatch: {
        phase: 'kickoff-sequence',
        currentCoach: 'A',
        legalSetupPositions: [],
        placedPlayers: [],
        kickingTeam: 'A',
        receivingTeam: 'B',
        kickoffStep: 'place-ball',
      },
    };
    // Place le ballon sur la moitie receveuse (x=20, y=7)
    return placeKickoffBall(extended, { x: 20, y: 7 }) as ExtendedGameState;
  }

  it('ne reduit pas le D6 si aucun joueur Kick sur le terrain', () => {
    const state = makeKickoffState([]); // pas de skill
    // RNG controle : d8 -> 1 (N), d6 -> 6 => deviation Y -= 6
    const rngValues = [0 / 8, 5 / 6]; // floor(0*8)+1=1, floor(5/6*6)+1=6
    let i = 0;
    const rng = () => rngValues[i++];
    const result = calculateKickDeviation(state, rng);
    expect(result.preMatch.kickDeviation?.d8).toBe(1);
    expect(result.preMatch.kickDeviation?.d6).toBe(6); // non modifie
    expect(result.preMatch.finalBallPosition).toEqual({ x: 20, y: 1 });
  });

  it('divise le D6 par deux (6 -> 3) si joueur Kick eligible', () => {
    const state = makeKickoffState(['kick']);
    const rngValues = [0 / 8, 5 / 6]; // d8=1, rawD6=6
    let i = 0;
    const rng = () => rngValues[i++];
    const result = calculateKickDeviation(state, rng);
    expect(result.preMatch.kickDeviation?.d8).toBe(1);
    expect(result.preMatch.kickDeviation?.d6).toBe(3); // 6 / 2
    // Deviation N avec d6=3 depuis (20,7) -> (20, 4)
    expect(result.preMatch.finalBallPosition).toEqual({ x: 20, y: 4 });
  });

  it('D6=1 devient 0 (ballon reste sur la case placee)', () => {
    const state = makeKickoffState(['kick']);
    const rngValues = [0 / 8, 0 / 6]; // d8=1, rawD6=1
    let i = 0;
    const rng = () => rngValues[i++];
    const result = calculateKickDeviation(state, rng);
    expect(result.preMatch.kickDeviation?.d6).toBe(0);
    expect(result.preMatch.finalBallPosition).toEqual({ x: 20, y: 7 });
  });

  it('log mentionne le skill Kick quand applique', () => {
    const state = makeKickoffState(['kick']);
    const rngValues = [0 / 8, 4 / 6]; // d8=1, rawD6=5
    let i = 0;
    const rng = () => rngValues[i++];
    const result = calculateKickDeviation(state, rng);
    const last = result.gameLog[result.gameLog.length - 1];
    expect(last.message).toContain('skill Kick');
    expect(last.message).toContain('5 -> 2');
  });

  it('ne s\'applique pas si le joueur Kick est sur la LoS', () => {
    const base = setup();
    const losKicker: Player = {
      id: 'A-los', team: 'A',
      pos: { x: 12, y: 7 }, // LoS equipe A
      name: 'LosKicker', number: 99, position: 'Lineman',
      ma: 5, st: 3, ag: 3, pa: 4, av: 8,
      skills: ['kick'], pm: 5, state: 'active',
    };
    const extended: ExtendedGameState = {
      ...base,
      players: [...base.players, losKicker],
      preMatch: {
        phase: 'kickoff-sequence',
        currentCoach: 'A',
        legalSetupPositions: [],
        placedPlayers: [],
        kickingTeam: 'A',
        receivingTeam: 'B',
        kickoffStep: 'place-ball',
      },
    };
    const withBall = placeKickoffBall(extended, { x: 20, y: 7 }) as ExtendedGameState;
    const rngValues = [0 / 8, 5 / 6]; // rawD6=6
    let i = 0;
    const rng = () => rngValues[i++];
    const result = calculateKickDeviation(withBall, rng);
    expect(result.preMatch.kickDeviation?.d6).toBe(6); // skill pas applique
  });
});

describe('Regle: Kick — applyKickSkillToDeviation', () => {
  it('divise le D6 si l\'equipe qui botte a un Kick eligible', () => {
    const state = makeState([
      makePlayer({ id: 'a1', team: 'A', skills: ['kick'], pos: { x: 4, y: 7 } }),
    ]);
    expect(applyKickSkillToDeviation(state, 'A', 5)).toEqual({ d6: 2, applied: true });
    expect(applyKickSkillToDeviation(state, 'A', 1)).toEqual({ d6: 0, applied: true });
    expect(applyKickSkillToDeviation(state, 'A', 6)).toEqual({ d6: 3, applied: true });
  });

  it('ne modifie pas le D6 si aucun joueur Kick eligible', () => {
    const state = makeState([
      makePlayer({ id: 'a1', team: 'A', skills: [], pos: { x: 4, y: 7 } }),
    ]);
    expect(applyKickSkillToDeviation(state, 'A', 5)).toEqual({ d6: 5, applied: false });
  });

  it('ne s\'applique qu\'a l\'equipe qui botte', () => {
    const state = makeState([
      makePlayer({ id: 'b1', team: 'B', skills: ['kick'], pos: { x: 20, y: 7 } }),
    ]);
    expect(applyKickSkillToDeviation(state, 'A', 5)).toEqual({ d6: 5, applied: false });
    expect(applyKickSkillToDeviation(state, 'B', 4)).toEqual({ d6: 2, applied: true });
  });
});
