import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  resolveBlockResult,
  makeRNG,
  type GameState,
  type Player,
} from '../index';
import { hasSkill } from '../skills/skill-effects';

/**
 * Wrestle (BB2020 rules):
 * - On BOTH_DOWN, if either player has Wrestle, both are placed Prone
 * - No armor roll for either player
 * - No turnover
 * - Wrestle overrides Block: even if the opponent has Block, both go down
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

describe('Regle: Wrestle', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('wrestle-test-seed');
  });

  function placePlayersForBlock(
    baseState: GameState,
    attackerSkills: string[],
    defenderSkills: string[],
  ): GameState {
    return {
      ...baseState,
      players: baseState.players.map(p => {
        if (p.id === 'A2') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 6, skills: attackerSkills };
        if (p.id === 'B2') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: defenderSkills };
        return p;
      }),
    };
  }

  describe('Attaquant a Wrestle, defenseur sans skill', () => {
    it('les deux joueurs tombent sur BOTH_DOWN', () => {
      const testState = placePlayersForBlock(state, ['Wrestle'], []);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;

      expect(attacker.stunned).toBe(true);
      expect(defender.stunned).toBe(true);
    });

    it('pas de turnover sur BOTH_DOWN', () => {
      const testState = placePlayersForBlock(state, ['Wrestle'], []);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      expect(result.isTurnover).toBe(false);
    });

    it('pas de jet d\'armure pour les deux joueurs', () => {
      const testState = placePlayersForBlock(state, ['Wrestle'], []);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const armorLogs = result.gameLog.filter(
        log => log.type === 'dice' && log.message.includes("Jet d'armure"),
      );
      expect(armorLogs).toHaveLength(0);
    });
  });

  describe('Defenseur a Wrestle, attaquant sans skill', () => {
    it('les deux joueurs tombent sur BOTH_DOWN', () => {
      const testState = placePlayersForBlock(state, [], ['Wrestle']);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;

      expect(attacker.stunned).toBe(true);
      expect(defender.stunned).toBe(true);
    });

    it('pas de turnover quand le defenseur a Wrestle', () => {
      const testState = placePlayersForBlock(state, [], ['Wrestle']);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      expect(result.isTurnover).toBe(false);
    });

    it('pas de jet d\'armure', () => {
      const testState = placePlayersForBlock(state, [], ['Wrestle']);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const armorLogs = result.gameLog.filter(
        log => log.type === 'dice' && log.message.includes("Jet d'armure"),
      );
      expect(armorLogs).toHaveLength(0);
    });
  });

  describe('Wrestle vs Block', () => {
    it('Wrestle override Block: les deux tombent meme si adversaire a Block', () => {
      // Attaquant a Wrestle, defenseur a Block
      const testState = placePlayersForBlock(state, ['Wrestle'], ['Block']);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;

      // Les deux tombent malgre le Block du defenseur
      expect(attacker.stunned).toBe(true);
      expect(defender.stunned).toBe(true);
      expect(result.isTurnover).toBe(false);
    });

    it('Wrestle override Block: defenseur a Wrestle, attaquant a Block', () => {
      // Attaquant a Block, defenseur a Wrestle
      const testState = placePlayersForBlock(state, ['Block'], ['Wrestle']);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;

      // Les deux tombent malgre le Block de l'attaquant
      expect(attacker.stunned).toBe(true);
      expect(defender.stunned).toBe(true);
      expect(result.isTurnover).toBe(false);
    });
  });

  describe('Les deux ont Wrestle', () => {
    it('les deux tombent, pas de turnover, pas de jet d\'armure', () => {
      const testState = placePlayersForBlock(state, ['Wrestle'], ['Wrestle']);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;

      expect(attacker.stunned).toBe(true);
      expect(defender.stunned).toBe(true);
      expect(result.isTurnover).toBe(false);

      const armorLogs = result.gameLog.filter(
        log => log.type === 'dice' && log.message.includes("Jet d'armure"),
      );
      expect(armorLogs).toHaveLength(0);
    });
  });

  describe('Porteur de balle et Wrestle', () => {
    it('l\'attaquant perd le ballon si il a Wrestle et tombe', () => {
      const testState = {
        ...placePlayersForBlock(state, ['Wrestle'], []),
        players: state.players.map(p => {
          if (p.id === 'A2') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 6, skills: ['Wrestle'], hasBall: true };
          if (p.id === 'B2') return { ...p, pos: { x: 11, y: 7 }, stunned: false, pm: 6, skills: [] };
          return p;
        }),
        ball: { x: 10, y: 7 },
      };
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      expect(attacker.hasBall).toBe(false);
    });
  });

  describe('Wrestle ne s\'applique PAS sur d\'autres resultats', () => {
    it('pas d\'effet Wrestle sur POW', () => {
      const testState = placePlayersForBlock(state, ['Wrestle'], []);
      const blockResult = makeBlockResult('A2', 'B2', 'POW');

      // POW should work normally - target is knocked down, no wrestle interaction
      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      expect(attacker.stunned).toBeFalsy();
    });

    it('pas d\'effet Wrestle sur PUSH_BACK', () => {
      const testState = placePlayersForBlock(state, ['Wrestle'], []);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;
      // Neither should be stunned from push back (target is just pushed)
      expect(attacker.stunned).toBeFalsy();
    });
  });
});
