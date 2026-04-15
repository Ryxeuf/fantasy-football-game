import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  resolveBlockResult,
  makeRNG,
  type GameState,
} from '../index';
import { isJuggernautActiveForBlock } from './juggernaut';

/**
 * Juggernaut (BB3 Season 2/3 rules):
 * - When this player performs a Blitz action:
 *   1. They may choose to treat a BOTH_DOWN result as a PUSH_BACK instead.
 *   2. Opposing players targeted by this Blitz cannot use Fend, Stand Firm,
 *      or Wrestle skills.
 * - Juggernaut has NO effect during a normal Block action.
 *
 * Primary user: Dwarf Deathroller.
 */

function makeBlockResult(
  attackerId: string,
  targetId: string,
  result: 'BOTH_DOWN' | 'PUSH_BACK' | 'POW' | 'STUMBLE' | 'PLAYER_DOWN',
) {
  return {
    type: 'block' as const,
    playerId: attackerId,
    targetId: targetId,
    diceRoll: 2,
    result,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

function placePlayersForBlock(
  baseState: GameState,
  attackerSkills: string[],
  defenderSkills: string[],
  opts: { isBlitz?: boolean } = {},
): GameState {
  const nextState = {
    ...baseState,
    players: baseState.players.map(p => {
      if (p.id === 'A2')
        return {
          ...p,
          pos: { x: 10, y: 7 },
          stunned: false,
          pm: 6,
          skills: attackerSkills,
        };
      if (p.id === 'B2')
        return {
          ...p,
          pos: { x: 11, y: 7 },
          stunned: false,
          pm: 6,
          skills: defenderSkills,
        };
      return p;
    }),
  };
  if (opts.isBlitz) {
    return {
      ...nextState,
      playerActions: { ...nextState.playerActions, A2: 'BLITZ' },
    };
  }
  return nextState;
}

describe('Regle: Juggernaut', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('juggernaut-test-seed');
  });

  describe('Activation (helper)', () => {
    it('n\'est pas actif sans le skill', () => {
      const testState = placePlayersForBlock(state, [], [], { isBlitz: true });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      expect(isJuggernautActiveForBlock(testState, attacker)).toBe(false);
    });

    it('n\'est pas actif si ce n\'est pas un blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: false,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      expect(isJuggernautActiveForBlock(testState, attacker)).toBe(false);
    });

    it('est actif avec juggernaut + blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: true,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      expect(isJuggernautActiveForBlock(testState, attacker)).toBe(true);
    });

    it('accepte les variantes de slug (underscore / espace)', () => {
      const testState = placePlayersForBlock(state, ['Juggernaut'], [], {
        isBlitz: true,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      expect(isJuggernautActiveForBlock(testState, attacker)).toBe(true);
    });
  });

  describe('BOTH_DOWN pendant un Blitz', () => {
    it('convertit BOTH_DOWN en PUSH_BACK (personne ne tombe)', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      // Ni l'attaquant ni la cible ne sont au sol (push_back uniquement).
      expect(attacker.stunned).toBeFalsy();
      // Pas de turnover : l'attaquant reste debout.
      expect(result.isTurnover).toBe(false);
    });

    it('ne provoque pas de jet d\'armure sur BOTH_DOWN converti', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const armorLogs = result.gameLog.filter(
        log => log.type === 'dice' && log.message.includes("Jet d'armure"),
      );
      expect(armorLogs).toHaveLength(0);
    });

    it('log explicite l\'utilisation de Juggernaut', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const juggernautLog = result.gameLog.find(
        log => log.message.toLowerCase().includes('juggernaut'),
      );
      expect(juggernautLog).toBeDefined();
    });

    it('annule le Wrestle du défenseur ciblé par le blitz', () => {
      // Defenseur a Wrestle : normalement les deux tomberaient sur BOTH_DOWN.
      // Avec juggernaut en blitz, le BOTH_DOWN devient PUSH_BACK et Wrestle est ignore.
      const testState = placePlayersForBlock(state, ['juggernaut'], ['wrestle'], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;
      expect(attacker.stunned).toBeFalsy();
      expect(defender.stunned).toBeFalsy();
      expect(result.isTurnover).toBe(false);
    });
  });

  describe('BOTH_DOWN pendant un Blocage normal', () => {
    it('n\'a PAS d\'effet (comportement BOTH_DOWN standard)', () => {
      // Juggernaut mais ce n'est PAS un blitz : comportement normal BOTH_DOWN
      // Les deux joueurs tombent.
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: false,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;
      expect(attacker.stunned).toBe(true);
      expect(defender.stunned).toBe(true);
      expect(result.isTurnover).toBe(true);
    });

    it('ne modifie pas un BOTH_DOWN avec Wrestle si ce n\'est pas un blitz', () => {
      // Juggernaut mais NON-blitz + defenseur a Wrestle : Wrestle s'applique normalement.
      const testState = placePlayersForBlock(state, ['juggernaut'], ['wrestle'], {
        isBlitz: false,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      // Wrestle force les deux au sol sans jet d'armure et sans turnover.
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

  describe('Autres resultats', () => {
    it('ne modifie pas un POW (comportement standard)', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'POW');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.stunned).toBe(true);
    });

    it('ne modifie pas un PUSH_BACK (comportement standard)', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], [], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      const defender = result.players.find(p => p.id === 'B2')!;
      // Personne ne tombe, c'est juste une poussee.
      expect(attacker.stunned).toBeFalsy();
      expect(defender.stunned).toBeFalsy();
    });
  });
});
