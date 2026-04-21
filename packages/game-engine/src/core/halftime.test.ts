import { describe, it, expect } from 'vitest';
import { setup, advanceHalfIfNeeded, startKickoffSequence, placeKickoffBall, calculateKickDeviation, resolveKickoffEvent, startMatchFromKickoff } from './game-state';
import { applyMove } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import type { ExtendedGameState, GameState, TeamId } from './types';

/**
 * Helper: creates a state at end of half 1 (turn > 8) ready for halftime transition.
 */
function createHalftimeState(overrides?: Partial<GameState>): GameState {
  const base = setup();
  return {
    ...base,
    gamePhase: 'playing' as const,
    half: 1,
    turn: 9, // Just past turn 8 → triggers halftime
    currentPlayer: 'A' as TeamId,
    kickingTeam: 'A' as TeamId,
    score: { teamA: 0, teamB: 0 },
    ...overrides,
  };
}

describe('Règle: Mi-temps complète (B1.7)', () => {
  describe('advanceHalfIfNeeded — half 1 → half 2', () => {
    it('devrait passer à la 2e mi-temps quand turn > 8 et half === 1', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-basic');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.half).toBe(2);
      expect(result.turn).toBe(1);
      expect(result.gamePhase).toBe('halftime');
    });

    it('devrait inverser les équipes de kick/réception', () => {
      const state = createHalftimeState({ kickingTeam: 'A' as TeamId });
      const rng = makeRNG('halftime-swap');
      const result = advanceHalfIfNeeded(state, rng);

      // A kicked in half 1 → B kicks in half 2
      expect(result.kickingTeam).toBe('B');
      expect(result.currentPlayer).toBe('A'); // receiving team plays first
    });

    it('ne devrait pas placer la balle (kickoff se fait après re-setup)', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-ball');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.ball).toBeUndefined();
    });

    it('devrait entrer en phase de setup pour le re-placement', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-setup');
      const result = advanceHalfIfNeeded(state, rng) as ExtendedGameState;

      expect(result.preMatch?.phase).toBe('setup');
      expect(result.preMatch?.currentCoach).toBe('A'); // receiving team places first
      expect(result.preMatch?.receivingTeam).toBe('A');
      expect(result.preMatch?.kickingTeam).toBe('B');
      expect(result.preMatch?.placedPlayers).toEqual([]);
    });

    it('devrait remettre tous les joueurs actifs hors terrain (pos.x === -1)', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-positions');
      const result = advanceHalfIfNeeded(state, rng);

      const activePlayers = result.players.filter(p => !p.state || p.state === 'active');
      for (const player of activePlayers) {
        expect(player.pos.x).toBe(-1);
        expect(player.pos.y).toBe(-1);
      }
    });

    it('devrait réinitialiser les compteurs d\'actions', () => {
      const state = createHalftimeState({
        playerActions: { A1: 'MOVE', A2: 'BLOCK' } as Record<string, any>,
        teamBlitzCount: { A: 1 } as Record<string, number>,
        teamFoulCount: { A: 1 } as Record<string, number>,
        rerollUsedThisTurn: true,
      });
      const rng = makeRNG('halftime-reset');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.playerActions).toEqual({});
      expect(result.teamBlitzCount).toEqual({});
      expect(result.teamFoulCount).toEqual({});
      expect(result.rerollUsedThisTurn).toBe(false);
      expect(result.isTurnover).toBe(false);
    });

    it('devrait réinitialiser PM et GFI des joueurs actifs', () => {
      const state = createHalftimeState({
        players: setup().players.map(p => ({
          ...p,
          pm: 0,
          gfiUsed: 2,
          stunned: true,
        })),
      });
      const rng = makeRNG('halftime-pm');
      const result = advanceHalfIfNeeded(state, rng);

      for (const player of result.players) {
        expect(player.pm).toBe(player.ma);
        expect(player.gfiUsed).toBe(0);
        expect(player.stunned).toBe(false);
      }
    });

    it('ne devrait PAS rouler d\'événement de kickoff avant le re-setup', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-no-immediate-kickoff');
      const result = advanceHalfIfNeeded(state, rng) as ExtendedGameState;

      // Le kickoff event sera déclenché après validatePlayerPlacement → startKickoffSequence
      expect(result.preMatch?.kickoffEvent).toBeFalsy();
      expect(result.preMatch?.kickoffStep).toBeFalsy();
    });

    it('devrait ajouter un log de mi-temps', () => {
      const state = createHalftimeState();
      const rng = makeRNG('halftime-log');
      const result = advanceHalfIfNeeded(state, rng);

      const halftimeLogs = result.gameLog.filter(
        log => log.message.includes('Mi-temps') || log.message.includes('mi-temps')
      );
      expect(halftimeLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('devrait conserver le score après la mi-temps', () => {
      const state = createHalftimeState({
        score: { teamA: 2, teamB: 1 },
      });
      const rng = makeRNG('halftime-score');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.score).toEqual({ teamA: 2, teamB: 1 });
    });

    it('devrait conserver la météo active', () => {
      const state = createHalftimeState({
        weatherCondition: { condition: 'Nice', description: 'Beau temps' },
      });
      const rng = makeRNG('halftime-weather');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.weatherCondition).toEqual({ condition: 'Nice', description: 'Beau temps' });
    });

    it('devrait conserver matchStats et casualtyResults', () => {
      const state = createHalftimeState({
        matchStats: { A1: { td: 1, blocks: 3 } } as any,
        casualtyResults: { A2: 'bh' } as any,
      });
      const rng = makeRNG('halftime-stats');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.matchStats).toEqual({ A1: { td: 1, blocks: 3 } });
      expect(result.casualtyResults).toEqual({ A2: 'bh' });
    });

    it('devrait tenter de récupérer les joueurs KO', () => {
      const base = setup();
      const state = createHalftimeState({
        players: base.players.map(p =>
          p.id === 'A2'
            ? { ...p, state: 'knocked_out' as const }
            : p
        ),
        dugouts: {
          ...base.dugouts,
          teamA: {
            ...base.dugouts.teamA,
            zones: {
              ...base.dugouts.teamA.zones,
              knockedOut: {
                ...base.dugouts.teamA.zones.knockedOut,
                players: ['A2'],
              },
            },
          },
        },
      });

      // Run multiple times with different seeds to verify KO recovery can happen
      let recoveredAtLeastOnce = false;
      for (let i = 0; i < 20; i++) {
        const rng = makeRNG(`halftime-ko-${i}`);
        const result = advanceHalfIfNeeded(state, rng);
        const koZone = result.dugouts.teamA.zones.knockedOut;
        if (!koZone.players.includes('A2')) {
          recoveredAtLeastOnce = true;
          expect(result.dugouts.teamA.zones.reserves.players).toContain('A2');
          break;
        }
      }
      expect(recoveredAtLeastOnce).toBe(true);
    });
  });

  describe('advanceHalfIfNeeded — half 2 → end', () => {
    it('devrait terminer le match quand turn > 8 et half === 2', () => {
      const state = createHalftimeState({ half: 2 });
      const rng = makeRNG('end-match');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.gamePhase).toBe('ended');
    });
  });

  describe('advanceHalfIfNeeded — no transition', () => {
    it('ne devrait rien changer si turn <= 8', () => {
      const state = createHalftimeState({ turn: 8 });
      const rng = makeRNG('no-halftime');
      const result = advanceHalfIfNeeded(state, rng);

      expect(result.half).toBe(1);
      expect(result.turn).toBe(8);
    });
  });

  describe('END_TURN trigger halftime', () => {
    it('devrait déclencher la mi-temps via END_TURN quand turn passe à 9', () => {
      // Set up state at turn 8, player B's turn (B's END_TURN increments turn 8→9)
      const base = setup();
      const state: GameState = {
        ...base,
        gamePhase: 'playing' as const,
        half: 1,
        turn: 8,
        currentPlayer: 'B' as TeamId,
        kickingTeam: 'A' as TeamId,
      };
      const rng = makeRNG('end-turn-halftime');
      const result = applyMove(state, { type: 'END_TURN' }, rng) as ExtendedGameState;

      expect(result.half).toBe(2);
      expect(result.turn).toBe(1);
      expect(result.gamePhase).toBe('halftime');
      expect(result.preMatch?.phase).toBe('setup');
    });
  });

  describe('Flux complet mi-temps → re-setup → re-kickoff → half 2 jouable', () => {
    it('devrait permettre de jouer après setup des 2 équipes et résolution du kickoff', () => {
      // 1. Départ fin de 1ère mi-temps avec matchStats et casualties accumulés
      const base = setup();
      const halftimeStart: GameState = {
        ...base,
        gamePhase: 'playing',
        half: 1,
        turn: 9,
        currentPlayer: 'A',
        kickingTeam: 'A',
        score: { teamA: 1, teamB: 0 },
        matchStats: { A1: { td: 1, blocks: 3 } } as any,
        casualtyResults: { B2: 'bh' } as any,
        weatherCondition: { condition: 'Nice', description: 'Beau temps' },
      };
      const rng = makeRNG('full-halftime-flow');

      // 2. Transition mi-temps
      let state = advanceHalfIfNeeded(halftimeStart, rng) as ExtendedGameState;
      expect(state.gamePhase).toBe('halftime');
      expect(state.preMatch?.phase).toBe('setup');
      expect(state.preMatch?.currentCoach).toBe('A'); // A reçoit (kickingTeam swap)
      expect(state.ball).toBeUndefined();
      // Les joueurs sont hors-terrain en attendant le re-setup
      expect(state.players.every(p => p.pos.x === -1)).toBe(true);

      // 3. Simuler le re-setup complet (shortcut : placer directement tous les
      //    joueurs et faire avancer la phase à 'kickoff'). On n'a que 2 joueurs
      //    par équipe dans setup() donc on bypasse validatePlayerPlacement.
      state = {
        ...state,
        players: state.players.map(p =>
          p.team === 'A' ? { ...p, pos: { x: 6, y: 7 } } : { ...p, pos: { x: 20, y: 7 } }
        ),
        preMatch: {
          ...state.preMatch,
          phase: 'kickoff' as const,
        },
      } as ExtendedGameState;

      // 4. Démarrer la séquence kickoff
      state = startKickoffSequence(state);
      expect(state.preMatch?.phase).toBe('kickoff-sequence');
      expect(state.preMatch?.kickoffStep).toBe('place-ball');

      // 5. Placer la balle (dans la moitié receveuse = équipe A → x=1..12)
      state = placeKickoffBall(state, { x: 6, y: 7 });
      expect(state.preMatch?.kickoffStep).toBe('kick-deviation');

      // 6. Déviation du kick
      state = calculateKickDeviation(state, rng);
      expect(state.preMatch?.kickoffStep).toBe('kickoff-event');

      // 7. Événement kickoff
      state = resolveKickoffEvent(state, rng);
      expect(state.preMatch?.kickoffEvent).toBeTruthy();

      // 8. Démarrer (resume) la 2e mi-temps
      const finalState = startMatchFromKickoff(state, rng);
      expect(finalState.half).toBe(2);
      expect(finalState.turn).toBe(1);
      expect(finalState.gamePhase).toBe('playing');
      expect(finalState.currentPlayer).toBe('A'); // équipe receveuse joue en premier
      expect(finalState.score).toEqual({ teamA: 1, teamB: 0 }); // score conservé
      expect(finalState.ball).toBeDefined();
      expect((finalState as ExtendedGameState).preMatch).toBeUndefined();

      // Stats et blessures conservées après la mi-temps
      expect(finalState.matchStats).toEqual({ A1: { td: 1, blocks: 3 } });
      expect(finalState.casualtyResults).toEqual({ B2: 'bh' });
      expect(finalState.weatherCondition).toEqual({ condition: 'Nice', description: 'Beau temps' });
    });
  });
});
