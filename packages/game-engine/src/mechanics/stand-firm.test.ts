import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  resolveBlockResult,
  makeRNG,
  type GameState,
} from '../index';
import { hasStandFirm, isStandFirmActiveAgainstBlock } from './stand-firm';

/**
 * Stand Firm (BB3 Season 2/3 rules):
 * - A player with this skill may choose whether or not to be pushed back
 *   following a Block action. If they choose not to be pushed back, they
 *   remain in the square they occupy.
 * - If the block result knocks the defender down (POW, STUMBLE without Dodge),
 *   the defender falls in their own square (they are NOT pushed before falling).
 * - Stand Firm resists chain pushes too (the player can choose not to be chain-pushed).
 * - Juggernaut (on a Blitz) suppresses Stand Firm on the blitz target.
 *
 * Primary users:
 *   - Dwarf Deathroller
 *   - Treeman (Halflings, Wood Elves, Gnomes)
 *   - Bodyguard-like positionals (Ogre, Troll, Bloater, etc.)
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
  opts: { isBlitz?: boolean; attackerPos?: { x: number; y: number }; defenderPos?: { x: number; y: number } } = {},
): GameState {
  const attackerPos = opts.attackerPos ?? { x: 10, y: 7 };
  const defenderPos = opts.defenderPos ?? { x: 11, y: 7 };
  const nextState: GameState = {
    ...baseState,
    players: baseState.players.map(p => {
      if (p.id === 'A2')
        return {
          ...p,
          pos: attackerPos,
          stunned: false,
          pm: 6,
          skills: attackerSkills,
        };
      if (p.id === 'B2')
        return {
          ...p,
          pos: defenderPos,
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

describe('Regle: Stand Firm', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('stand-firm-test-seed');
  });

  describe('helpers', () => {
    it('hasStandFirm retourne false sans le skill', () => {
      const p = state.players.find(p => p.id === 'B2')!;
      expect(hasStandFirm({ ...p, skills: [] })).toBe(false);
    });

    it('hasStandFirm detecte le skill (slug standard)', () => {
      const p = state.players.find(p => p.id === 'B2')!;
      expect(hasStandFirm({ ...p, skills: ['stand-firm'] })).toBe(true);
    });

    it('hasStandFirm accepte la variante underscore', () => {
      const p = state.players.find(p => p.id === 'B2')!;
      expect(hasStandFirm({ ...p, skills: ['stand_firm'] })).toBe(true);
    });

    it('isStandFirmActiveAgainstBlock retourne true si defenseur a stand-firm', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveAgainstBlock(testState, target, attacker)).toBe(true);
    });

    it('isStandFirmActiveAgainstBlock retourne false sans le skill', () => {
      const testState = placePlayersForBlock(state, [], []);
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveAgainstBlock(testState, target, attacker)).toBe(false);
    });

    it('isStandFirmActiveAgainstBlock retourne false si attaquant a Juggernaut + Blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['stand-firm'], {
        isBlitz: true,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveAgainstBlock(testState, target, attacker)).toBe(false);
    });

    it('isStandFirmActiveAgainstBlock retourne true si Juggernaut mais pas Blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['stand-firm'], {
        isBlitz: false,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveAgainstBlock(testState, target, attacker)).toBe(true);
    });
  });

  describe('PUSH_BACK', () => {
    it('ne repousse pas un defenseur avec Stand Firm (reste sur sa case)', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');
      const originalPos = testState.players.find(p => p.id === 'B2')!.pos;

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.pos).toEqual(originalPos);
      expect(defender.stunned).toBeFalsy();
    });

    it('ne genere pas de pendingFollowUpChoice quand Stand Firm annule le push', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      expect(result.pendingFollowUpChoice).toBeUndefined();
      expect(result.pendingPushChoice).toBeUndefined();
    });

    it('log explicite l\'utilisation de Stand Firm', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const standFirmLog = result.gameLog.find(
        log => log.message.toLowerCase().includes('stand firm')
          || log.message.toLowerCase().includes('stabilit')
      );
      expect(standFirmLog).toBeDefined();
    });

    it('repousse normalement un defenseur sans Stand Firm', () => {
      const testState = placePlayersForBlock(state, [], []);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      // Soit un pendingPushChoice (multi-dir) soit un follow-up choice
      const hasPushFlow = !!(result.pendingPushChoice || result.pendingFollowUpChoice);
      expect(hasPushFlow).toBe(true);
    });

    it('Stand Firm protege contre le surf (push vers la foule)', () => {
      // Defenseur adjacent au bord du terrain - normalement pousse dans la foule
      const testState = placePlayersForBlock(state, [], ['stand-firm'], {
        attackerPos: { x: 10, y: 1 },
        defenderPos: { x: 10, y: 0 },
      });
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.pos).toEqual({ x: 10, y: 0 });
      // Pas de blessure par foule
      const crowdLogs = result.gameLog.filter(
        log => log.message.toLowerCase().includes('foule'),
      );
      expect(crowdLogs).toHaveLength(0);
    });
  });

  describe('POW et knockdown', () => {
    it('sur POW, un defenseur avec Stand Firm tombe dans sa propre case (pas de push)', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'POW');
      const originalPos = testState.players.find(p => p.id === 'B2')!.pos;

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.stunned).toBe(true);
      expect(defender.pos).toEqual(originalPos);
      // Pas de follow-up possible car la cible occupe encore sa case
      expect(result.pendingFollowUpChoice).toBeUndefined();
      expect(result.pendingPushChoice).toBeUndefined();
    });

    it('sur STUMBLE (sans Dodge), un defenseur avec Stand Firm tombe en place', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'STUMBLE');
      const originalPos = testState.players.find(p => p.id === 'B2')!.pos;

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.stunned).toBe(true);
      expect(defender.pos).toEqual(originalPos);
    });
  });

  describe('Juggernaut counter', () => {
    it('sur PUSH_BACK, Juggernaut + Blitz annule Stand Firm (push se fait)', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['stand-firm'], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      // Le push doit etre initie (soit resolu direct soit choix en attente)
      const defender = result.players.find(p => p.id === 'B2')!;
      const originalPos = { x: 11, y: 7 };
      const wasPushed = defender.pos.x !== originalPos.x || defender.pos.y !== originalPos.y;
      const hasPendingChoice = !!(result.pendingPushChoice || result.pendingFollowUpChoice);
      expect(wasPushed || hasPendingChoice).toBe(true);
    });

    it('sans Blitz, Juggernaut n\'annule pas Stand Firm', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['stand-firm'], {
        isBlitz: false,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');
      const originalPos = testState.players.find(p => p.id === 'B2')!.pos;

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.pos).toEqual(originalPos);
    });
  });

  describe('BOTH_DOWN', () => {
    it('sur BOTH_DOWN, Stand Firm n\'empeche pas la chute (pas de push impliqué)', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'BOTH_DOWN');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      // Les deux joueurs tombent (comportement BOTH_DOWN standard)
      expect(defender.stunned).toBe(true);
    });
  });
});
