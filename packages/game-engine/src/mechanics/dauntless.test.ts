import { describe, it, expect } from 'vitest';
import { setup, applyMove } from '../index';
import { checkDauntless } from './dauntless';
import type { GameState, Move, Player, RNG } from '../core/types';

/**
 * Dauntless (BB3 Season 2/3 rules):
 * - Before a block is rolled, if the attacker's total strength (ST + offensive assists)
 *   is less than the target's total strength (ST + defensive assists), the Dauntless
 *   attacker rolls a D6 and adds their ST (base, no assists).
 * - If D6 + attacker.ST >= target.totalStrength, the attacker's total strength is
 *   raised to match the target's (blocks are then rolled at 1 die, attacker chooses).
 * - Otherwise the block proceeds with the original unfavourable strength totals.
 * - Dauntless only triggers when the attacker is underdog.
 */

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Attacker',
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

describe('Regle: Dauntless — activation', () => {
  it('ne declenche pas si l\'attaquant n\'a pas le skill', () => {
    const attacker = makePlayer({ skills: [], st: 3 });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 5 });
    const state = setup();

    const rng = makeTestRNG([0.9]);
    const result = checkDauntless(state, attacker, defender, 3, 5, rng);

    expect(result.triggered).toBe(false);
    expect(result.newAttackerStrength).toBe(3);
    expect(result.newState).toBe(state); // pas de changement d'etat
  });

  it('ne declenche pas si la force de l\'attaquant est deja >= la cible', () => {
    const attacker = makePlayer({ skills: ['dauntless'], st: 4 });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 3 });
    const state = setup();

    const rng = makeTestRNG([0.1]);
    const result = checkDauntless(state, attacker, defender, 4, 3, rng);

    expect(result.triggered).toBe(false);
    expect(result.newAttackerStrength).toBe(4);
  });

  it('ne declenche pas si les forces totales sont egales', () => {
    const attacker = makePlayer({ skills: ['dauntless'], st: 3 });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 3 });
    const state = setup();

    const rng = makeTestRNG([0.1]);
    const result = checkDauntless(state, attacker, defender, 3, 3, rng);

    expect(result.triggered).toBe(false);
    expect(result.newAttackerStrength).toBe(3);
  });

  it('declenche et reussit : D6=6, ST=3 vs cible 5 → force egalisee', () => {
    const attacker = makePlayer({ skills: ['dauntless'], st: 3 });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 5 });
    const state = setup();

    // D6 = 6 (rng 0.95 → 6). 3 + 6 = 9 >= 5 → succes
    const rng = makeTestRNG([0.95]);
    const result = checkDauntless(state, attacker, defender, 3, 5, rng);

    expect(result.triggered).toBe(true);
    expect(result.success).toBe(true);
    expect(result.newAttackerStrength).toBe(5);
    expect(result.diceRoll).toBe(6);
  });

  it('declenche et echoue : D6=1, ST=3 vs cible 5 → force inchangee', () => {
    const attacker = makePlayer({ skills: ['dauntless'], st: 3 });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 5 });
    const state = setup();

    // D6 = 1 (rng 0.0 → 1). 3 + 1 = 4 < 5 → echec
    const rng = makeTestRNG([0.0]);
    const result = checkDauntless(state, attacker, defender, 3, 5, rng);

    expect(result.triggered).toBe(true);
    expect(result.success).toBe(false);
    expect(result.newAttackerStrength).toBe(3);
    expect(result.diceRoll).toBe(1);
  });

  it('le calcul utilise uniquement la ST de base (pas les assists)', () => {
    const attacker = makePlayer({ skills: ['dauntless'], st: 3 });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 4 });
    const state = setup();

    // Attaquant a 3 ST + 0 assist = 3 ; cible = 4 ST + 2 assists = 6 total
    // Dauntless roll : ST(3) + D6 doit etre >= 6 → D6 >= 3
    // D6 = 3 (rng 0.4 → 3). 3 + 3 = 6 >= 6 → succes → force = 6
    const rng = makeTestRNG([0.4]);
    const result = checkDauntless(state, attacker, defender, 3, 6, rng);

    expect(result.triggered).toBe(true);
    expect(result.success).toBe(true);
    expect(result.diceRoll).toBe(3);
    expect(result.newAttackerStrength).toBe(6);
  });

  it('le calcul utilise uniquement la ST de base (echec marginal)', () => {
    const attacker = makePlayer({ skills: ['dauntless'], st: 3 });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 4 });
    const state = setup();

    // Cible totale = 6. D6 = 2 → 3 + 2 = 5 < 6 → echec
    const rng = makeTestRNG([0.25]);
    const result = checkDauntless(state, attacker, defender, 3, 6, rng);

    expect(result.triggered).toBe(true);
    expect(result.success).toBe(false);
    expect(result.diceRoll).toBe(2);
    expect(result.newAttackerStrength).toBe(3);
  });

  it('ajoute une entree de log au GameState', () => {
    const attacker = makePlayer({ skills: ['dauntless'], st: 3, name: 'Troll Slayer' });
    const defender = makePlayer({ id: 'd1', team: 'B', st: 5 });
    const state = setup();
    const initialLogLength = state.gameLog.length;

    const rng = makeTestRNG([0.95]);
    const result = checkDauntless(state, attacker, defender, 3, 5, rng);

    expect(result.newState.gameLog.length).toBeGreaterThan(initialLogLength);
    const lastLog = result.newState.gameLog[result.newState.gameLog.length - 1];
    expect(lastLog.message).toContain('Intrépide');
  });
});

// ─── Integration ────────────────────────────────────────────────────────────

function createBlockScenario(attackerSkills: string[], attackerST: number, defenderST: number): GameState {
  const state = setup();
  const base = state.players[0];
  return {
    ...state,
    currentPlayer: 'A',
    selectedPlayerId: null,
    playerActions: {},
    isTurnover: false,
    teamRerolls: { teamA: 0, teamB: 0 },
    teamFoulCount: {},
    players: [
      {
        ...base,
        id: 'A1',
        team: 'A',
        pos: { x: 5, y: 5 },
        name: 'Dauntless Attacker',
        number: 1,
        position: 'Slayer',
        ma: 5,
        st: attackerST,
        ag: 3,
        pa: 4,
        av: 9,
        skills: attackerSkills,
        pm: 5,
        state: 'active',
        stunned: false,
      },
      {
        ...base,
        id: 'B1',
        team: 'B',
        pos: { x: 6, y: 5 },
        name: 'Big Guy',
        number: 2,
        position: 'BigGuy',
        ma: 4,
        st: defenderST,
        ag: 3,
        pa: 4,
        av: 9,
        skills: [],
        pm: 4,
        state: 'active',
        stunned: false,
      },
    ],
  };
}

describe('Regle: Dauntless — integration blocage', () => {
  it('un attaquant ST3 Dauntless contre ST5 reussit son Dauntless et bloque a 1 de', () => {
    const state = createBlockScenario(['dauntless'], 3, 5);
    // RNG sequence: D6 Dauntless (0.95 → 6) then block dice (0.5 → PUSH_BACK)
    const rng = makeTestRNG([0.95, 0.5]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };

    const result = applyMove(state, move, rng);

    // Le blocage a eu lieu (action consommee)
    expect(result.playerActions?.A1).toBe('BLOCK');
    // Aucun pendingBlock multi-dice → blocage resolu a 1 de (force egalisee a 5)
    expect(result.pendingBlock).toBeUndefined();
  });

  it('un attaquant ST3 sans Dauntless contre ST5 bloque a 2 des (defenseur choisit)', () => {
    const state = createBlockScenario([], 3, 5);
    const rng = makeTestRNG([0.1, 0.3]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };

    const result = applyMove(state, move, rng);

    // Multi-dice block → pendingBlock defini, chooser = defender
    expect(result.pendingBlock).toBeDefined();
    expect(result.pendingBlock?.chooser).toBe('defender');
    expect(result.pendingBlock?.options.length).toBe(2);
  });

  it('un attaquant ST3 Dauntless echoue son Dauntless et reste en desavantage', () => {
    const state = createBlockScenario(['dauntless'], 3, 5);
    // D6 = 1 (rng 0.0 → 1) → echec
    const rng = makeTestRNG([0.0, 0.1, 0.3]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };

    const result = applyMove(state, move, rng);

    // Echec : multi-dice block avec chooser = defender
    expect(result.pendingBlock).toBeDefined();
    expect(result.pendingBlock?.chooser).toBe('defender');
  });
});
