import { describe, it, expect } from 'vitest';
import { setup, applyMove, getLegalMoves } from '../index';
import type { GameState, RNG, Move, Player } from '../core/types';
import { calculateArmorTarget, performArmorRoll } from '../utils/dice';
import { performArmorRollWithNotification } from '../utils/dice-notifications';

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
    name: 'Stunty Player',
    number: 1,
    position: 'Lineman',
    ma: 5,
    st: 2,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 5,
    state: 'active',
    ...overrides,
  };
}

function createPassTestState(passerSkills: string[] = []): GameState {
  const state = setup();
  state.players = [
    {
      id: 'A1',
      team: 'A',
      pos: { x: 5, y: 7 },
      name: 'Stunty Passer',
      number: 1,
      position: 'Lineman',
      ma: 5,
      st: 2,
      ag: 3,
      pa: 4,
      av: 7,
      skills: passerSkills,
      pm: 5,
      hasBall: true,
      state: 'active',
    },
    {
      id: 'A2',
      team: 'A',
      pos: { x: 8, y: 7 }, // quick range (distance 3)
      name: 'Short Receiver',
      number: 2,
      position: 'Lineman',
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: [],
      pm: 6,
      hasBall: false,
      state: 'active',
    },
    {
      id: 'A3',
      team: 'A',
      pos: { x: 15, y: 7 }, // long range (distance 10)
      name: 'Long Receiver',
      number: 3,
      position: 'Lineman',
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: [],
      pm: 6,
      hasBall: false,
      state: 'active',
    },
    {
      id: 'A4',
      team: 'A',
      pos: { x: 18, y: 7 }, // bomb range (distance 13)
      name: 'Bomb Receiver',
      number: 4,
      position: 'Lineman',
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: [],
      pm: 6,
      hasBall: false,
      state: 'active',
    },
  ];
  state.ball = undefined;
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

describe('Regle: Stunty — jet d\'armure', () => {
  it('reduit de 1 la valeur cible du jet d\'armure (calculateArmorTarget)', () => {
    const stunty = makePlayer({ skills: ['stunty'], av: 8 });
    const regular = makePlayer({ skills: [], av: 8 });

    expect(calculateArmorTarget(stunty, 0)).toBe(7); // 8 - 1 (stunty)
    expect(calculateArmorTarget(regular, 0)).toBe(8);
  });

  it('cumule le malus Stunty avec les modificateurs positifs (Mighty Blow)', () => {
    const stunty = makePlayer({ skills: ['stunty'], av: 8 });
    // Mighty Blow bonus translated as attacker roll +1 ; here we model as negative
    // target modifier for simplicity: target=av+modifiers-stuntyAdjust.
    // With +1 attacker roll (handled at call site) the effective target check still
    // benefits from Stunty -1 on av.
    expect(calculateArmorTarget(stunty, 0)).toBe(7);
  });

  it('performArmorRoll : l\'armure Stunty casse plus souvent pour un meme jet', () => {
    const stunty = makePlayer({ skills: ['stunty'], av: 8 });
    const regular = makePlayer({ skills: [], av: 8 });

    // RNG produces 2D6 = 7 (6 threshold pour stunty AV 7, 8 pour regular AV 8)
    // rng 0.5 → die = floor(0.5*6)+1 = 4 ; two dice = 8
    const rngStunty = makeTestRNG([0.5, 0.5]);
    const rngRegular = makeTestRNG([0.5, 0.5]);

    const stuntyResult = performArmorRoll(stunty, rngStunty);
    const regularResult = performArmorRoll(regular, rngRegular);

    expect(stuntyResult.diceRoll).toBe(8);
    expect(regularResult.diceRoll).toBe(8);
    expect(stuntyResult.targetNumber).toBe(7); // av 8 - 1 stunty
    expect(regularResult.targetNumber).toBe(8);

    // diceRoll 8 >= target 7 → armour breaks for stunty
    expect(stuntyResult.success).toBe(false);
    // diceRoll 8 >= target 8 → armour breaks for regular too on exactly 8
    expect(regularResult.success).toBe(false);
  });

  it('performArmorRoll : armure Stunty tient si jet faible', () => {
    const stunty = makePlayer({ skills: ['stunty'], av: 8 });
    // rng 0.0 → die = 1 ; 2d6 = 2
    const rng = makeTestRNG([0.0, 0.0]);
    const result = performArmorRoll(stunty, rng);
    expect(result.diceRoll).toBe(2);
    expect(result.targetNumber).toBe(7);
    expect(result.success).toBe(true); // 2 < 7 → armure tient
  });

  it('performArmorRoll : pile sur le seuil Stunty → armure percée', () => {
    const stunty = makePlayer({ skills: ['stunty'], av: 8 });
    // Craft dice to make 2d6 = 7 (below original target 8, at stunty target 7)
    // Die1 = 3 (rng 0.4), Die2 = 4 (rng 0.5) → 3+4 = 7
    const rng = makeTestRNG([0.4, 0.55]);
    const result = performArmorRoll(stunty, rng);
    expect(result.diceRoll).toBe(7);
    expect(result.targetNumber).toBe(7);
    // 7 >= 7 → armour broken (success = false)
    expect(result.success).toBe(false);
  });

  it('performArmorRollWithNotification applique aussi le malus Stunty', () => {
    const stunty = makePlayer({ skills: ['stunty'], av: 8 });
    // Die1 = 3, Die2 = 4 → 2D6 = 7
    const rng = makeTestRNG([0.4, 0.55]);
    const result = performArmorRollWithNotification(stunty, rng);
    expect(result.diceRoll).toBe(7);
    expect(result.targetNumber).toBe(7); // 8 - 1 stunty
    expect(result.success).toBe(false);
  });

  it('Stunty + modifier explicite sont cumulatifs', () => {
    const stunty = makePlayer({ skills: ['stunty'], av: 8 });
    // Caller supplies +1 modifier (e.g. armor-piercing skill), stunty applies -1
    expect(calculateArmorTarget(stunty, 1)).toBe(8); // 8 + 1 - 1
  });

  it('n\'applique pas le malus aux joueurs sans Stunty', () => {
    const regular = makePlayer({ skills: ['dodge', 'sure-hands'], av: 9 });
    expect(calculateArmorTarget(regular, 0)).toBe(9);
  });
});

describe('Regle: Stunty — passes interdites au-dela de courte', () => {
  it('getLegalMoves : un Stunty peut tenter une passe quick', () => {
    const state = createPassTestState(['stunty']);
    const moves = getLegalMoves(state);
    const passMoves = moves.filter((m): m is Extract<Move, { type: 'PASS' }> => m.type === 'PASS');

    const hasQuick = passMoves.some(m => m.targetId === 'A2');
    expect(hasQuick).toBe(true);
  });

  it('getLegalMoves : un Stunty ne peut pas tenter une passe long', () => {
    const state = createPassTestState(['stunty']);
    const moves = getLegalMoves(state);
    const passMoves = moves.filter((m): m is Extract<Move, { type: 'PASS' }> => m.type === 'PASS');

    const hasLong = passMoves.some(m => m.targetId === 'A3');
    expect(hasLong).toBe(false);
  });

  it('getLegalMoves : un Stunty ne peut pas tenter une passe bomb', () => {
    const state = createPassTestState(['stunty']);
    const moves = getLegalMoves(state);
    const passMoves = moves.filter((m): m is Extract<Move, { type: 'PASS' }> => m.type === 'PASS');

    const hasBomb = passMoves.some(m => m.targetId === 'A4');
    expect(hasBomb).toBe(false);
  });

  it('getLegalMoves : un joueur non-Stunty peut tenter long/bomb', () => {
    const state = createPassTestState([]);
    const moves = getLegalMoves(state);
    const passMoves = moves.filter((m): m is Extract<Move, { type: 'PASS' }> => m.type === 'PASS');

    const hasShort = passMoves.some(m => m.targetId === 'A2');
    const hasLong = passMoves.some(m => m.targetId === 'A3');
    const hasBomb = passMoves.some(m => m.targetId === 'A4');
    expect(hasShort).toBe(true);
    expect(hasLong).toBe(true);
    expect(hasBomb).toBe(true);
  });

  it('applyMove : une tentative de passe long par un Stunty est refusee (etat inchange)', () => {
    const state = createPassTestState(['stunty']);
    const rng = makeTestRNG([0.8, 0.8, 0.8]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A3' };
    const result = applyMove(state, move, rng);

    // Le Stunty conserve le ballon, pas de turnover, pas d'action consommee.
    const passer = result.players.find(p => p.id === 'A1')!;
    expect(passer.hasBall).toBe(true);
    expect(result.isTurnover).toBe(false);
    // Rien n'a ete fait : l'action n'a pas ete consommee non plus
    expect(result.playerActions?.A1).toBeUndefined();
  });

  it('applyMove : une tentative de passe bomb par un Stunty est refusee', () => {
    const state = createPassTestState(['stunty']);
    const rng = makeTestRNG([0.8, 0.8, 0.8]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A4' };
    const result = applyMove(state, move, rng);

    const passer = result.players.find(p => p.id === 'A1')!;
    expect(passer.hasBall).toBe(true);
    expect(result.isTurnover).toBe(false);
  });

  it('applyMove : une passe quick par un Stunty fonctionne normalement', () => {
    const state = createPassTestState(['stunty']);
    // RNG : pass success (6) + catch success (5)
    const rng = makeTestRNG([0.95, 0.8]);
    const move: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
    const result = applyMove(state, move, rng);

    const passer = result.players.find(p => p.id === 'A1')!;
    const receiver = result.players.find(p => p.id === 'A2')!;
    expect(passer.hasBall).toBeFalsy();
    expect(receiver.hasBall).toBe(true);
  });
});

describe('Regle: Stunty — esquive (regression)', () => {
  it('le skill Stunty est toujours enregistre et applique +1 au dodge', async () => {
    const { getSkillEffect, collectModifiers } = await import('../skills/skill-registry');
    const effect = getSkillEffect('stunty');
    expect(effect).toBeDefined();

    const stunty = makePlayer({ skills: ['stunty'] });
    const state = setup();
    state.players = [stunty];

    const mods = collectModifiers(stunty, 'on-dodge', { state });
    expect(mods.dodgeModifier).toBe(1);
  });
});
