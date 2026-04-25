/**
 * Tests pour les helpers de logging.
 *
 * Le but de ces helpers est d'optimiser la taille du GameState lors de la
 * sérialisation (broadcasts WebSocket, persistance, etc.) en séparant le
 * `gameLog` (qui peut grossir significativement au cours d'un match) du
 * reste de l'état.
 */

import { describe, it, expect } from 'vitest';
import {
  createLogEntry,
  addLogEntry,
  stripGameLog,
  attachGameLog,
  truncateGameLog,
  getRecentLogEntries,
} from './logging';
import type { GameLogEntry, GameState } from '../core/types';

function makeState(log: GameLogEntry[] = []): GameState {
  return {
    width: 26,
    height: 15,
    players: [],
    currentPlayer: 'A',
    turn: 1,
    selectedPlayerId: null,
    isTurnover: false,
    apothecaryAvailable: { teamA: true, teamB: true },
    dugouts: {
      teamA: {
        teamId: 'A',
        zones: {
          reserves: { id: 'A-reserves', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 'A-stunned', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'A-ko', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'A-cas', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'A-off', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
      teamB: {
        teamId: 'B',
        zones: {
          reserves: { id: 'B-reserves', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          stunned: { id: 'B-stunned', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          knockedOut: { id: 'B-ko', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          casualty: { id: 'B-cas', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
          sentOff: { id: 'B-off', name: '', color: '', icon: '', maxCapacity: 0, players: [], position: { x: 0, y: 0, width: 0, height: 0 } },
        },
      },
    },
    playerActions: {},
    teamBlitzCount: {},
    teamFoulCount: {},
    gamePhase: 'playing',
    half: 1,
    score: { teamA: 0, teamB: 0 },
    teamNames: { teamA: 'A', teamB: 'B' },
    teamRerolls: { teamA: 3, teamB: 3 },
    rerollUsedThisTurn: false,
    matchStats: {},
    casualtyResults: {},
    lastingInjuryDetails: {},
    turnTimerSeconds: 0,
    gameLog: log,
    usedStarPlayerRules: {},
    bribesRemaining: { teamA: 0, teamB: 0 },
  };
}

describe('logging helpers', () => {
  describe('createLogEntry', () => {
    it('crée une entrée avec id, timestamp et type', () => {
      const e = createLogEntry('info', 'hello');
      expect(e.id).toMatch(/^log-/);
      expect(e.timestamp).toBeGreaterThan(0);
      expect(e.type).toBe('info');
      expect(e.message).toBe('hello');
    });
  });

  describe('addLogEntry', () => {
    it('ajoute une entrée sans muter l\'état', () => {
      const s1 = makeState();
      const e = createLogEntry('info', 'first');
      const s2 = addLogEntry(s1, e);
      expect(s1.gameLog).toHaveLength(0);
      expect(s2.gameLog).toHaveLength(1);
      expect(s2).not.toBe(s1);
    });
  });

  describe('stripGameLog', () => {
    it('renvoie l\'état sans le champ gameLog', () => {
      const s = makeState([createLogEntry('info', 'a'), createLogEntry('info', 'b')]);
      const stripped = stripGameLog(s);
      expect('gameLog' in stripped).toBe(false);
      expect(stripped.turn).toBe(s.turn);
      expect(stripped.currentPlayer).toBe(s.currentPlayer);
    });

    it('ne mute pas l\'état d\'origine', () => {
      const s = makeState([createLogEntry('info', 'a')]);
      stripGameLog(s);
      expect(s.gameLog).toHaveLength(1);
    });
  });

  describe('attachGameLog', () => {
    it('réattache un log à un état strippé', () => {
      const s = makeState([createLogEntry('info', 'orig')]);
      const stripped = stripGameLog(s);
      const log = [createLogEntry('info', 'new1'), createLogEntry('info', 'new2')];
      const reattached = attachGameLog(stripped, log);
      expect(reattached.gameLog).toEqual(log);
      expect(reattached.turn).toBe(s.turn);
    });
  });

  describe('truncateGameLog', () => {
    it('garde uniquement les N dernières entrées', () => {
      const entries = Array.from({ length: 10 }, (_, i) =>
        createLogEntry('info', `msg-${i}`),
      );
      const s = makeState(entries);
      const t = truncateGameLog(s, 3);
      expect(t.gameLog).toHaveLength(3);
      expect(t.gameLog[0].message).toBe('msg-7');
      expect(t.gameLog[2].message).toBe('msg-9');
    });

    it('renvoie l\'état tel quel si gameLog est plus court que la limite', () => {
      const entries = [createLogEntry('info', 'only')];
      const s = makeState(entries);
      const t = truncateGameLog(s, 100);
      expect(t.gameLog).toEqual(entries);
    });

    it('ne mute pas l\'état d\'origine', () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        createLogEntry('info', `msg-${i}`),
      );
      const s = makeState(entries);
      truncateGameLog(s, 2);
      expect(s.gameLog).toHaveLength(5);
    });

    it('lève une erreur si maxEntries est négatif', () => {
      const s = makeState([createLogEntry('info', 'x')]);
      expect(() => truncateGameLog(s, -1)).toThrow();
    });
  });

  describe('getRecentLogEntries', () => {
    it('renvoie les N dernières entrées du log', () => {
      const entries = Array.from({ length: 6 }, (_, i) =>
        createLogEntry('info', `msg-${i}`),
      );
      const s = makeState(entries);
      const recent = getRecentLogEntries(s, 2);
      expect(recent).toHaveLength(2);
      expect(recent[0].message).toBe('msg-4');
      expect(recent[1].message).toBe('msg-5');
    });

    it('renvoie toutes les entrées si count >= taille', () => {
      const entries = [createLogEntry('info', 'a'), createLogEntry('info', 'b')];
      const s = makeState(entries);
      expect(getRecentLogEntries(s, 10)).toEqual(entries);
    });

    it('renvoie un tableau vide si count = 0', () => {
      const s = makeState([createLogEntry('info', 'a')]);
      expect(getRecentLogEntries(s, 0)).toEqual([]);
    });
  });
});
