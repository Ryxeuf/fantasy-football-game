import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  resolveBlockResult,
  makeRNG,
  setPlayerAction,
  type GameState,
} from '../index';
import { isJuggernautActive, shouldConvertBothDownToPushBack } from './juggernaut';

/**
 * Juggernaut (BB2020 / BB3 rules):
 * - When this player performs a Blitz action, during the Block step:
 *   - Apply a Both Down result as if a Push Back result had been rolled instead.
 *   - Cancel the effect of Fend and Stand Firm on the opposing player for this
 *     block step.
 * - Outside of a Blitz action (e.g. a standard Block action), Juggernaut has
 *   no effect.
 */

function makeBlockResult(attackerId: string, targetId: string, result: string) {
  return {
    type: 'block' as const,
    playerId: attackerId,
    targetId: targetId,
    diceRoll: 2,
    result: result as 'BOTH_DOWN',
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

function placePlayers(
  base: GameState,
  attackerSkills: string[],
  defenderSkills: string[],
): GameState {
  return {
    ...base,
    players: base.players.map(p => {
      if (p.id === 'A2') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 6, skills: attackerSkills };
      if (p.id === 'B2') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: defenderSkills };
      // Move everyone else away to avoid interference.
      if (p.team === 'B' && p.id !== 'B2') return { ...p, pos: { x: 24, y: 13 } };
      if (p.team === 'A' && p.id !== 'A2') return { ...p, pos: { x: 1, y: 1 } };
      return p;
    }),
  };
}

describe('Regle: Juggernaut — activation (isJuggernautActive)', () => {
  let state: GameState;

  beforeEach(() => {
    state = setup();
  });

  it("retourne true si le joueur a juggernaut ET l'action est BLITZ", () => {
    const testState = setPlayerAction(placePlayers(state, ['juggernaut'], []), 'A2', 'BLITZ');
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(isJuggernautActive(testState, attacker)).toBe(true);
  });

  it("retourne false si le joueur n'a pas juggernaut", () => {
    const testState = setPlayerAction(placePlayers(state, [], []), 'A2', 'BLITZ');
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(isJuggernautActive(testState, attacker)).toBe(false);
  });

  it("retourne false si le joueur a juggernaut mais l'action est BLOCK", () => {
    const testState = setPlayerAction(placePlayers(state, ['juggernaut'], []), 'A2', 'BLOCK');
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(isJuggernautActive(testState, attacker)).toBe(false);
  });

  it("retourne false si aucune action n'a ete enregistree", () => {
    const testState = placePlayers(state, ['juggernaut'], []);
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(isJuggernautActive(testState, attacker)).toBe(false);
  });
});

describe('Regle: Juggernaut — conversion BOTH_DOWN (shouldConvertBothDownToPushBack)', () => {
  let state: GameState;

  beforeEach(() => {
    state = setup();
  });

  it('convertit si juggernaut actif et pas de Block', () => {
    const testState = setPlayerAction(placePlayers(state, ['juggernaut'], []), 'A2', 'BLITZ');
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(shouldConvertBothDownToPushBack(testState, attacker)).toBe(true);
  });

  it("ne convertit pas si l'attaquant a aussi Block (Block donne un meilleur resultat)", () => {
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut', 'block'], []),
      'A2',
      'BLITZ',
    );
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(shouldConvertBothDownToPushBack(testState, attacker)).toBe(false);
  });

  it('ne convertit pas si ce n\'est pas un Blitz', () => {
    const testState = setPlayerAction(placePlayers(state, ['juggernaut'], []), 'A2', 'BLOCK');
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(shouldConvertBothDownToPushBack(testState, attacker)).toBe(false);
  });

  it("ne convertit pas si le joueur n'a pas juggernaut", () => {
    const testState = setPlayerAction(placePlayers(state, [], []), 'A2', 'BLITZ');
    const attacker = testState.players.find(p => p.id === 'A2')!;
    expect(shouldConvertBothDownToPushBack(testState, attacker)).toBe(false);
  });
});

describe('Regle: Juggernaut — integration BOTH_DOWN lors d\'un Blitz', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('juggernaut-seed');
  });

  it("BOTH_DOWN est converti en PUSH_BACK : aucun joueur n'est a terre, pas de turnover", () => {
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut'], []),
      'A2',
      'BLITZ',
    );
    const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

    const result = resolveBlockResult(testState, blockResult, rng);

    const attacker = result.players.find(p => p.id === 'A2')!;
    const defender = result.players.find(p => p.id === 'B2')!;

    expect(attacker.stunned).toBeFalsy();
    expect(defender.stunned).toBeFalsy();
    expect(result.isTurnover).toBe(false);
  });

  it("BOTH_DOWN converti : le defenseur est repousse (sa position change ou une direction est en attente)", () => {
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut'], []),
      'A2',
      'BLITZ',
    );
    const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

    const result = resolveBlockResult(testState, blockResult, rng);
    const defender = result.players.find(p => p.id === 'B2')!;

    // Soit le defenseur a bouge (poussee directe), soit un choix de direction est en attente
    const wasMoved = defender.pos.x !== 11 || defender.pos.y !== 7;
    expect(wasMoved || result.pendingPushChoice !== undefined).toBe(true);
  });

  it("aucun jet d'armure n'est lance (Push Back n'en declenche pas)", () => {
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut'], []),
      'A2',
      'BLITZ',
    );
    const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

    const result = resolveBlockResult(testState, blockResult, rng);
    const armorLogs = result.gameLog.filter(
      log => log.type === 'dice' && log.message.includes("Jet d'armure"),
    );
    expect(armorLogs).toHaveLength(0);
  });

  it("un log annonce l'utilisation de Juggernaut", () => {
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut'], []),
      'A2',
      'BLITZ',
    );
    const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

    const result = resolveBlockResult(testState, blockResult, rng);
    const juggernautLog = result.gameLog.find(log =>
      log.message.toLowerCase().includes('juggernaut'),
    );
    expect(juggernautLog).toBeDefined();
  });
});

describe('Regle: Juggernaut — integration BOTH_DOWN hors Blitz', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('juggernaut-seed');
  });

  it("ne s'active pas lors d'un BLOCK standard : les deux joueurs tombent normalement", () => {
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut'], []),
      'A2',
      'BLOCK',
    );
    const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

    const result = resolveBlockResult(testState, blockResult, rng);

    const attacker = result.players.find(p => p.id === 'A2')!;
    const defender = result.players.find(p => p.id === 'B2')!;

    expect(attacker.stunned).toBe(true);
    expect(defender.stunned).toBe(true);
    expect(result.isTurnover).toBe(true);
  });
});

describe('Regle: Juggernaut — interactions avec Block et Wrestle', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('juggernaut-seed');
  });

  it("si l'attaquant a Block + juggernaut : Block prevaut (defenseur tombe, attaquant debout)", () => {
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut', 'block'], []),
      'A2',
      'BLITZ',
    );
    const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

    const result = resolveBlockResult(testState, blockResult, rng);

    const attacker = result.players.find(p => p.id === 'A2')!;
    const defender = result.players.find(p => p.id === 'B2')!;

    expect(attacker.stunned).toBeFalsy();
    expect(defender.stunned).toBe(true);
    expect(result.isTurnover).toBe(false);
  });

  it('si le defenseur a Wrestle : Juggernaut prevaut (conversion en Push Back) — le Blitz continue', () => {
    // Per BB2020 rules, Juggernaut converts the Both Down result itself, so
    // Wrestle (which requires a Both Down result) no longer applies.
    const testState = setPlayerAction(
      placePlayers(state, ['juggernaut'], ['wrestle']),
      'A2',
      'BLITZ',
    );
    const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

    const result = resolveBlockResult(testState, blockResult, rng);

    const attacker = result.players.find(p => p.id === 'A2')!;

    expect(attacker.stunned).toBeFalsy();
    expect(result.isTurnover).toBe(false);
  });
});
