import { describe, it, expect } from 'vitest';
import {
  setupPreMatchWithTeams,
  enterSetupPhase,
  placePlayerInSetup,
  validatePlayerPlacement,
  startKickoffSequence,
} from './game-state';
import type { ExtendedGameState } from './game-state';
import type { TeamId, Position } from './types';

/**
 * Creates a pre-match state ready for online setup testing.
 * Simulates the state after coin toss (idle phase with both teams ready).
 */
function createPreMatchState(receivingTeam: TeamId = 'A'): ExtendedGameState {
  const players = [];
  // Create 11 players per team (all in reserves, pos = {x: -1, y: -1})
  for (let i = 1; i <= 11; i++) {
    players.push({
      id: `A${i}`,
      name: `Player A${i}`,
      team: 'A' as TeamId,
      position: 'Lineman',
      number: i,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: '',
    });
    players.push({
      id: `B${i}`,
      name: `Player B${i}`,
      team: 'B' as TeamId,
      position: 'Lineman',
      number: i,
      ma: 6,
      st: 3,
      ag: 3,
      pa: 4,
      av: 8,
      skills: '',
    });
  }

  const state = setupPreMatchWithTeams(
    players.filter(p => p.team === 'A'),
    players.filter(p => p.team === 'B'),
    'Team Alpha',
    'Team Beta',
  );

  // Simulate coin toss result
  return {
    ...state,
    preMatch: {
      ...state.preMatch,
      kickingTeam: receivingTeam === 'A' ? 'B' : 'A',
      receivingTeam,
    },
  };
}

/**
 * Helper: places 11 players for the given team in valid setup positions.
 * Places 3 on LOS, 2 in each wide zone, 4 in middle.
 */
function placeAllPlayersForTeam(
  state: ExtendedGameState,
  teamId: TeamId,
): ExtendedGameState {
  const losX = teamId === 'A' ? 12 : 13;
  const safeX = teamId === 'A' ? 6 : 18;

  const positions: Position[] = [
    // 3 on Line of Scrimmage (required)
    { x: losX, y: 6 },
    { x: losX, y: 7 },
    { x: losX, y: 8 },
    // 2 in left wide zone (y = 0..2)
    { x: safeX, y: 1 },
    { x: safeX, y: 2 },
    // 2 in right wide zone (y = 12..14)
    { x: safeX, y: 12 },
    { x: safeX, y: 13 },
    // 4 in middle area
    { x: safeX, y: 5 },
    { x: safeX, y: 6 },
    { x: safeX, y: 7 },
    { x: safeX, y: 8 },
  ];

  let current = state;
  const teamPlayers = current.players.filter(p => p.team === teamId);

  for (let i = 0; i < 11; i++) {
    const result = placePlayerInSetup(current, teamPlayers[i].id, positions[i]);
    expect(result.success).toBe(true);
    current = result.state;
  }

  return current;
}

describe('Règle: Phase de setup en ligne', () => {
  describe('enterSetupPhase', () => {
    it('devrait initialiser la phase setup avec l\'équipe receveuse en premier', () => {
      const preMatch = createPreMatchState('A');
      const state = enterSetupPhase(preMatch, 'A');

      expect(state.preMatch.phase).toBe('setup');
      expect(state.preMatch.currentCoach).toBe('A');
      expect(state.preMatch.placedPlayers).toEqual([]);
      expect(state.preMatch.legalSetupPositions.length).toBeGreaterThan(0);
    });

    it('devrait calculer les positions légales pour l\'équipe A (x=1..12)', () => {
      const preMatch = createPreMatchState('A');
      const state = enterSetupPhase(preMatch, 'A');

      const positions = state.preMatch.legalSetupPositions;
      // All positions should have x between 1 and 12
      positions.forEach(pos => {
        expect(pos.x).toBeGreaterThanOrEqual(1);
        expect(pos.x).toBeLessThanOrEqual(12);
      });
    });

    it('devrait calculer les positions légales pour l\'équipe B (x=13..24)', () => {
      const preMatch = createPreMatchState('B');
      const state = enterSetupPhase(preMatch, 'B');

      const positions = state.preMatch.legalSetupPositions;
      positions.forEach(pos => {
        expect(pos.x).toBeGreaterThanOrEqual(13);
        expect(pos.x).toBeLessThanOrEqual(24);
      });
    });
  });

  describe('Flux complet setup en ligne (2 joueurs)', () => {
    it('devrait permettre le placement séquentiel: receveuse puis frappeuse', () => {
      // 1. Enter setup with receiving team A
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');
      expect(setupState.preMatch.currentCoach).toBe('A');

      // 2. Place all 11 players for team A
      const afterTeamA = placeAllPlayersForTeam(setupState, 'A');
      const teamAOnField = afterTeamA.players.filter(
        p => p.team === 'A' && p.pos.x >= 0,
      ).length;
      expect(teamAOnField).toBe(11);

      // 3. Validate team A placement → should switch to team B
      const afterValidateA = validatePlayerPlacement(afterTeamA);
      expect(afterValidateA.preMatch.phase).toBe('setup');
      expect(afterValidateA.preMatch.currentCoach).toBe('B');
      expect(afterValidateA.preMatch.placedPlayers).toEqual([]);

      // 4. Place all 11 players for team B
      const afterTeamB = placeAllPlayersForTeam(afterValidateA, 'B');
      const teamBOnField = afterTeamB.players.filter(
        p => p.team === 'B' && p.pos.x >= 0,
      ).length;
      expect(teamBOnField).toBe(11);

      // 5. Validate team B placement → should transition to kickoff
      const afterValidateB = validatePlayerPlacement(afterTeamB);
      expect(afterValidateB.preMatch.phase).toBe('kickoff');

      // 6. Start kickoff sequence
      const kickoffState = startKickoffSequence(afterValidateB);
      expect(kickoffState.preMatch.phase).toBe('kickoff-sequence');
      expect(kickoffState.preMatch.kickoffStep).toBe('place-ball');
    });

    it('devrait bloquer le placement par la mauvaise équipe', () => {
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');

      // Try to place a team B player when it's team A's turn
      const teamBPlayer = setupState.players.find(p => p.team === 'B');
      const result = placePlayerInSetup(setupState, teamBPlayer!.id, { x: 18, y: 7 });
      expect(result.success).toBe(false);
    });

    it('ne devrait pas valider un placement incomplet', () => {
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');

      // Place only 5 players
      let current = setupState;
      const teamAPlayers = current.players.filter(p => p.team === 'A');
      const losX = 12;
      for (let i = 0; i < 5; i++) {
        const result = placePlayerInSetup(current, teamAPlayers[i].id, {
          x: losX,
          y: 3 + i,
        });
        current = result.state;
      }

      // Validate should not advance phase
      const validated = validatePlayerPlacement(current);
      expect(validated.preMatch.phase).toBe('setup');
      expect(validated.preMatch.currentCoach).toBe('A');
    });

    it('devrait maintenir les positions de l\'équipe A après le switch vers B', () => {
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');

      // Place team A
      const afterTeamA = placeAllPlayersForTeam(setupState, 'A');
      const teamAPositions = afterTeamA.players
        .filter(p => p.team === 'A' && p.pos.x >= 0)
        .map(p => ({ id: p.id, x: p.pos.x, y: p.pos.y }));

      // Validate → switch to team B
      const afterValidateA = validatePlayerPlacement(afterTeamA);

      // Team A positions should be preserved
      const teamAAfterSwitch = afterValidateA.players
        .filter(p => p.team === 'A' && p.pos.x >= 0)
        .map(p => ({ id: p.id, x: p.pos.x, y: p.pos.y }));
      expect(teamAAfterSwitch).toEqual(teamAPositions);
    });
  });

  describe('isMyTurn derivation pendant le setup', () => {
    it('devrait permettre de dériver isMyTurn depuis preMatch.currentCoach', () => {
      const preMatch = createPreMatchState('A');
      const state = enterSetupPhase(preMatch, 'A');

      // Simulates the client-side derivation logic
      const deriveIsMyTurn = (gs: ExtendedGameState, myTeamSide: TeamId): boolean => {
        if (gs.preMatch?.phase === 'setup') {
          return gs.preMatch.currentCoach === myTeamSide;
        }
        return gs.currentPlayer === myTeamSide;
      };

      // Player A: it's their turn
      expect(deriveIsMyTurn(state, 'A')).toBe(true);
      // Player B: not their turn
      expect(deriveIsMyTurn(state, 'B')).toBe(false);
    });

    it('devrait basculer isMyTurn après validation du placement', () => {
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');

      // Place all for team A
      const afterTeamA = placeAllPlayersForTeam(setupState, 'A');
      const afterValidate = validatePlayerPlacement(afterTeamA);

      const deriveIsMyTurn = (gs: ExtendedGameState, myTeamSide: TeamId): boolean => {
        if (gs.preMatch?.phase === 'setup') {
          return gs.preMatch.currentCoach === myTeamSide;
        }
        return gs.currentPlayer === myTeamSide;
      };

      // After validate, it's now B's turn
      expect(deriveIsMyTurn(afterValidate, 'A')).toBe(false);
      expect(deriveIsMyTurn(afterValidate, 'B')).toBe(true);
    });
  });

  describe('Contraintes de placement Blood Bowl', () => {
    it('devrait refuser plus de 2 joueurs dans une wide zone', () => {
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');
      const teamAPlayers = setupState.players.filter(p => p.team === 'A');

      let current = setupState;
      // Place 2 players in left wide zone (y=0..2) - OK
      const r1 = placePlayerInSetup(current, teamAPlayers[0].id, { x: 6, y: 0 });
      expect(r1.success).toBe(true);
      current = r1.state;

      const r2 = placePlayerInSetup(current, teamAPlayers[1].id, { x: 6, y: 1 });
      expect(r2.success).toBe(true);
      current = r2.state;

      // 3rd player in left wide zone should fail
      const r3 = placePlayerInSetup(current, teamAPlayers[2].id, { x: 6, y: 2 });
      expect(r3.success).toBe(false);
    });

    it('devrait refuser le placement sur une position occupée', () => {
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');
      const teamAPlayers = setupState.players.filter(p => p.team === 'A');

      const r1 = placePlayerInSetup(setupState, teamAPlayers[0].id, { x: 6, y: 7 });
      expect(r1.success).toBe(true);

      // Try to place another player at the same position
      const r2 = placePlayerInSetup(r1.state, teamAPlayers[1].id, { x: 6, y: 7 });
      expect(r2.success).toBe(false);
    });

    it('devrait permettre le repositionnement d\'un joueur déjà placé', () => {
      const preMatch = createPreMatchState('A');
      const setupState = enterSetupPhase(preMatch, 'A');
      const teamAPlayers = setupState.players.filter(p => p.team === 'A');

      // Place player at (6, 7)
      const r1 = placePlayerInSetup(setupState, teamAPlayers[0].id, { x: 6, y: 7 });
      expect(r1.success).toBe(true);

      // Reposition to (6, 8)
      const r2 = placePlayerInSetup(r1.state, teamAPlayers[0].id, { x: 6, y: 8 });
      expect(r2.success).toBe(true);

      // Player should be at new position
      const player = r2.state.players.find(p => p.id === teamAPlayers[0].id);
      expect(player!.pos).toEqual({ x: 6, y: 8 });
    });
  });
});
