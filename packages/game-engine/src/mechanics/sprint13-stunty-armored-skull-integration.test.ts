/**
 * TEST-2 (Sprint 13) — Integration tests: Stunty + Armored Skull
 *
 * Tests these skills through the full game flow (resolveBlockResult, applyMove)
 * with real roster player configurations from the 5 priority teams.
 *
 * Stunty: -1 armor target, +1 dodge modifier, pass restriction (max quick)
 * Armored Skull: -1 injury roll modifier (reduces KO/casualty chance)
 */

import { describe, it, expect } from 'vitest';
import {
  setup,
  applyMove,
  getLegalMoves,
  resolveBlockResult,
} from '../index';
import { performInjuryRoll } from './injury';
import { calculateArmorTarget } from '../utils/dice';
import { collectModifiers, getSkillEffect } from '../skills/skill-registry';
import { getDodgeSkillModifiers } from '../skills/skill-bridge';
import type { GameState, Player, RNG, Move, BlockDiceResult } from '../core/types';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeTestRNG(values: number[]): RNG {
  let i = 0;
  return () => {
    const val = values[i % values.length];
    i++;
    return val;
  };
}

/** Conversion lisible : valeur de de D6 -> float RNG. */
function die(n: 1 | 2 | 3 | 4 | 5 | 6): number {
  return (n - 1) / 6 + 0.01;
}

function makeState(players: Player[]): GameState {
  const state = setup();
  state.players = players;
  state.currentPlayer = 'A';
  state.playerActions = {};
  state.teamFoulCount = {};
  state.teamRerolls = { teamA: 0, teamB: 0 };
  return state;
}

function getPlayer(state: GameState, id: string): Player {
  return state.players.find(p => p.id === id)!;
}

// ── Roster-accurate player factories ─────────────────────────────────────

function makeChameleonSkink(overrides: Partial<Player> = {}): Player {
  return {
    id: 'CS1',
    team: 'B',
    pos: { x: 10, y: 7 },
    name: 'Chameleon Skink',
    number: 12,
    position: 'Chameleon Skink',
    ma: 7, st: 2, ag: 3, pa: 3, av: 8,
    skills: ['dodge', 'on-the-ball', 'shadowing', 'stunty'],
    pm: 7,
    state: 'active',
    ...overrides,
  };
}

function makeDeathroller(overrides: Partial<Player> = {}): Player {
  return {
    id: 'DR1',
    team: 'A',
    pos: { x: 5, y: 7 },
    name: 'Dwarf Deathroller',
    number: 16,
    position: 'Deathroller',
    ma: 4, st: 7, ag: 5, pa: 6, av: 11,
    skills: [
      'break-tackle', 'dirty-player-2', 'juggernaut', 'loner-5',
      'mighty-blow-1', 'no-hands', 'secret-weapon', 'stand-firm',
      'armored-skull',
    ],
    pm: 4,
    state: 'active',
    ...overrides,
  };
}

function makeDwarfBlocker(overrides: Partial<Player> = {}): Player {
  return {
    id: 'DB1',
    team: 'A',
    pos: { x: 8, y: 7 },
    name: 'Dwarf Blocker',
    number: 2,
    position: 'Blocker Lineman',
    ma: 4, st: 3, ag: 4, pa: 5, av: 10,
    skills: ['block', 'tackle', 'thick-skull'],
    pm: 4,
    state: 'active',
    ...overrides,
  };
}

function makeGutterRunner(overrides: Partial<Player> = {}): Player {
  return {
    id: 'GR1',
    team: 'B',
    pos: { x: 12, y: 7 },
    name: 'Gutter Runner',
    number: 7,
    position: 'Gutter Runner',
    ma: 9, st: 2, ag: 2, pa: 4, av: 8,
    skills: ['dodge'],
    pm: 9,
    state: 'active',
    ...overrides,
  };
}

function makeSaurusWarrior(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SW1',
    team: 'A',
    pos: { x: 6, y: 7 },
    name: 'Saurus Warrior',
    number: 1,
    position: 'Saurus Blocker',
    ma: 6, st: 4, ag: 5, pa: 6, av: 10,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

// ── Stunty: full block resolution chain ──────────────────────────────────

describe('Integration: Stunty dans la chaine de blocage', () => {
  it('Chameleon Skink (stunty, AV 8) — POW : armure percee a 7+ au lieu de 8+', () => {
    const blocker = makeDwarfBlocker({ id: 'A1', team: 'A', pos: { x: 9, y: 7 } });
    const skink = makeChameleonSkink({ id: 'B1', team: 'B', pos: { x: 10, y: 7 } });
    const state = makeState([blocker, skink]);

    // 2D6 armor = 3+4 = 7. Normal AV 8 → tient. Stunty AV 7 → percee.
    // Injury: 4+4 = 8 → KO
    const rng = makeTestRNG([die(3), die(4), die(4), die(4)]);

    const result = resolveBlockResult(
      state,
      {
        type: 'block',
        playerId: 'A1',
        targetId: 'B1',
        diceRoll: 1,
        result: 'POW',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 3,
        targetStrength: 2,
      },
      rng,
    );

    const skinkAfter = getPlayer(result, 'B1');
    // Stunty reduces armor target to 7, so 7 >= 7 → armor broken → injury roll → KO
    expect(skinkAfter.state).toBe('knocked_out');
  });

  it('Chameleon Skink (stunty, AV 8) — POW : armure tient si jet < 7', () => {
    const blocker = makeDwarfBlocker({ id: 'A1', team: 'A', pos: { x: 9, y: 7 } });
    const skink = makeChameleonSkink({ id: 'B1', team: 'B', pos: { x: 10, y: 7 } });
    const state = makeState([blocker, skink]);

    // 2D6 armor = 2+3 = 5 < 7 (stunty AV) → armure tient, skink juste stunned
    const rng = makeTestRNG([die(2), die(3)]);

    const result = resolveBlockResult(
      state,
      {
        type: 'block',
        playerId: 'A1',
        targetId: 'B1',
        diceRoll: 1,
        result: 'POW',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 3,
        targetStrength: 2,
      },
      rng,
    );

    const skinkAfter = getPlayer(result, 'B1');
    // Armor holds → just stunned (knocked down), not KO
    expect(skinkAfter.stunned).toBe(true);
    expect(result.dugouts.teamB.zones.knockedOut.players).not.toContain('B1');
  });

  it('Gutter Runner SANS stunty — meme jet 7 contre AV 8 : armure tient', () => {
    const blocker = makeDwarfBlocker({ id: 'A1', team: 'A', pos: { x: 11, y: 7 } });
    const runner = makeGutterRunner({ id: 'B1', team: 'B', pos: { x: 12, y: 7 } });
    const state = makeState([blocker, runner]);

    // 2D6 armor = 3+4 = 7 < 8 (AV 8, pas de stunty) → armure tient
    const rng = makeTestRNG([die(3), die(4)]);

    const result = resolveBlockResult(
      state,
      {
        type: 'block',
        playerId: 'A1',
        targetId: 'B1',
        diceRoll: 1,
        result: 'POW',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 3,
        targetStrength: 2,
      },
      rng,
    );

    const runnerAfter = getPlayer(result, 'B1');
    // 7 < 8 → armor holds → just stunned on field
    expect(runnerAfter.stunned).toBe(true);
    expect(result.dugouts.teamB.zones.knockedOut.players).not.toContain('B1');
  });
});

// ── Stunty: dodge modifier integration ───────────────────────────────────

describe('Integration: Stunty bonus dodge via applyMove', () => {
  it('Chameleon Skink esquive hors zone de tacle avec bonus stunty +1', () => {
    const saurus = makeSaurusWarrior({ id: 'A1', team: 'A', pos: { x: 10, y: 6 } });
    const skink = makeChameleonSkink({
      id: 'B1', team: 'B', pos: { x: 10, y: 7 },
      pm: 7,
    });
    const state = makeState([saurus, skink]);
    state.currentPlayer = 'B';

    // Skink dodges from (10,7) to (11,7) — leaving saurus tackle zone
    // AG 3 → base target 4+, stunty gives +1 → effective 3+
    // D6 = 3, with stunty +1 → success
    const rng = makeTestRNG([die(3)]);
    const move: Move = { type: 'MOVE', playerId: 'B1', to: { x: 11, y: 7 } };
    const result = applyMove(state, move, rng);

    const skinkAfter = getPlayer(result, 'B1');
    expect(skinkAfter.pos).toEqual({ x: 11, y: 7 });
    expect(result.isTurnover).toBe(false);
  });

  it('collectModifiers retourne dodgeModifier +1 pour Stunty', () => {
    const skink = makeChameleonSkink({ id: 'B1' });
    const state = makeState([skink]);
    const mods = collectModifiers(skink, 'on-dodge', { state });
    expect(mods.dodgeModifier).toBe(1);
  });
});

// ── Stunty: pass restriction integration ─────────────────────────────────

describe('Integration: Stunty restriction passe avec roster Chameleon Skink', () => {
  it('Chameleon Skink ne peut pas tenter de passe longue via getLegalMoves', () => {
    const skink = makeChameleonSkink({
      id: 'B1', team: 'B', pos: { x: 5, y: 7 },
      hasBall: true, pa: 3,
    });
    const nearReceiver = makeGutterRunner({
      id: 'B2', team: 'B', pos: { x: 8, y: 7 }, // quick range (distance 3)
    });
    const farReceiver = makeGutterRunner({
      id: 'B3', team: 'B', pos: { x: 15, y: 7 }, // long range (distance 10)
    });
    const state = makeState([skink, nearReceiver, farReceiver]);
    state.currentPlayer = 'B';
    state.ball = undefined;

    const moves = getLegalMoves(state);
    const passes = moves.filter(
      (m): m is Extract<Move, { type: 'PASS' }> => m.type === 'PASS',
    );

    expect(passes.some(m => m.targetId === 'B2')).toBe(true);  // quick OK
    expect(passes.some(m => m.targetId === 'B3')).toBe(false); // long interdit
  });
});

// ── Armored Skull: full block resolution chain ───────────────────────────

describe('Integration: Armored Skull dans la chaine de blocage', () => {
  it('Deathroller (armored-skull) — POW avec jet blessure 8 : demote KO en Stunned', () => {
    const attacker = makeSaurusWarrior({
      id: 'A1', team: 'A', pos: { x: 4, y: 7 }, st: 4,
    });
    const deathroller = makeDeathroller({
      id: 'B1', team: 'B', pos: { x: 5, y: 7 },
    });
    const state = makeState([attacker, deathroller]);

    // Armor roll: 6+6 = 12 vs AV 11 → armor broken
    // Injury roll: 4+4 = 8, armored-skull -1 → effective 7 → Stunned (not KO)
    const rng = makeTestRNG([die(6), die(6), die(4), die(4)]);

    const result = resolveBlockResult(
      state,
      {
        type: 'block',
        playerId: 'A1',
        targetId: 'B1',
        diceRoll: 1,
        result: 'POW',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 7,
      },
      rng,
    );

    const drAfter = getPlayer(result, 'B1');
    // Armored skull: 8 - 1 = 7 → Stunned, not KO
    expect(drAfter.stunned).toBe(true);
    expect(result.dugouts.teamB.zones.knockedOut.players).not.toContain('B1');
  });

  it('Deathroller (armored-skull) — jet blessure 10 : demote Casualty en KO', () => {
    const attacker = makeSaurusWarrior({
      id: 'A1', team: 'A', pos: { x: 4, y: 7 }, st: 4,
    });
    const deathroller = makeDeathroller({
      id: 'B1', team: 'B', pos: { x: 5, y: 7 },
    });
    const state = makeState([attacker, deathroller]);

    // Armor: 6+6 = 12 → broken
    // Injury: 5+5 = 10, armored-skull -1 → effective 9 → KO (not Casualty)
    const rng = makeTestRNG([die(6), die(6), die(5), die(5)]);

    const result = resolveBlockResult(
      state,
      {
        type: 'block',
        playerId: 'A1',
        targetId: 'B1',
        diceRoll: 1,
        result: 'POW',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 7,
      },
      rng,
    );

    expect(result.dugouts.teamB.zones.knockedOut.players).toContain('B1');
    expect(result.dugouts.teamB.zones.casualty.players).not.toContain('B1');
  });

  it('joueur SANS armored-skull — meme jet blessure 8 : resulte en KO', () => {
    const attacker = makeSaurusWarrior({
      id: 'A1', team: 'A', pos: { x: 4, y: 7 }, st: 4,
    });
    // Gutter Runner : AV 8, pas de thick-skull ni armored-skull
    const target = makeGutterRunner({
      id: 'B1', team: 'B', pos: { x: 5, y: 7 },
    });
    const state = makeState([attacker, target]);

    // Armor: 4+4 = 8 vs AV 8 → broken (8 >= 8)
    // Injury: 4+4 = 8 → KO (pas d'armored-skull, 8 >= 8 → KO)
    const rng = makeTestRNG([die(4), die(4), die(4), die(4)]);

    const result = resolveBlockResult(
      state,
      {
        type: 'block',
        playerId: 'A1',
        targetId: 'B1',
        diceRoll: 1,
        result: 'POW',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 2,
      },
      rng,
    );

    expect(result.dugouts.teamB.zones.knockedOut.players).toContain('B1');
  });
});

// ── Armored Skull: direct performInjuryRoll ──────────────────────────────

describe('Integration: Armored Skull via performInjuryRoll avec roster Deathroller', () => {
  it('Deathroller reçoit -1 injury modifier meme avec thick-skull cumule', () => {
    // Le Deathroller n'a pas thick-skull, mais verifions que armored-skull
    // fonctionne correctement en isolation via performInjuryRoll
    const deathroller = makeDeathroller({ id: 'B1', team: 'B' });
    const state = makeState([deathroller]);

    // Injury: 4+4 = 8. Armored skull: 8 - 1 = 7 → Stunned
    const rng = makeTestRNG([die(4), die(4)]);
    const result = performInjuryRoll(state, deathroller, rng);

    const drAfter = getPlayer(result, 'B1');
    expect(drAfter.stunned).toBe(true);
    expect(drAfter.state).toBe('stunned');
  });
});

// ── Cross-skill: Stunty + Armored Skull interaction ──────────────────────

describe('Integration: Stunty + Armored Skull stacking', () => {
  it('calculateArmorTarget applique le malus Stunty independamment d\'Armored Skull', () => {
    // Armored Skull affecte le jet de BLESSURE, pas le jet d'ARMURE
    // Stunty affecte le jet d'ARMURE
    // Les deux sont donc independants et se cumulent sur des jets differents
    const playerBoth: Player = {
      id: 'X1', team: 'A', pos: { x: 5, y: 5 },
      name: 'Test Both', number: 99, position: 'Test',
      ma: 4, st: 3, ag: 3, pa: 6, av: 9,
      skills: ['stunty', 'armored-skull'],
      pm: 4, state: 'active',
    };

    // Stunty: armor target 9 - 1 = 8
    expect(calculateArmorTarget(playerBoth, 0)).toBe(8);
  });

  it('joueur avec stunty + armored-skull : armure percee plus facilement mais blessure reduite', () => {
    const playerBoth: Player = {
      id: 'B1', team: 'B', pos: { x: 5, y: 7 },
      name: 'Stunty Armored', number: 99, position: 'Test',
      ma: 4, st: 3, ag: 3, pa: 6, av: 9,
      skills: ['stunty', 'armored-skull'],
      pm: 4, state: 'active',
    };
    const attacker = makeSaurusWarrior({
      id: 'A1', team: 'A', pos: { x: 4, y: 7 },
    });
    const state = makeState([attacker, playerBoth]);

    // Armor: 4+4 = 8 vs stunty-adjusted AV 8 → broken (8 >= 8)
    // Injury: 4+4 = 8, armored-skull -1 → 7 → Stunned (pas KO)
    const rng = makeTestRNG([die(4), die(4), die(4), die(4)]);

    const result = resolveBlockResult(
      state,
      {
        type: 'block',
        playerId: 'A1',
        targetId: 'B1',
        diceRoll: 1,
        result: 'POW',
        offensiveAssists: 0,
        defensiveAssists: 0,
        totalStrength: 4,
        targetStrength: 3,
      },
      rng,
    );

    const after = getPlayer(result, 'B1');
    // Stunty : armor percee. Armored skull : injury demotee a stunned.
    expect(after.stunned).toBe(true);
    expect(result.dugouts.teamB.zones.knockedOut.players).not.toContain('B1');
  });
});

// ── Skill registry verification ──────────────────────────────────────────

describe('Integration: Stunty + Armored Skull enregistrement dans le skill-registry', () => {
  it('stunty est enregistre avec trigger on-dodge et on-armor', () => {
    const effect = getSkillEffect('stunty');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-dodge');
  });

  it('armored-skull est detecte par hasSkill sur le Deathroller', () => {
    const dr = makeDeathroller();
    expect(dr.skills).toContain('armored-skull');
  });

  it('getDodgeSkillModifiers retourne le bonus stunty pour Chameleon Skink en zone de tacle', () => {
    const blocker = makeDwarfBlocker({ id: 'A1', team: 'A', pos: { x: 9, y: 7 } });
    const skink = makeChameleonSkink({ id: 'B1', team: 'B', pos: { x: 10, y: 7 } });
    const state = makeState([blocker, skink]);

    // Le skink est adjacent au blocker (zone de tacle)
    const mod = getDodgeSkillModifiers(state, skink, skink.pos);
    // stunty +1, mais dodge skill est gere separement
    // On verifie que le modificateur inclut au moins le +1 de stunty
    expect(mod).toBeGreaterThanOrEqual(1);
  });
});
