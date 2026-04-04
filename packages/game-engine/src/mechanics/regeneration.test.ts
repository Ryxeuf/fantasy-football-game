import { describe, it, expect } from 'vitest';
import { performInjuryRoll } from './injury';
import { applyApothecaryChoice } from './apothecary';
import { initializeDugouts } from './dugout';
import type { GameState, Player } from '../core/types';

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'A1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Regen Player',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 8,
    skills: ['regeneration'],
    pm: 6,
    ...overrides,
  };
}

function createTestState(overrides: Partial<GameState> = {}): GameState {
  const dugouts = initializeDugouts();
  const player = createTestPlayer();

  return {
    width: 26,
    height: 15,
    players: [player],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    dugouts,
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'Team A', teamB: 'Team B' },
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    gameLog: [],
    apothecaryAvailable: { teamA: false, teamB: false },
    ...overrides,
  };
}

describe('Regle: Regeneration', () => {
  describe('Stunned (2-7) — pas de regeneration', () => {
    it('ne devrait PAS declencher la regeneration sur un resultat Stunned', () => {
      const state = createTestState();
      // RNG: low rolls → stunned (2-7): 0.01 → die=1, so 1+1=2
      const rng = () => 0.01;
      const result = performInjuryRoll(state, state.players[0], rng);

      // Player should be stunned on field, no regen triggered
      expect(result.players[0].stunned).toBe(true);
      expect(result.players[0].state).toBe('stunned');
    });
  });

  describe('KO (8-9) — regeneration check', () => {
    it('devrait sauver le joueur sur un jet de 4+ (KO)', () => {
      const state = createTestState();
      let callCount = 0;
      const rng = () => {
        callCount++;
        // Calls 1-2: injury roll dice → 0.5 each → 4+4=8 (KO)
        if (callCount <= 2) return 0.5;
        // Call 3: regeneration D6 → 0.5 → floor(0.5*6)+1 = 4 (success!)
        return 0.5;
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen succeeded: player goes to reserves, not KO
      expect(result.dugouts.teamA.zones.knockedOut.players).not.toContain('A1');
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
      // No pending apothecary (regen already saved)
      expect(result.pendingApothecary).toBeUndefined();
      // Log should mention regeneration
      const regenLog = result.gameLog.find(l => l.message.toLowerCase().includes('régénération') || l.message.toLowerCase().includes('regeneration'));
      expect(regenLog).toBeDefined();
    });

    it('ne devrait PAS sauver le joueur sur un jet de 1-3 (KO)', () => {
      const state = createTestState();
      let callCount = 0;
      const rng = () => {
        callCount++;
        // Calls 1-2: injury roll → 0.5 each → 4+4=8 (KO)
        if (callCount <= 2) return 0.5;
        // Call 3: regeneration D6 → 0.01 → floor(0.01*6)+1 = 1 (fail)
        return 0.01;
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen failed: player stays in KO
      expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
    });

    it('devrait permettre l\'apothecaire apres echec de regeneration (KO)', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
      });
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.5; // 4+4=8 (KO)
        return 0.01; // regen fail (roll=1)
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen failed → apothecary should be offered
      expect(result.pendingApothecary).toBeDefined();
      expect(result.pendingApothecary!.injuryType).toBe('ko');
    });

    it('ne devrait PAS proposer l\'apothecaire si regeneration reussit (KO)', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
      });
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.5; // 4+4=8 (KO)
        return 0.99; // regen success (roll=6)
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen succeeded → no apothecary needed
      expect(result.pendingApothecary).toBeUndefined();
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
    });
  });

  describe('Casualty (10+) — regeneration check', () => {
    it('devrait sauver le joueur sur un jet de 4+ (Casualty)', () => {
      const state = createTestState();
      let callCount = 0;
      const rng = () => {
        callCount++;
        // Calls 1-2: injury roll → 0.99 each → 6+6=12 (casualty)
        if (callCount <= 2) return 0.99;
        // Call 3: D16 casualty roll
        if (callCount === 3) return 0.01; // badly_hurt
        // Call 4: regeneration D6 → 0.5 → 4 (success!)
        return 0.5;
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen succeeded: player goes to reserves, not casualty
      expect(result.dugouts.teamA.zones.casualty.players).not.toContain('A1');
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
      // Casualty result should be cleared
      expect(result.casualtyResults['A1']).toBeUndefined();
      expect(result.pendingApothecary).toBeUndefined();
    });

    it('ne devrait PAS sauver le joueur sur un jet de 1-3 (Casualty)', () => {
      const state = createTestState();
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.99; // 6+6=12 (casualty)
        if (callCount === 3) return 0.01; // D16 → badly_hurt
        return 0.01; // regen fail (roll=1)
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen failed: player stays in casualty
      expect(result.dugouts.teamA.zones.casualty.players).toContain('A1');
      expect(result.casualtyResults['A1']).toBe('badly_hurt');
    });

    it('devrait permettre l\'apothecaire apres echec de regeneration (Casualty)', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
      });
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.99; // casualty
        if (callCount === 3) return 0.99; // D16 → dead (roll=16)
        return 0.01; // regen fail
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen failed → apothecary offered
      expect(result.pendingApothecary).toBeDefined();
      expect(result.pendingApothecary!.injuryType).toBe('casualty');
    });

    it('devrait effacer les lasting injury details si regeneration reussit', () => {
      const state = createTestState();
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.99; // casualty (12)
        if (callCount === 3) return 0.8; // D16 → 13 → lasting_injury
        if (callCount === 4) return 0.01; // lasting injury type roll
        // Call 5: regen D6 → success
        return 0.99;
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen succeeded: lasting injury cleared
      expect(result.lastingInjuryDetails['A1']).toBeUndefined();
      expect(result.casualtyResults['A1']).toBeUndefined();
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
    });
  });

  describe('Joueur sans Regeneration', () => {
    it('ne devrait PAS faire de jet de regeneration', () => {
      const player = createTestPlayer({ skills: [] });
      const state = createTestState({ players: [player] });
      // KO roll
      const rng = () => 0.5; // 4+4=8 (KO)
      const result = performInjuryRoll(state, state.players[0], rng);

      // Normal KO, no regen log
      expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
      const regenLog = result.gameLog.find(l =>
        l.message.toLowerCase().includes('régénération') || l.message.toLowerCase().includes('regeneration')
      );
      expect(regenLog).toBeUndefined();
    });
  });

  describe('Game log', () => {
    it('devrait logger le jet de regeneration reussi', () => {
      const state = createTestState();
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.5; // KO
        return 0.99; // regen success (6)
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      const regenLog = result.gameLog.find(l =>
        l.message.toLowerCase().includes('régénération') || l.message.toLowerCase().includes('regeneration')
      );
      expect(regenLog).toBeDefined();
      expect(regenLog!.message).toContain('réussi');
    });

    it('devrait logger le jet de regeneration echoue', () => {
      const state = createTestState();
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.5; // KO
        return 0.01; // regen fail (1)
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      const regenLog = result.gameLog.find(l =>
        l.message.toLowerCase().includes('régénération') || l.message.toLowerCase().includes('regeneration')
      );
      expect(regenLog).toBeDefined();
      expect(regenLog!.message).toContain('échoué');
    });
  });

  describe('Equipe B', () => {
    it('devrait fonctionner pour un joueur de l\'equipe B', () => {
      const playerB = createTestPlayer({ id: 'B1', team: 'B', name: 'Regen B' });
      const state = createTestState({ players: [playerB] });
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.5; // KO
        return 0.99; // regen success
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      // Regen saved: player in reserves of team B
      expect(result.dugouts.teamB.zones.knockedOut.players).not.toContain('B1');
      expect(result.dugouts.teamB.zones.reserves.players).toContain('B1');
    });
  });
});
