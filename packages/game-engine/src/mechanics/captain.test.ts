/**
 * Règle spéciale d'équipe "Capitaine" (Saison 3) — tests moteur.
 *
 * Couvre :
 *  - helpers purs (`isPlayerOnPitch`, `findCaptainOnPitch`,
 *    `findPlaceableCaptain`) ;
 *  - relance d'équipe gratuite sur un 6 naturel quand le capitaine est sur
 *    le terrain (`handleRerollChoose` → `consumeTeamReroll`) ;
 *  - déterminisme préservé : aucun jet supplémentaire sans capitaine ;
 *  - placement : `validatePlayerPlacement` refuse un placement qui laisse
 *    le capitaine disponible en réserve ;
 *  - propagation `TeamPlayerData.isCaptain` → `Player.isCaptain` dans
 *    `setupPreMatchWithTeams`.
 */

import { describe, it, expect } from 'vitest';
import type { GameState, Player, RNG } from '../core/types';
import {
  isPlayerOnPitch,
  findCaptainOnPitch,
  findPlaceableCaptain,
} from './captain';
import { handleRerollChoose } from '../actions/reroll-choose-handler';
import {
  setupPreMatchWithTeams,
  validatePlayerPlacement,
  type ExtendedGameState,
  type TeamPlayerData,
} from '../core/game-state';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'A1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Joueur',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: [],
    pm: 6,
    hasBall: false,
    state: 'active',
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: 1, teamB: 1 },
    dugouts: {
      teamA: { reserves: [], ko: [], casualties: [] },
      teamB: { reserves: [], ko: [], casualties: [] },
    },
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'A', teamB: 'B' },
    pm: 0,
    gameLog: [],
    playerActions: {},
    teamBlitzCount: { A: 0, B: 0 },
    teamFoulCount: { A: 0, B: 0 },
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    matchStats: {},
    ...overrides,
  } as unknown as GameState;
}

/** RNG déterministe qui sert les valeurs d'une file, puis 0.5. */
function queueRng(values: number[]): RNG {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0.5);
}

describe('captain — helpers purs', () => {
  it('isPlayerOnPitch : actif ou sonné sur une case valide', () => {
    expect(isPlayerOnPitch(makePlayer())).toBe(true);
    expect(isPlayerOnPitch(makePlayer({ state: 'stunned' }))).toBe(true);
    expect(isPlayerOnPitch(makePlayer({ pos: { x: -1, y: -1 } }))).toBe(false);
    expect(isPlayerOnPitch(makePlayer({ state: 'knocked_out' }))).toBe(false);
    expect(isPlayerOnPitch(makePlayer({ state: 'casualty' }))).toBe(false);
    expect(isPlayerOnPitch(makePlayer({ state: 'sent_off' }))).toBe(false);
  });

  it('findCaptainOnPitch : trouve le capitaine de la bonne équipe', () => {
    const captainA = makePlayer({ id: 'A7', isCaptain: true });
    const lineB = makePlayer({ id: 'B1', team: 'B' });
    const state = makeState({ players: [lineB, captainA] });
    expect(findCaptainOnPitch(state, 'A')?.id).toBe('A7');
    expect(findCaptainOnPitch(state, 'B')).toBeNull();
  });

  it('findCaptainOnPitch : null si le capitaine est en réserve ou KO', () => {
    const reserve = makePlayer({ id: 'A7', isCaptain: true, pos: { x: -1, y: -1 } });
    expect(findCaptainOnPitch(makeState({ players: [reserve] }), 'A')).toBeNull();
    const ko = makePlayer({ id: 'A7', isCaptain: true, state: 'knocked_out' });
    expect(findCaptainOnPitch(makeState({ players: [ko] }), 'A')).toBeNull();
  });

  it('findPlaceableCaptain : capitaine actif, placé ou non', () => {
    const reserve = makePlayer({ id: 'A7', isCaptain: true, pos: { x: -1, y: -1 } });
    expect(findPlaceableCaptain(makeState({ players: [reserve] }), 'A')?.id).toBe('A7');
    const ko = makePlayer({ id: 'A7', isCaptain: true, state: 'knocked_out' });
    expect(findPlaceableCaptain(makeState({ players: [ko] }), 'A')).toBeNull();
  });
});

describe('captain — relance d’équipe gratuite sur 6 naturel', () => {
  function makeGfiRerollState(players: Player[]): GameState {
    return makeState({
      players,
      pendingReroll: {
        rollType: 'gfi',
        playerId: players[0].id,
        team: 'A',
        playerIndex: 0,
        from: { x: 5, y: 5 },
        to: { x: 5, y: 5 },
        modifiers: 0,
        targetNumber: 2,
      },
      teamRerolls: { teamA: 3, teamB: 3 },
    });
  }

  it('capitaine sur le terrain + D6 = 6 → relance non décomptée', () => {
    const runner = makePlayer({ id: 'A1', gfiUsed: 1 });
    const captain = makePlayer({ id: 'A7', number: 7, isCaptain: true, pos: { x: 6, y: 6 } });
    const state = makeGfiRerollState([runner, captain]);
    // 1er rng : D6 capitaine = 6 (0.99), 2e rng : jet GFI réussi (0.9).
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      queueRng([0.99, 0.9]),
    );
    expect(next.teamRerolls.teamA).toBe(3);
    expect(next.rerollUsedThisTurn).toBe(true);
    const log = next.gameLog.find((e) => e.message.includes('gratuite'));
    expect(log).toBeDefined();
    expect(log?.details?.diceRoll).toBe(6);
  });

  it('capitaine sur le terrain + D6 < 6 → relance décomptée normalement', () => {
    const runner = makePlayer({ id: 'A1', gfiUsed: 1 });
    const captain = makePlayer({ id: 'A7', number: 7, isCaptain: true, pos: { x: 6, y: 6 } });
    const state = makeGfiRerollState([runner, captain]);
    // 1er rng : D6 capitaine = 3 (0.4), 2e rng : jet GFI.
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      queueRng([0.4, 0.9]),
    );
    expect(next.teamRerolls.teamA).toBe(2);
    const log = next.gameLog.find((e) => e.message.includes('Capitaine'));
    expect(log).toBeDefined();
    expect(log?.message).not.toContain('gratuite');
  });

  it('capitaine en réserve → aucun jet capitaine, relance décomptée', () => {
    const runner = makePlayer({ id: 'A1', gfiUsed: 1 });
    const captain = makePlayer({
      id: 'A7',
      number: 7,
      isCaptain: true,
      pos: { x: -1, y: -1 },
    });
    const state = makeGfiRerollState([runner, captain]);
    // Sans jet capitaine, le 1er rng est le jet GFI : 0.99 → 6 → réussi.
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      queueRng([0.99]),
    );
    expect(next.teamRerolls.teamA).toBe(2);
    expect(next.gameLog.some((e) => e.message.includes('Capitaine'))).toBe(false);
  });

  it('sans capitaine, la séquence de dés reste identique (déterminisme replays)', () => {
    const runner = makePlayer({ id: 'A1', gfiUsed: 1 });
    const state = makeGfiRerollState([runner]);
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      queueRng([0.99]),
    );
    // 0.99 → GFI = 6 → réussi, une seule consommation rng.
    const gfiLog = next.gameLog.find((e) => e.message.startsWith('Relance GFI'));
    expect(gfiLog?.details?.diceRoll).toBe(6);
    expect(next.teamRerolls.teamA).toBe(2);
  });

  it('le capitaine ADVERSE sur le terrain ne déclenche rien', () => {
    const runner = makePlayer({ id: 'A1', gfiUsed: 1 });
    const captainB = makePlayer({
      id: 'B7',
      team: 'B',
      number: 7,
      isCaptain: true,
      pos: { x: 20, y: 6 },
    });
    const state = makeGfiRerollState([runner, captainB]);
    const next = handleRerollChoose(
      state,
      { type: 'REROLL_CHOOSE', useReroll: true },
      queueRng([0.99]),
    );
    expect(next.teamRerolls.teamA).toBe(2);
    expect(next.gameLog.some((e) => e.message.includes('Capitaine'))).toBe(false);
  });
});

describe('captain — placement obligatoire si possible', () => {
  function makeSetupState(players: Player[]): ExtendedGameState {
    const base = makeState({ players }) as unknown as ExtendedGameState;
    return {
      ...base,
      preMatch: {
        phase: 'setup',
        currentCoach: 'A',
        legalSetupPositions: [],
        placedPlayers: players.filter((p) => p.pos.x >= 0).map((p) => p.id),
        kickingTeam: 'B',
        receivingTeam: 'A',
      },
    } as ExtendedGameState;
  }

  function makeElevenPlaced(captainPlaced: boolean): Player[] {
    const players: Player[] = [];
    for (let i = 1; i <= 11; i += 1) {
      players.push(
        makePlayer({ id: `A${i}`, number: i, pos: { x: 12, y: i % 15 } }),
      );
    }
    // 12e joueur : le capitaine — placé ou laissé en réserve.
    players.push(
      makePlayer({
        id: 'A12',
        number: 12,
        isCaptain: true,
        pos: captainPlaced ? { x: 11, y: 12 } : { x: -1, y: -1 },
      }),
    );
    if (captainPlaced) {
      // Garder 11 sur le terrain : un trois-quarts reste en réserve.
      players[10] = { ...players[10], pos: { x: -1, y: -1 } };
    }
    return players;
  }

  it('refuse la validation si le capitaine disponible est en réserve', () => {
    const state = makeSetupState(makeElevenPlaced(false));
    const next = validatePlayerPlacement(state);
    expect(next.preMatch.phase).toBe('setup');
    expect(next.preMatch.currentCoach).toBe('A');
    expect(
      next.gameLog.some((e) => e.message.includes('capitaine')),
    ).toBe(true);
  });

  it('valide le placement quand le capitaine est aligné', () => {
    const state = makeSetupState(makeElevenPlaced(true));
    const next = validatePlayerPlacement(state);
    // Équipe receveuse validée → passage au coach suivant.
    expect(next.preMatch.currentCoach).toBe('B');
  });

  it('valide le placement quand le capitaine est KO (pas disponible)', () => {
    const players = makeElevenPlaced(false).map((p) =>
      p.isCaptain ? { ...p, state: 'knocked_out' as const } : p,
    );
    const state = makeSetupState(players);
    const next = validatePlayerPlacement(state);
    expect(next.preMatch.currentCoach).toBe('B');
  });
});

describe('captain — propagation setupPreMatchWithTeams', () => {
  function makeTeamData(count: number, captainNumber?: number): TeamPlayerData[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `db-${i + 1}`,
      name: `Joueur ${i + 1}`,
      position: 'Lineman',
      number: i + 1,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 9,
      skills: i + 1 === captainNumber ? 'block,pro' : '',
      isCaptain: i + 1 === captainNumber,
    }));
  }

  it('propage isCaptain sur le Player du moteur', () => {
    const state = setupPreMatchWithTeams(
      makeTeamData(11, 3),
      makeTeamData(11),
      'Équipe A',
      'Équipe B',
    );
    const captain = state.players.find((p) => p.id === 'A3');
    expect(captain?.isCaptain).toBe(true);
    expect(
      state.players.filter((p) => p.isCaptain).map((p) => p.id),
    ).toEqual(['A3']);
  });
});
