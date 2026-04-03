import { describe, it, expect } from 'vitest';
import { performInjuryRoll } from './injury';
import { applyApothecaryChoice } from './apothecary';
import { initializeDugouts } from './dugout';
import type { GameState, Player, CasualtyOutcome } from '../core/types';

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'A1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Test Player',
    number: 1,
    position: 'Lineman',
    ma: 6, st: 3, ag: 3, pa: 4, av: 8,
    skills: [],
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

describe('Regle: Apothecaire', () => {
  describe('Eligibilite', () => {
    it('ne devrait PAS proposer l\'apothecaire pour un resultat Stunned', () => {
      const state = createTestState({ apothecaryAvailable: { teamA: true, teamB: false } });
      // RNG: low rolls → stunned (2-7)
      const rng = () => 0.01;
      const result = performInjuryRoll(state, state.players[0], rng);

      expect(result.pendingApothecary).toBeUndefined();
      // Player should be stunned on field
      expect(result.players[0].stunned).toBe(true);
    });

    it('devrait proposer l\'apothecaire pour un resultat KO quand disponible', () => {
      const state = createTestState({ apothecaryAvailable: { teamA: true, teamB: false } });
      // RNG: 0.5 per die → 4+4 = 8 (KO range)
      const rng = () => 0.5;
      const result = performInjuryRoll(state, state.players[0], rng);

      expect(result.pendingApothecary).toBeDefined();
      expect(result.pendingApothecary!.playerId).toBe('A1');
      expect(result.pendingApothecary!.team).toBe('A');
      expect(result.pendingApothecary!.injuryType).toBe('ko');
    });

    it('devrait proposer l\'apothecaire pour un resultat Casualty quand disponible', () => {
      const state = createTestState({ apothecaryAvailable: { teamA: true, teamB: false } });
      let callCount = 0;
      const rng = () => {
        callCount++;
        if (callCount <= 2) return 0.99; // 6+6 = 12 (casualty)
        return 0.01; // D16 roll 1 → badly_hurt
      };
      const result = performInjuryRoll(state, state.players[0], rng);

      expect(result.pendingApothecary).toBeDefined();
      expect(result.pendingApothecary!.playerId).toBe('A1');
      expect(result.pendingApothecary!.injuryType).toBe('casualty');
      expect(result.pendingApothecary!.originalCasualtyOutcome).toBe('badly_hurt');
    });

    it('ne devrait PAS proposer l\'apothecaire si deja utilise', () => {
      const state = createTestState({ apothecaryAvailable: { teamA: false, teamB: false } });
      // KO roll
      const rng = () => 0.5;
      const result = performInjuryRoll(state, state.players[0], rng);

      expect(result.pendingApothecary).toBeUndefined();
    });

    it('ne devrait PAS proposer l\'apothecaire pour l\'equipe adverse', () => {
      // Team A player injured, only team B has apothecary
      const state = createTestState({ apothecaryAvailable: { teamA: false, teamB: true } });
      const rng = () => 0.5; // KO
      const result = performInjuryRoll(state, state.players[0], rng);

      expect(result.pendingApothecary).toBeUndefined();
    });
  });

  describe('Utilisation sur KO', () => {
    it('devrait deplacer le joueur en Reserves quand apothecaire utilise sur KO', () => {
      // Setup: player already in KO zone with pendingApothecary
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'ko',
        },
      });
      // Move player to KO zone first (simulating injury result)
      state.players[0].state = 'knocked_out';
      state.dugouts.teamA.zones.knockedOut.players.push('A1');

      const rng = () => 0.5;
      const result = applyApothecaryChoice(state, true, rng);

      // Player should be in reserves, not KO
      expect(result.dugouts.teamA.zones.knockedOut.players).not.toContain('A1');
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
      // Apothecary consumed
      expect(result.apothecaryAvailable.teamA).toBe(false);
      // Pending cleared
      expect(result.pendingApothecary).toBeUndefined();
    });

    it('devrait laisser le joueur KO quand apothecaire refuse', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'ko',
        },
      });
      state.players[0].state = 'knocked_out';
      state.dugouts.teamA.zones.knockedOut.players.push('A1');

      const rng = () => 0.5;
      const result = applyApothecaryChoice(state, false, rng);

      // Player stays in KO
      expect(result.dugouts.teamA.zones.knockedOut.players).toContain('A1');
      // Apothecary NOT consumed
      expect(result.apothecaryAvailable.teamA).toBe(true);
      // Pending cleared
      expect(result.pendingApothecary).toBeUndefined();
    });
  });

  describe('Utilisation sur Casualty', () => {
    it('devrait re-lancer le D16 et garder le meilleur resultat', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'casualty',
          originalCasualtyOutcome: 'dead',
          originalCasualtyRoll: 16,
        },
      });
      state.players[0].state = 'casualty';
      state.dugouts.teamA.zones.casualty.players.push('A1');
      state.casualtyResults = { A1: 'dead' };

      // Re-roll D16: 0.01 → roll 1 → badly_hurt (better than dead)
      const rng = () => 0.01;
      const result = applyApothecaryChoice(state, true, rng);

      // Player goes to reserves (saved!)
      expect(result.dugouts.teamA.zones.casualty.players).not.toContain('A1');
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
      // Better casualty result applied
      expect(result.casualtyResults['A1']).toBe('badly_hurt');
      // Apothecary consumed
      expect(result.apothecaryAvailable.teamA).toBe(false);
      expect(result.pendingApothecary).toBeUndefined();
    });

    it('devrait garder le resultat original si le re-roll est pire', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'casualty',
          originalCasualtyOutcome: 'badly_hurt',
          originalCasualtyRoll: 3,
        },
      });
      state.players[0].state = 'casualty';
      state.dugouts.teamA.zones.casualty.players.push('A1');
      state.casualtyResults = { A1: 'badly_hurt' };

      // Re-roll D16: 0.99 → roll 16 → dead (worse than badly_hurt)
      const rng = () => 0.99;
      const result = applyApothecaryChoice(state, true, rng);

      // Player still goes to reserves (apothecary always saves from match removal)
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
      // Keeps original better result
      expect(result.casualtyResults['A1']).toBe('badly_hurt');
      // Apothecary consumed
      expect(result.apothecaryAvailable.teamA).toBe(false);
    });

    it('devrait laisser le joueur en Casualty quand apothecaire refuse', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'casualty',
          originalCasualtyOutcome: 'seriously_hurt',
          originalCasualtyRoll: 8,
        },
      });
      state.players[0].state = 'casualty';
      state.dugouts.teamA.zones.casualty.players.push('A1');
      state.casualtyResults = { A1: 'seriously_hurt' };

      const rng = () => 0.5;
      const result = applyApothecaryChoice(state, false, rng);

      // Player stays in casualty
      expect(result.dugouts.teamA.zones.casualty.players).toContain('A1');
      expect(result.casualtyResults['A1']).toBe('seriously_hurt');
      // Apothecary NOT consumed
      expect(result.apothecaryAvailable.teamA).toBe(true);
      expect(result.pendingApothecary).toBeUndefined();
    });

    it('devrait conserver les lasting injury details du meilleur resultat', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'casualty',
          originalCasualtyOutcome: 'lasting_injury',
          originalCasualtyRoll: 14,
          originalLastingInjury: {
            outcome: 'lasting_injury',
            injuryType: '-1st',
            missNextMatch: true,
          },
        },
      });
      state.players[0].state = 'casualty';
      state.dugouts.teamA.zones.casualty.players.push('A1');
      state.casualtyResults = { A1: 'lasting_injury' };
      state.lastingInjuryDetails = {
        A1: { outcome: 'lasting_injury', injuryType: '-1st', missNextMatch: true },
      };

      // Re-roll D16: 0.01 → roll 1 → badly_hurt (much better!)
      const rng = () => 0.01;
      const result = applyApothecaryChoice(state, true, rng);

      // Better result: badly_hurt (no lasting injury)
      expect(result.casualtyResults['A1']).toBe('badly_hurt');
      // Lasting injury cleared since badly_hurt has none
      expect(result.lastingInjuryDetails['A1']).toBeUndefined();
      expect(result.dugouts.teamA.zones.reserves.players).toContain('A1');
    });
  });

  describe('Apothecaire equipe B', () => {
    it('devrait fonctionner pour l\'equipe B', () => {
      const playerB = createTestPlayer({ id: 'B1', team: 'B', name: 'Team B Player' });
      const state = createTestState({
        players: [playerB],
        apothecaryAvailable: { teamA: false, teamB: true },
      });

      // KO roll
      const rng = () => 0.5;
      const result = performInjuryRoll(state, state.players[0], rng);

      expect(result.pendingApothecary).toBeDefined();
      expect(result.pendingApothecary!.team).toBe('B');
    });
  });

  describe('Game log', () => {
    it('devrait ajouter une entree de log quand l\'apothecaire est utilise', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'ko',
        },
      });
      state.players[0].state = 'knocked_out';
      state.dugouts.teamA.zones.knockedOut.players.push('A1');

      const rng = () => 0.5;
      const result = applyApothecaryChoice(state, true, rng);

      const apothLog = result.gameLog.find(l => l.message.includes('Apoth'));
      expect(apothLog).toBeDefined();
    });

    it('devrait ajouter une entree de log quand l\'apothecaire est refuse', () => {
      const state = createTestState({
        apothecaryAvailable: { teamA: true, teamB: false },
        pendingApothecary: {
          playerId: 'A1',
          team: 'A',
          injuryType: 'ko',
        },
      });
      state.players[0].state = 'knocked_out';
      state.dugouts.teamA.zones.knockedOut.players.push('A1');

      const rng = () => 0.5;
      const result = applyApothecaryChoice(state, false, rng);

      const declineLog = result.gameLog.find(l => l.message.includes('refuse') || l.message.includes('déclin'));
      expect(declineLog).toBeDefined();
    });
  });
});
