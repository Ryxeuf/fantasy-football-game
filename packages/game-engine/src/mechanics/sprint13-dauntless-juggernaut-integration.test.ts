/**
 * TEST-2b (Sprint 13) — Integration tests: Dauntless + Juggernaut
 *
 * Tests these skills through the full game flow (resolveBlockResult, applyMove)
 * with real roster player configurations from the 5 priority teams.
 *
 * Dauntless: D6 + base ST roll to equalize strength when underdog
 * Juggernaut: BOTH_DOWN → PUSH_BACK on Blitz, annuls Wrestle/Fend/Stand Firm
 */

import { describe, it, expect } from 'vitest';
import {
  setup,
  applyMove,
  resolveBlockResult,
  getSkillEffect,
} from '../index';
import {
  isJuggernautActiveForBlock,
  shouldConvertBothDownToPushBack,
} from './juggernaut';
import { checkDauntless } from './dauntless';
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

function makeBlockResult(
  attackerId: string,
  targetId: string,
  result: 'BOTH_DOWN' | 'PUSH_BACK' | 'POW' | 'STUMBLE' | 'PLAYER_DOWN',
): BlockDiceResult {
  return {
    type: 'block',
    playerId: attackerId,
    targetId: targetId,
    diceRoll: 1,
    result,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

// ── Roster-accurate player factories ─────────────────────────────────────

function makeTrollSlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'TS1',
    team: 'A',
    pos: { x: 5, y: 7 },
    name: 'Troll Slayer',
    number: 11,
    position: 'Troll Slayer',
    ma: 5, st: 3, ag: 4, pa: 6, av: 9,
    skills: ['block', 'dauntless', 'frenzy', 'thick-skull'],
    pm: 5,
    state: 'active',
    ...overrides,
  };
}

function makeDeathroller(overrides: Partial<Player> = {}): Player {
  return {
    id: 'DR1',
    team: 'A',
    pos: { x: 6, y: 7 },
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

function makeSaurusWarrior(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SW1',
    team: 'B',
    pos: { x: 7, y: 7 },
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

function makeKroxigor(overrides: Partial<Player> = {}): Player {
  return {
    id: 'KR1',
    team: 'B',
    pos: { x: 8, y: 7 },
    name: 'Kroxigor',
    number: 16,
    position: 'Kroxigor',
    ma: 6, st: 5, ag: 5, pa: 6, av: 10,
    skills: ['bone-head', 'loner-4', 'mighty-blow-1', 'prehensile-tail', 'thick-skull'],
    pm: 6,
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
    pos: { x: 10, y: 7 },
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

function makeStormvermin(overrides: Partial<Player> = {}): Player {
  return {
    id: 'SV1',
    team: 'B',
    pos: { x: 9, y: 7 },
    name: 'Stormvermin',
    number: 3,
    position: 'Blitzer',
    ma: 7, st: 3, ag: 3, pa: 5, av: 9,
    skills: ['block'],
    pm: 7,
    state: 'active',
    ...overrides,
  };
}

// ── Dauntless: full block resolution via applyMove ──────────────────────

describe('Integration: Dauntless dans le flow de blocage complet', () => {
  it('Troll Slayer (ST3, dauntless) vs Kroxigor (ST5) — Dauntless reussi, bloque a 1 de', () => {
    const slayer = makeTrollSlayer({ id: 'A1', pos: { x: 5, y: 7 } });
    const krox = makeKroxigor({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([slayer, krox]);

    // Dauntless roll: D6=6 (rng 0.95). 3+6=9 >= 5 → succes, force egalisee
    // Block dice ensuite (resultat POW → push)
    const rng = makeTestRNG([0.95, 0.5]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    // Force egalisee → 1 de, attaquant choisit → pas de pendingBlock
    expect(result.playerActions?.A1).toBe('BLOCK');
    expect(result.pendingBlock).toBeUndefined();
  });

  it('Troll Slayer (ST3, dauntless) vs Kroxigor (ST5) — Dauntless echoue, 2 des defenseur choisit', () => {
    const slayer = makeTrollSlayer({ id: 'A1', pos: { x: 5, y: 7 } });
    const krox = makeKroxigor({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([slayer, krox]);

    // Dauntless roll: D6=1 (rng 0.0). 3+1=4 < 5 → echec
    const rng = makeTestRNG([0.0, 0.1, 0.3]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    // Echec → multi-dice, defenseur choisit
    expect(result.pendingBlock).toBeDefined();
    expect(result.pendingBlock?.chooser).toBe('defender');
  });

  it('Troll Slayer (ST3, dauntless) vs Saurus (ST4) — Dauntless reussi avec D6=1+ST3=4>=4', () => {
    const slayer = makeTrollSlayer({ id: 'A1', pos: { x: 5, y: 7 } });
    const saurus = makeSaurusWarrior({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([slayer, saurus]);

    // Dauntless: D6=1 (rng 0.0). 3+1=4 >= 4 → succes (juste)
    const rng = makeTestRNG([0.0, 0.5]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    // Force egalisee → 1 de attaquant choisit
    expect(result.pendingBlock).toBeUndefined();
  });

  it('Dauntless ne declenche pas quand attaquant ST >= defenseur ST', () => {
    const slayer = makeTrollSlayer({ id: 'A1', pos: { x: 5, y: 7 } });
    const runner = makeGutterRunner({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([slayer, runner]);

    // Slayer ST3 vs Gutter Runner ST2 → pas de Dauntless, 2 des attaquant choisit
    const rng = makeTestRNG([0.5, 0.3]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    // 2 des attaquant choisit
    expect(result.pendingBlock).toBeDefined();
    expect(result.pendingBlock?.chooser).toBe('attacker');
  });

  it('Dauntless log apparait dans gameLog quand il se declenche', () => {
    const slayer = makeTrollSlayer({ id: 'A1', pos: { x: 5, y: 7 } });
    const krox = makeKroxigor({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([slayer, krox]);

    const rng = makeTestRNG([0.95, 0.5]);
    const move: Move = { type: 'BLOCK', playerId: 'A1', targetId: 'B1' };
    const result = applyMove(state, move, rng);

    const dauntlessLog = result.gameLog.find(
      log => log.message.includes('Intrépide'),
    );
    expect(dauntlessLog).toBeDefined();
  });
});

// ── Dauntless: checkDauntless unit integration with roster players ───────

describe('Integration: Dauntless — checkDauntless avec joueurs roster', () => {
  it('Troll Slayer vs Kroxigor : utilise ST de base (3) pas les assists', () => {
    const slayer = makeTrollSlayer();
    const krox = makeKroxigor();
    const state = makeState([slayer, krox]);

    // Attaquant total=3, defenseur total=6 (ST5+1 assist)
    // Dauntless: D6=3 (rng 0.4). 3+3=6 >= 6 → succes
    const rng = makeTestRNG([0.4]);
    const result = checkDauntless(state, slayer, krox, 3, 6, rng);

    expect(result.triggered).toBe(true);
    expect(result.success).toBe(true);
    expect(result.diceRoll).toBe(3);
    expect(result.newAttackerStrength).toBe(6);
  });

  it('Dwarf Blocker SANS dauntless vs Saurus : ne declenche pas', () => {
    const blocker = makeDwarfBlocker();
    const saurus = makeSaurusWarrior();
    const state = makeState([blocker, saurus]);

    const rng = makeTestRNG([0.95]);
    const result = checkDauntless(state, blocker, saurus, 3, 4, rng);

    expect(result.triggered).toBe(false);
    expect(result.newAttackerStrength).toBe(3);
  });
});

// ── Juggernaut: full block resolution via resolveBlockResult ─────────────

describe('Integration: Juggernaut dans la chaine de blocage avec Deathroller', () => {
  it('Deathroller en Blitz — BOTH_DOWN converti en PUSH_BACK (pas de chute)', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 5, y: 7 } });
    const saurus = makeSaurusWarrior({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([dr, saurus]);
    state.playerActions = { A1: 'BLITZ' };

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'BOTH_DOWN'),
      rng,
    );

    const drAfter = getPlayer(result, 'A1');
    expect(drAfter.stunned).toBeFalsy();
    expect(result.isTurnover).toBe(false);
  });

  it('Deathroller en Blitz — Juggernaut log present', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 5, y: 7 } });
    const saurus = makeSaurusWarrior({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([dr, saurus]);
    state.playerActions = { A1: 'BLITZ' };

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'BOTH_DOWN'),
      rng,
    );

    const jugLog = result.gameLog.find(
      log => log.message.toLowerCase().includes('juggernaut'),
    );
    expect(jugLog).toBeDefined();
  });

  it('Deathroller en Block normal — BOTH_DOWN reste BOTH_DOWN (pas de conversion)', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 5, y: 7 } });
    const saurus = makeSaurusWarrior({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([dr, saurus]);
    // Pas de BLITZ dans playerActions → block normal

    const rng = makeTestRNG([die(3), die(4), die(2), die(3)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'BOTH_DOWN'),
      rng,
    );

    // Block normal + deathroller n'a pas Block → les deux tombent
    const drAfter = getPlayer(result, 'A1');
    expect(drAfter.stunned).toBe(true);
    expect(result.isTurnover).toBe(true);
  });

  it('Deathroller en Blitz — POW reste POW (Juggernaut ne modifie que BOTH_DOWN)', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 5, y: 7 } });
    const saurus = makeSaurusWarrior({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([dr, saurus]);
    state.playerActions = { A1: 'BLITZ' };

    const rng = makeTestRNG([die(6), die(6), die(5), die(5)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'POW'),
      rng,
    );

    const saurusAfter = getPlayer(result, 'B1');
    expect(saurusAfter.stunned).toBe(true);
  });
});

// ── Juggernaut: annulation Wrestle/Fend/Stand Firm ──────────────────────

describe('Integration: Juggernaut annule Wrestle du defenseur en Blitz', () => {
  it('Deathroller Blitz vs Stormvermin avec Wrestle — Wrestle ignore', () => {
    const dr = makeDeathroller({ id: 'A1', pos: { x: 5, y: 7 } });
    const storm = makeStormvermin({
      id: 'B1', pos: { x: 6, y: 7 },
      skills: ['block', 'wrestle'],
    });
    const state = makeState([dr, storm]);
    state.playerActions = { A1: 'BLITZ' };

    const rng = makeTestRNG([die(3), die(4)]);
    const result = resolveBlockResult(
      state,
      makeBlockResult('A1', 'B1', 'BOTH_DOWN'),
      rng,
    );

    // Juggernaut convertit en PUSH_BACK, Wrestle du defenseur ignore
    const drAfter = getPlayer(result, 'A1');
    expect(drAfter.stunned).toBeFalsy();
    expect(result.isTurnover).toBe(false);
  });
});

// ── Juggernaut: predicats avec joueurs roster ────────────────────────────

describe('Integration: Juggernaut predicats avec Deathroller roster', () => {
  it('isJuggernautActiveForBlock — vrai en Blitz', () => {
    const dr = makeDeathroller({ id: 'A1' });
    const state = makeState([dr]);
    state.playerActions = { A1: 'BLITZ' };

    expect(isJuggernautActiveForBlock(state, getPlayer(state, 'A1'))).toBe(true);
  });

  it('isJuggernautActiveForBlock — faux en Block normal', () => {
    const dr = makeDeathroller({ id: 'A1' });
    const state = makeState([dr]);
    state.playerActions = { A1: 'BLOCK' };

    expect(isJuggernautActiveForBlock(state, getPlayer(state, 'A1'))).toBe(false);
  });

  it('shouldConvertBothDownToPushBack — vrai (Deathroller n\'a pas Block)', () => {
    const dr = makeDeathroller({ id: 'A1' });
    const state = makeState([dr]);
    state.playerActions = { A1: 'BLITZ' };

    expect(shouldConvertBothDownToPushBack(state, getPlayer(state, 'A1'))).toBe(true);
  });

  it('shouldConvertBothDownToPushBack — faux si Block ajoute (ex: progression)', () => {
    const dr = makeDeathroller({
      id: 'A1',
      skills: [...makeDeathroller().skills, 'block'],
    });
    const state = makeState([dr]);
    state.playerActions = { A1: 'BLITZ' };

    expect(shouldConvertBothDownToPushBack(state, getPlayer(state, 'A1'))).toBe(false);
  });

  it('Dwarf Blocker SANS juggernaut — isJuggernautActiveForBlock faux meme en Blitz', () => {
    const blocker = makeDwarfBlocker({ id: 'A1' });
    const state = makeState([blocker]);
    state.playerActions = { A1: 'BLITZ' };

    expect(isJuggernautActiveForBlock(state, getPlayer(state, 'A1'))).toBe(false);
  });
});

// ── Cross-skill: Dauntless + Juggernaut stacking ─────────────────────────

describe('Integration: Dauntless + Juggernaut stacking (scenario multi-skill)', () => {
  it('joueur avec dauntless+juggernaut en Blitz : les deux skills cooperent', () => {
    // Scenario hypothetique : joueur avec les deux skills blitz un big guy
    const blitzer: Player = {
      id: 'A1', team: 'A', pos: { x: 5, y: 7 },
      name: 'Custom Blitzer', number: 99, position: 'Blitzer',
      ma: 6, st: 3, ag: 3, pa: 5, av: 9,
      skills: ['dauntless', 'juggernaut'],
      pm: 6, state: 'active',
    };
    const bigGuy = makeKroxigor({ id: 'B1', pos: { x: 6, y: 7 } });
    const state = makeState([blitzer, bigGuy]);
    state.playerActions = { A1: 'BLITZ' };

    // checkDauntless: D6=6, 3+6=9 >= 5 → succes
    const rng = makeTestRNG([0.95]);
    const dauntlessResult = checkDauntless(state, blitzer, bigGuy, 3, 5, rng);
    expect(dauntlessResult.success).toBe(true);

    // Juggernaut actif en Blitz
    expect(isJuggernautActiveForBlock(state, blitzer)).toBe(true);
    expect(shouldConvertBothDownToPushBack(state, blitzer)).toBe(true);
  });
});

// ── Skill registry verification ──────────────────────────────────────────

describe('Integration: Dauntless + Juggernaut enregistrement skill-registry', () => {
  it('dauntless est enregistre avec trigger on-block-attacker', () => {
    const effect = getSkillEffect('dauntless');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-block-attacker');
  });

  it('juggernaut est enregistre avec trigger on-block-attacker', () => {
    const effect = getSkillEffect('juggernaut');
    expect(effect).toBeDefined();
    expect(effect!.triggers).toContain('on-block-attacker');
  });

  it('Troll Slayer roster contient dauntless', () => {
    const slayer = makeTrollSlayer();
    expect(slayer.skills).toContain('dauntless');
  });

  it('Deathroller roster contient juggernaut', () => {
    const dr = makeDeathroller();
    expect(dr.skills).toContain('juggernaut');
  });
});
