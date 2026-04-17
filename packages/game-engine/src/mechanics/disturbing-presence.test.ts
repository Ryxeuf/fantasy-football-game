import { describe, it, expect } from 'vitest';
import type { GameState, Player } from '../core/types';
import {
  hasDisturbingPresence,
  getDisturbingPresenceModifier,
} from './disturbing-presence';
import { calculatePassModifiers, calculateCatchModifiers } from './passing';

/**
 * Disturbing Presence (Presence Perturbante) — BB3 Season 2/3.
 *
 * Quand un joueur adverse effectue une action de Passe, Lancer d'Equipier,
 * Lancer de Bombe, tente d'intercepter une passe ou de receptionner le ballon,
 * il applique un modificateur de -1 par joueur adverse avec cette competence
 * situe a 3 cases ou moins de lui (distance de Chebyshev).
 *
 * Un joueur Prone / Stunned / KO / Casualty / Hypnotise n'exerce pas sa
 * presence perturbante.
 */

const TEAM_A = 'A';
const TEAM_B = 'B';

function makePlayer(partial: Partial<Player> & Pick<Player, 'id' | 'team' | 'pos'>): Player {
  return {
    name: partial.id,
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    stunned: false,
    state: 'active',
    ...partial,
  };
}

function makeState(players: Player[]): GameState {
  return {
    width: 26,
    height: 15,
    players,
    ball: undefined,
    currentPlayer: TEAM_A,
    half: 1,
    turn: 1,
    scores: { teamA: 0, teamB: 0 },
    playerActions: {},
    teamFoulCount: {},
    teamRerolls: { teamA: 0, teamB: 0 },
    matchStats: {},
    gameLog: [],
    isTurnover: false,
  } as unknown as GameState;
}

describe('hasDisturbingPresence', () => {
  it('retourne true si le joueur a le skill', () => {
    const p = makePlayer({ id: 'P1', team: TEAM_A, pos: { x: 0, y: 0 }, skills: ['disturbing-presence'] });
    expect(hasDisturbingPresence(p)).toBe(true);
  });

  it('retourne false sinon', () => {
    const p = makePlayer({ id: 'P1', team: TEAM_A, pos: { x: 0, y: 0 }, skills: [] });
    expect(hasDisturbingPresence(p)).toBe(false);
  });
});

describe('getDisturbingPresenceModifier', () => {
  it('retourne 0 sans adversaire avec le skill', () => {
    const state = makeState([
      makePlayer({ id: 'A1', team: TEAM_A, pos: { x: 5, y: 5 } }),
      makePlayer({ id: 'B1', team: TEAM_B, pos: { x: 6, y: 5 } }),
    ]);
    expect(getDisturbingPresenceModifier(state, { x: 5, y: 5 }, TEAM_A)).toBe(0);
  });

  it('retourne -1 pour un adversaire avec disturbing-presence a 3 cases', () => {
    const state = makeState([
      makePlayer({ id: 'A1', team: TEAM_A, pos: { x: 5, y: 5 } }),
      makePlayer({
        id: 'B1',
        team: TEAM_B,
        pos: { x: 8, y: 5 },
        skills: ['disturbing-presence'],
      }),
    ]);
    expect(getDisturbingPresenceModifier(state, { x: 5, y: 5 }, TEAM_A)).toBe(-1);
  });

  it('cumule -2 pour deux adversaires avec disturbing-presence dans 3 cases', () => {
    const state = makeState([
      makePlayer({
        id: 'B1',
        team: TEAM_B,
        pos: { x: 7, y: 6 },
        skills: ['disturbing-presence'],
      }),
      makePlayer({
        id: 'B2',
        team: TEAM_B,
        pos: { x: 4, y: 3 },
        skills: ['disturbing-presence'],
      }),
    ]);
    expect(getDisturbingPresenceModifier(state, { x: 5, y: 5 }, TEAM_A)).toBe(-2);
  });

  it('ne compte pas les adversaires a plus de 3 cases', () => {
    const state = makeState([
      makePlayer({
        id: 'B1',
        team: TEAM_B,
        pos: { x: 9, y: 5 }, // Chebyshev = 4
        skills: ['disturbing-presence'],
      }),
    ]);
    expect(getDisturbingPresenceModifier(state, { x: 5, y: 5 }, TEAM_A)).toBe(0);
  });

  it('ne compte pas les coequipiers avec disturbing-presence', () => {
    const state = makeState([
      makePlayer({
        id: 'A2',
        team: TEAM_A,
        pos: { x: 6, y: 5 },
        skills: ['disturbing-presence'],
      }),
    ]);
    expect(getDisturbingPresenceModifier(state, { x: 5, y: 5 }, TEAM_A)).toBe(0);
  });

  it('ne compte pas un adversaire stunned', () => {
    const state = makeState([
      makePlayer({
        id: 'B1',
        team: TEAM_B,
        pos: { x: 6, y: 5 },
        skills: ['disturbing-presence'],
        stunned: true,
      }),
    ]);
    expect(getDisturbingPresenceModifier(state, { x: 5, y: 5 }, TEAM_A)).toBe(0);
  });

  it('ne compte pas un adversaire KO / Casualty / Sent Off', () => {
    const state = makeState([
      makePlayer({
        id: 'B1',
        team: TEAM_B,
        pos: { x: 6, y: 5 },
        skills: ['disturbing-presence'],
        state: 'knocked_out',
      }),
      makePlayer({
        id: 'B2',
        team: TEAM_B,
        pos: { x: 5, y: 6 },
        skills: ['disturbing-presence'],
        state: 'casualty',
      }),
      makePlayer({
        id: 'B3',
        team: TEAM_B,
        pos: { x: 5, y: 4 },
        skills: ['disturbing-presence'],
        state: 'sent_off',
      }),
    ]);
    expect(getDisturbingPresenceModifier(state, { x: 5, y: 5 }, TEAM_A)).toBe(0);
  });

  it('ne compte pas un adversaire hypnotise', () => {
    const state = makeState([
      makePlayer({
        id: 'B1',
        team: TEAM_B,
        pos: { x: 6, y: 5 },
        skills: ['disturbing-presence'],
      }),
    ]);
    const hypnotized = { ...state, hypnotizedPlayers: ['B1'] } as GameState;
    expect(getDisturbingPresenceModifier(hypnotized, { x: 5, y: 5 }, TEAM_A)).toBe(0);
  });
});

describe('integration — calculatePassModifiers applique disturbing-presence', () => {
  it('subit -1 par adversaire avec disturbing-presence a 3 cases du passeur', () => {
    const passer = makePlayer({ id: 'A1', team: TEAM_A, pos: { x: 10, y: 7 }, hasBall: true });
    const target = makePlayer({ id: 'A2', team: TEAM_A, pos: { x: 13, y: 7 } });
    const dp = makePlayer({
      id: 'B1',
      team: TEAM_B,
      pos: { x: 12, y: 7 }, // 2 cases du passeur
      skills: ['disturbing-presence'],
    });
    const state = makeState([passer, target, dp]);
    const mods = calculatePassModifiers(state, passer, target.pos);
    // distance quick (+1), pas d'adversaire adjacent au passeur (-0), DP (-1)
    expect(mods).toBe(0);
  });

  it('cumule le malus de marquage et de disturbing-presence', () => {
    const passer = makePlayer({ id: 'A1', team: TEAM_A, pos: { x: 10, y: 7 }, hasBall: true });
    const target = makePlayer({ id: 'A2', team: TEAM_A, pos: { x: 13, y: 7 } });
    const marker = makePlayer({
      id: 'B1',
      team: TEAM_B,
      pos: { x: 11, y: 7 }, // adjacent + DP
      skills: ['disturbing-presence'],
    });
    const state = makeState([passer, target, marker]);
    const mods = calculatePassModifiers(state, passer, target.pos);
    // quick (+1), marquage (-1), DP (-1)
    expect(mods).toBe(-1);
  });
});

describe('integration — calculateCatchModifiers applique disturbing-presence', () => {
  it('subit -1 par adversaire avec disturbing-presence a 3 cases du receveur', () => {
    const catcher = makePlayer({ id: 'A2', team: TEAM_A, pos: { x: 13, y: 7 } });
    const dp = makePlayer({
      id: 'B1',
      team: TEAM_B,
      pos: { x: 15, y: 8 }, // 2 cases du receveur
      skills: ['disturbing-presence'],
    });
    const state = makeState([catcher, dp]);
    const mods = calculateCatchModifiers(state, catcher);
    // pas d'adversaire adjacent (-0), DP (-1)
    expect(mods).toBe(-1);
  });
});
