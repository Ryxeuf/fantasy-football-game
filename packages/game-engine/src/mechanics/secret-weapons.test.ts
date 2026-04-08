import { describe, it, expect } from 'vitest';
import { expelSecretWeapons, getSecretWeaponPlayers } from './secret-weapons';
import { initializeDugouts, movePlayerToDugoutZone } from './dugout';
import type { GameState, Player } from '../core/types';

function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'A1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Goblin Bomber',
    number: 1,
    position: 'Bombardier',
    ma: 6, st: 2, ag: 3, pa: 3, av: 7,
    skills: ['bombardier', 'dodge', 'secret-weapon', 'stunty'],
    pm: 6,
    state: 'active',
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
    turnTimerSeconds: 0,
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
    ...overrides,
  };
}

describe('Regle: Secret Weapons — expulsion en fin de drive', () => {
  describe('getSecretWeaponPlayers', () => {
    it('devrait identifier les joueurs avec secret-weapon qui ne sont pas déjà casualty/sent_off', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['secret-weapon', 'bombardier'] }),
          createTestPlayer({ id: 'A2', skills: ['block', 'dodge'], name: 'Lineman' }),
          createTestPlayer({ id: 'A3', skills: ['chainsaw', 'secret-weapon'], name: 'Chainsaw' }),
        ],
      });
      const result = getSecretWeaponPlayers(state, 'A');
      expect(result).toHaveLength(2);
      expect(result.map(p => p.id)).toContain('A1');
      expect(result.map(p => p.id)).toContain('A3');
    });

    it('ne devrait PAS inclure les joueurs déjà sent_off', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['secret-weapon'], state: 'sent_off', pos: { x: -1, y: -1 } }),
        ],
      });
      const result = getSecretWeaponPlayers(state, 'A');
      expect(result).toHaveLength(0);
    });

    it('ne devrait PAS inclure les joueurs déjà casualty', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['secret-weapon'], state: 'casualty', pos: { x: -1, y: -1 } }),
        ],
      });
      const result = getSecretWeaponPlayers(state, 'A');
      expect(result).toHaveLength(0);
    });

    it('devrait inclure les joueurs KO (ils sont expulsés depuis la KO box)', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['secret-weapon'], state: 'knocked_out', pos: { x: -1, y: -1 } }),
        ],
      });
      const result = getSecretWeaponPlayers(state, 'A');
      expect(result).toHaveLength(1);
    });
  });

  describe('expelSecretWeapons — sans bribe', () => {
    it('devrait expulser un joueur secret-weapon actif sur le terrain', () => {
      const state = createTestState();
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      const player = result.players.find(p => p.id === 'A1')!;
      expect(player.state).toBe('sent_off');
      expect(player.pos).toEqual({ x: -1, y: -1 });
    });

    it('devrait expulser les joueurs secret-weapon des DEUX équipes', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', team: 'A', skills: ['secret-weapon'] }),
          createTestPlayer({ id: 'B1', team: 'B', skills: ['secret-weapon', 'chainsaw'], name: 'B Chainsaw' }),
        ],
      });
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      expect(result.players.find(p => p.id === 'A1')!.state).toBe('sent_off');
      expect(result.players.find(p => p.id === 'B1')!.state).toBe('sent_off');
    });

    it('devrait expulser un joueur KO avec secret-weapon', () => {
      let state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['secret-weapon'], state: 'knocked_out', pos: { x: -1, y: -1 } }),
        ],
      });
      // Put player in KO dugout zone
      state = movePlayerToDugoutZone(state, 'A1', 'knockedOut', 'A');
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      const player = result.players.find(p => p.id === 'A1')!;
      expect(player.state).toBe('sent_off');
      // Player should be in sentOff zone, not knockedOut
      expect(result.dugouts.teamA.zones.sentOff.players).toContain('A1');
      expect(result.dugouts.teamA.zones.knockedOut.players).not.toContain('A1');
    });

    it('ne devrait PAS affecter les joueurs sans secret-weapon', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['block', 'dodge'], name: 'Lineman' }),
        ],
      });
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      expect(result.players.find(p => p.id === 'A1')!.state).toBe('active');
    });

    it('devrait ajouter un log pour chaque expulsion', () => {
      const state = createTestState();
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      const expulsionLogs = result.gameLog.filter(log =>
        log.message.includes('Arme Secrète') || log.message.includes('Secret Weapon')
      );
      expect(expulsionLogs).toHaveLength(1);
      expect(expulsionLogs[0].playerId).toBe('A1');
    });
  });

  describe('expelSecretWeapons — avec bribe', () => {
    it('devrait utiliser un bribe et sauver le joueur (jet 2+)', () => {
      const state = createTestState({
        bribesRemaining: { teamA: 1, teamB: 0 },
      });
      // RNG: 0.5 → D6 = 4 (success, 2+ needed)
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      const player = result.players.find(p => p.id === 'A1')!;
      expect(player.state).not.toBe('sent_off');
      expect(result.bribesRemaining.teamA).toBe(0); // Bribe consumed
    });

    it('devrait consommer le bribe même si le jet échoue (jet = 1)', () => {
      const state = createTestState({
        bribesRemaining: { teamA: 1, teamB: 0 },
      });
      // RNG: 0.001 → D6 = 1 (failure)
      const rng = () => 0.001;
      const result = expelSecretWeapons(state, rng);

      const player = result.players.find(p => p.id === 'A1')!;
      expect(player.state).toBe('sent_off'); // Still expelled
      expect(result.bribesRemaining.teamA).toBe(0); // Bribe consumed
    });

    it('devrait utiliser les bribes pour plusieurs joueurs', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['secret-weapon', 'bombardier'] }),
          createTestPlayer({ id: 'A2', skills: ['secret-weapon', 'chainsaw'], name: 'Chainsaw' }),
        ],
        bribesRemaining: { teamA: 2, teamB: 0 },
      });
      // All rolls succeed (0.5 → D6 = 4)
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      expect(result.players.find(p => p.id === 'A1')!.state).not.toBe('sent_off');
      expect(result.players.find(p => p.id === 'A2')!.state).not.toBe('sent_off');
      expect(result.bribesRemaining.teamA).toBe(0);
    });

    it('ne devrait utiliser qu\'un seul bribe quand il n\'y en a qu\'un pour 2 joueurs', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', skills: ['secret-weapon', 'bombardier'] }),
          createTestPlayer({ id: 'A2', skills: ['secret-weapon', 'chainsaw'], name: 'Chainsaw' }),
        ],
        bribesRemaining: { teamA: 1, teamB: 0 },
      });
      // Roll succeeds (0.5 → D6 = 4)
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      // First player saved by bribe, second expelled
      expect(result.bribesRemaining.teamA).toBe(0);
      const sentOffCount = result.players.filter(p => p.state === 'sent_off').length;
      expect(sentOffCount).toBe(1); // One expelled, one saved
    });

    it('devrait utiliser les bribes par équipe indépendamment', () => {
      const state = createTestState({
        players: [
          createTestPlayer({ id: 'A1', team: 'A', skills: ['secret-weapon'] }),
          createTestPlayer({ id: 'B1', team: 'B', skills: ['secret-weapon'], name: 'B Bomber' }),
        ],
        bribesRemaining: { teamA: 1, teamB: 0 },
      });
      const rng = () => 0.5; // D6 = 4 (success)
      const result = expelSecretWeapons(state, rng);

      // Team A player saved by bribe
      expect(result.players.find(p => p.id === 'A1')!.state).not.toBe('sent_off');
      // Team B player expelled (no bribe)
      expect(result.players.find(p => p.id === 'B1')!.state).toBe('sent_off');
    });

    it('devrait ajouter un log pour l\'utilisation du bribe réussie', () => {
      const state = createTestState({
        bribesRemaining: { teamA: 1, teamB: 0 },
      });
      const rng = () => 0.5;
      const result = expelSecretWeapons(state, rng);

      const bribeLogs = result.gameLog.filter(log =>
        log.message.includes('pot-de-vin') || log.message.includes('Bribe')
      );
      expect(bribeLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('devrait ajouter un log pour l\'utilisation du bribe échouée', () => {
      const state = createTestState({
        bribesRemaining: { teamA: 1, teamB: 0 },
      });
      const rng = () => 0.001; // D6 = 1
      const result = expelSecretWeapons(state, rng);

      const bribeLogs = result.gameLog.filter(log =>
        log.message.includes('pot-de-vin') || log.message.includes('Bribe')
      );
      expect(bribeLogs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
