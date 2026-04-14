import { describe, it, expect } from 'vitest';
import { setup } from '../index';
import type { GameState, Player } from '../core/types';
import {
  checkBoneHead,
  checkReallyStupid,
  checkWildAnimal,
  checkAnimalSavagery,
  checkTakeRoot,
  checkBloodlust,
  canInstablePerformAction,
  logInstablePrevention,
} from './negative-traits';

/** Fixed RNG that always returns the same value */
function fixedRNG(val: number): () => number {
  return () => val;
}

/** Get a player from state by id */
function getPlayer(state: GameState, id: string): Player {
  return state.players.find(p => p.id === id)!;
}

/** Add a skill to a player in state */
function withSkill(state: GameState, playerId: string, skill: string): GameState {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, skills: [...p.skills, skill] } : p
    ),
  };
}

/** Place a player at a specific position */
function withPosition(state: GameState, playerId: string, x: number, y: number): GameState {
  return {
    ...state,
    players: state.players.map(p =>
      p.id === playerId ? { ...p, pos: { x, y } } : p
    ),
  };
}

describe('checkBoneHead', () => {
  it('should always pass if player does not have bone-head', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    const result = checkBoneHead(state, player, fixedRNG(0.0));
    expect(result.passed).toBe(true);
  });

  it('should pass on roll >= 2 (RNG high)', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'bone-head');
    const player = getPlayer(state, 'A1');
    // RNG 0.99 → roll=6, passes (>= 2)
    const result = checkBoneHead(state, player, fixedRNG(0.99));
    expect(result.passed).toBe(true);
  });

  it('should pass on roll = 2 (RNG ~0.16)', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'bone-head');
    const player = getPlayer(state, 'A1');
    // RNG 0.2 → Math.floor(0.2*6)+1 = 2, passes
    const result = checkBoneHead(state, player, fixedRNG(0.2));
    expect(result.passed).toBe(true);
  });

  it('should fail on roll = 1 (RNG 0.0)', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'bone-head');
    const player = getPlayer(state, 'A1');
    // RNG 0.0 → Math.floor(0.0*6)+1 = 1, fails
    const result = checkBoneHead(state, player, fixedRNG(0.0));
    expect(result.passed).toBe(false);
  });

  it('should set pm=0 and gfiUsed=2 on failure', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'bone-head');
    const player = getPlayer(state, 'A1');
    const result = checkBoneHead(state, player, fixedRNG(0.0));
    const updatedPlayer = getPlayer(result.newState, 'A1');
    expect(updatedPlayer.pm).toBe(0);
    expect(updatedPlayer.gfiUsed).toBe(2);
  });

  it('should NOT set turnover on failure', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'bone-head');
    const player = getPlayer(state, 'A1');
    const result = checkBoneHead(state, player, fixedRNG(0.0));
    expect(result.newState.isTurnover).toBeFalsy();
  });

  it('should add log entries on roll', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'bone-head');
    const player = getPlayer(state, 'A1');
    const logCountBefore = state.gameLog.length;
    const result = checkBoneHead(state, player, fixedRNG(0.0));
    expect(result.newState.gameLog.length).toBeGreaterThan(logCountBefore);
  });
});

describe('checkReallyStupid', () => {
  it('should always pass if player does not have really-stupid', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    const result = checkReallyStupid(state, player, fixedRNG(0.0));
    expect(result.passed).toBe(true);
  });

  it('should pass on roll >= 2 when adjacent non-really-stupid teammate exists', () => {
    let state = setup();
    // Give A1 really-stupid and position A1 and A2 adjacent
    state = withSkill(state, 'A1', 'really-stupid');
    state = withPosition(state, 'A1', 10, 7);
    state = withPosition(state, 'A2', 11, 7);
    // Ensure A2 is active
    state = {
      ...state,
      players: state.players.map(p =>
        p.id === 'A2' ? { ...p, state: 'active' as const } : p
      ),
    };
    const player = getPlayer(state, 'A1');
    // RNG 0.2 → roll=2, with helper target=2, passes
    const result = checkReallyStupid(state, player, fixedRNG(0.2));
    expect(result.passed).toBe(true);
  });

  it('should need 4+ without adjacent non-really-stupid teammate', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'really-stupid');
    // Move A1 far from all teammates
    state = withPosition(state, 'A1', 0, 0);
    // Move all other team A players far away
    state = {
      ...state,
      players: state.players.map(p =>
        p.team === 'A' && p.id !== 'A1' ? { ...p, pos: { x: 20, y: 14 } } : p
      ),
    };
    const player = getPlayer(state, 'A1');
    // RNG 0.4 → roll=3 < 4, fails without helper
    const result = checkReallyStupid(state, player, fixedRNG(0.4));
    expect(result.passed).toBe(false);
  });

  it('should pass on roll >= 4 without adjacent teammate', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'really-stupid');
    state = withPosition(state, 'A1', 0, 0);
    state = {
      ...state,
      players: state.players.map(p =>
        p.team === 'A' && p.id !== 'A1' ? { ...p, pos: { x: 20, y: 14 } } : p
      ),
    };
    const player = getPlayer(state, 'A1');
    // RNG 0.5 → roll=4 >= 4, passes
    const result = checkReallyStupid(state, player, fixedRNG(0.5));
    expect(result.passed).toBe(true);
  });

  it('should set pm=0 and gfiUsed=2 on failure', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'really-stupid');
    state = withPosition(state, 'A1', 0, 0);
    state = {
      ...state,
      players: state.players.map(p =>
        p.team === 'A' && p.id !== 'A1' ? { ...p, pos: { x: 20, y: 14 } } : p
      ),
    };
    const player = getPlayer(state, 'A1');
    const result = checkReallyStupid(state, player, fixedRNG(0.0));
    const updatedPlayer = getPlayer(result.newState, 'A1');
    expect(updatedPlayer.pm).toBe(0);
    expect(updatedPlayer.gfiUsed).toBe(2);
  });
});

describe('checkWildAnimal', () => {
  it('should always pass if player does not have wild-animal', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    const result = checkWildAnimal(state, player, fixedRNG(0.0), 'MOVE');
    expect(result.passed).toBe(true);
  });

  it('should pass on BLOCK action with roll=1 +2 modifier = 3 < 4 → fails', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'wild-animal');
    const player = getPlayer(state, 'A1');
    // RNG 0.0 → roll=1, +2 for BLOCK = 3, still < 4 → fails
    const result = checkWildAnimal(state, player, fixedRNG(0.0), 'BLOCK');
    expect(result.passed).toBe(false);
  });

  it('should pass on BLOCK action with roll=2 +2 modifier = 4 >= 4', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'wild-animal');
    const player = getPlayer(state, 'A1');
    // RNG 0.2 → roll=2, +2 for BLOCK = 4 >= 4 → passes
    const result = checkWildAnimal(state, player, fixedRNG(0.2), 'BLOCK');
    expect(result.passed).toBe(true);
  });

  it('should fail on MOVE with roll=3 (no modifier, 3 < 4)', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'wild-animal');
    const player = getPlayer(state, 'A1');
    // RNG 0.4 → roll=3, no modifier for MOVE, 3 < 4 → fails
    const result = checkWildAnimal(state, player, fixedRNG(0.4), 'MOVE');
    expect(result.passed).toBe(false);
  });

  it('should pass on MOVE with roll=4 (4 >= 4)', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'wild-animal');
    const player = getPlayer(state, 'A1');
    // RNG 0.5 → roll=4, 4 >= 4 → passes
    const result = checkWildAnimal(state, player, fixedRNG(0.5), 'MOVE');
    expect(result.passed).toBe(true);
  });

  it('should also apply +2 for BLITZ action', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'wild-animal');
    const player = getPlayer(state, 'A1');
    // RNG 0.2 → roll=2, +2 for BLITZ = 4 >= 4 → passes
    const result = checkWildAnimal(state, player, fixedRNG(0.2), 'BLITZ');
    expect(result.passed).toBe(true);
  });

  it('should set pm=0 and gfiUsed=2 on failure', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'wild-animal');
    const player = getPlayer(state, 'A1');
    const result = checkWildAnimal(state, player, fixedRNG(0.0), 'MOVE');
    const updatedPlayer = getPlayer(result.newState, 'A1');
    expect(updatedPlayer.pm).toBe(0);
    expect(updatedPlayer.gfiUsed).toBe(2);
  });
});

describe('checkTakeRoot', () => {
  it('should always pass if player does not have take-root', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    const result = checkTakeRoot(state, player, fixedRNG(0.0));
    expect(result.passed).toBe(true);
  });

  it('should pass on roll >= 2 (RNG high)', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'take-root');
    const player = getPlayer(state, 'A1');
    const result = checkTakeRoot(state, player, fixedRNG(0.99));
    expect(result.passed).toBe(true);
  });

  it('should fail on roll = 1 (RNG 0.0)', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'take-root');
    const player = getPlayer(state, 'A1');
    const result = checkTakeRoot(state, player, fixedRNG(0.0));
    expect(result.passed).toBe(false);
  });

  it('should set pm=0 and gfiUsed=2 on failure', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'take-root');
    const player = getPlayer(state, 'A1');
    const result = checkTakeRoot(state, player, fixedRNG(0.0));
    const updatedPlayer = getPlayer(result.newState, 'A1');
    expect(updatedPlayer.pm).toBe(0);
    expect(updatedPlayer.gfiUsed).toBe(2);
  });

  it('should NOT set turnover on failure', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'take-root');
    const player = getPlayer(state, 'A1');
    const result = checkTakeRoot(state, player, fixedRNG(0.0));
    expect(result.newState.isTurnover).toBeFalsy();
  });
});

describe('Regle: Bloodlust (Soif de Sang)', () => {
  describe('checkBloodlust — pas de trait', () => {
    it('should always pass if player has no bloodlust skill', () => {
      const state = setup();
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'MOVE');
      expect(result.passed).toBe(true);
      expect(result.newState).toBe(state);
    });
  });

  describe('checkBloodlust — bloodlust (cible 4+)', () => {
    it('should fail on roll=3 for MOVE action (3 < 4)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      // RNG 0.4 → Math.floor(0.4*6)+1 = 3
      const result = checkBloodlust(state, player, fixedRNG(0.4), 'MOVE');
      expect(result.passed).toBe(false);
    });

    it('should pass on roll=4 for MOVE action (4 >= 4)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      // RNG 0.5 → Math.floor(0.5*6)+1 = 4
      const result = checkBloodlust(state, player, fixedRNG(0.5), 'MOVE');
      expect(result.passed).toBe(true);
    });

    it('should pass on roll=3 for BLOCK action (3+1=4 >= 4)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.4), 'BLOCK');
      expect(result.passed).toBe(true);
    });

    it('should pass on roll=3 for BLITZ action (3+1=4 >= 4)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.4), 'BLITZ');
      expect(result.passed).toBe(true);
    });

    it('should fail on natural 1 even with BLOCK modifier', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      // Natural 1 always fails regardless of modifier
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'BLOCK');
      expect(result.passed).toBe(false);
    });

    it('should set pm=0 and gfiUsed=2 on failure', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'MOVE');
      const updatedPlayer = getPlayer(result.newState, 'A1');
      expect(updatedPlayer.pm).toBe(0);
      expect(updatedPlayer.gfiUsed).toBe(2);
    });

    it('should NOT set turnover on failure', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'MOVE');
      expect(result.newState.isTurnover).toBeFalsy();
    });

    it('should add log entries on roll', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      const player = getPlayer(state, 'A1');
      const logCountBefore = state.gameLog.length;
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'MOVE');
      expect(result.newState.gameLog.length).toBeGreaterThan(logCountBefore);
    });
  });

  describe('checkBloodlust — bloodlust-2 (cible 2+)', () => {
    it('should pass on roll=2 for MOVE action (2 >= 2)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust-2');
      const player = getPlayer(state, 'A1');
      // RNG 0.2 → roll=2
      const result = checkBloodlust(state, player, fixedRNG(0.2), 'MOVE');
      expect(result.passed).toBe(true);
    });

    it('should fail on natural 1 (MOVE)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust-2');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'MOVE');
      expect(result.passed).toBe(false);
    });

    it('should fail on natural 1 even with BLOCK modifier', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust-2');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'BLOCK');
      expect(result.passed).toBe(false);
    });
  });

  describe('checkBloodlust — bloodlust-3 (cible 3+)', () => {
    it('should fail on roll=2 for MOVE action (2 < 3)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust-3');
      const player = getPlayer(state, 'A1');
      // RNG 0.2 → roll=2
      const result = checkBloodlust(state, player, fixedRNG(0.2), 'MOVE');
      expect(result.passed).toBe(false);
    });

    it('should pass on roll=3 for MOVE action (3 >= 3)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust-3');
      const player = getPlayer(state, 'A1');
      // RNG 0.4 → roll=3
      const result = checkBloodlust(state, player, fixedRNG(0.4), 'MOVE');
      expect(result.passed).toBe(true);
    });

    it('should pass on roll=2 for BLOCK action (2+1=3 >= 3)', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust-3');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.2), 'BLOCK');
      expect(result.passed).toBe(true);
    });

    it('should fail on natural 1 even with BLITZ modifier', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust-3');
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'BLITZ');
      expect(result.passed).toBe(false);
    });
  });

  describe('checkBloodlust — re-activation', () => {
    it('should skip check if player already acted this turn', () => {
      let state = setup();
      state = withSkill(state, 'A1', 'bloodlust');
      // Simulate already acted
      state = {
        ...state,
        playerActions: {
          ...state.playerActions,
          A1: 'MOVE',
        },
      };
      const player = getPlayer(state, 'A1');
      const result = checkBloodlust(state, player, fixedRNG(0.0), 'MOVE');
      expect(result.passed).toBe(true);
    });
  });
});

describe('checkAnimalSavagery', () => {
  it('should always pass if player does not have animal-savagery', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    const result = checkAnimalSavagery(state, player, fixedRNG(0.0));
    expect(result.passed).toBe(true);
  });

  it('should pass on roll >= 2', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'animal-savagery');
    const player = getPlayer(state, 'A1');
    const result = checkAnimalSavagery(state, player, fixedRNG(0.99));
    expect(result.passed).toBe(true);
  });

  it('should fail on roll = 1 with no adjacent teammate', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'animal-savagery');
    // Move A1 far from all teammates
    state = withPosition(state, 'A1', 0, 0);
    state = {
      ...state,
      players: state.players.map(p =>
        p.team === 'A' && p.id !== 'A1' ? { ...p, pos: { x: 20, y: 14 } } : p
      ),
    };
    const player = getPlayer(state, 'A1');
    const result = checkAnimalSavagery(state, player, fixedRNG(0.0));
    expect(result.passed).toBe(false);
  });

  it('should set pm=0 when failing with no adjacent teammate', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'animal-savagery');
    state = withPosition(state, 'A1', 0, 0);
    state = {
      ...state,
      players: state.players.map(p =>
        p.team === 'A' && p.id !== 'A1' ? { ...p, pos: { x: 20, y: 14 } } : p
      ),
    };
    const player = getPlayer(state, 'A1');
    const result = checkAnimalSavagery(state, player, fixedRNG(0.0));
    const updatedPlayer = getPlayer(result.newState, 'A1');
    expect(updatedPlayer.pm).toBe(0);
    expect(updatedPlayer.gfiUsed).toBe(2);
  });

  it('should create log entries on activation check', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'animal-savagery');
    const player = getPlayer(state, 'A1');
    const logCountBefore = state.gameLog.length;
    const result = checkAnimalSavagery(state, player, fixedRNG(0.99));
    expect(result.newState.gameLog.length).toBeGreaterThan(logCountBefore);
  });
});

describe('canInstablePerformAction', () => {
  it('should allow any action for a player without the instable trait', () => {
    const state = setup();
    const player = getPlayer(state, 'A1');
    expect(canInstablePerformAction(player, 'PASS')).toBe(true);
    expect(canInstablePerformAction(player, 'HANDOFF')).toBe(true);
    expect(canInstablePerformAction(player, 'THROW_TEAM_MATE')).toBe(true);
    expect(canInstablePerformAction(player, 'MOVE')).toBe(true);
    expect(canInstablePerformAction(player, 'BLOCK')).toBe(true);
  });

  it('should forbid PASS action for a player with instable', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'instable');
    const player = getPlayer(state, 'A1');
    expect(canInstablePerformAction(player, 'PASS')).toBe(false);
  });

  it('should forbid HANDOFF action for a player with instable', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'instable');
    const player = getPlayer(state, 'A1');
    expect(canInstablePerformAction(player, 'HANDOFF')).toBe(false);
  });

  it('should forbid THROW_TEAM_MATE action for a player with instable', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'instable');
    const player = getPlayer(state, 'A1');
    expect(canInstablePerformAction(player, 'THROW_TEAM_MATE')).toBe(false);
  });

  it('should still allow MOVE/BLOCK/BLITZ/FOUL for a player with instable', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'instable');
    const player = getPlayer(state, 'A1');
    expect(canInstablePerformAction(player, 'MOVE')).toBe(true);
    expect(canInstablePerformAction(player, 'BLOCK')).toBe(true);
    expect(canInstablePerformAction(player, 'BLITZ')).toBe(true);
    expect(canInstablePerformAction(player, 'FOUL')).toBe(true);
  });
});

describe('logInstablePrevention', () => {
  it('should append a log entry describing the prevented action', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'instable');
    const player = getPlayer(state, 'A1');
    const logCountBefore = state.gameLog.length;

    const newState = logInstablePrevention(state, player, 'PASS');

    expect(newState.gameLog.length).toBe(logCountBefore + 1);
    const lastEntry = newState.gameLog[newState.gameLog.length - 1];
    expect(lastEntry.message).toContain('Instable');
    expect(lastEntry.playerId).toBe(player.id);
    expect(lastEntry.team).toBe(player.team);
  });

  it('should not mutate the original state', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'instable');
    const player = getPlayer(state, 'A1');
    const originalLogLength = state.gameLog.length;

    logInstablePrevention(state, player, 'HANDOFF');

    expect(state.gameLog.length).toBe(originalLogLength);
  });

  it('should include the skill metadata in the log entry', () => {
    let state = setup();
    state = withSkill(state, 'A1', 'instable');
    const player = getPlayer(state, 'A1');

    const newState = logInstablePrevention(state, player, 'THROW_TEAM_MATE');
    const lastEntry = newState.gameLog[newState.gameLog.length - 1];
    // Metadata is stored under details
    expect(lastEntry.details?.skill).toBe('instable');
  });
});
