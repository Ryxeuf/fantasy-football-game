import { describe, it, expect } from 'vitest';

import { makePlayer, baseState } from '../__tests__/helpers';
import {
  findPlayerById,
  getActiveTeamPlayers,
  getBallCarrier,
  getPlayerMap,
  getTeamPlayers,
  __resetStateCache,
} from './state-cache';

describe('state-cache', () => {
  describe('findPlayerById / getPlayerMap', () => {
    it('retourne le joueur correspondant a un id existant', () => {
      const p1 = makePlayer({ id: 'p1' });
      const p2 = makePlayer({ id: 'p2', team: 'B' });
      const state = baseState([p1, p2]);
      expect(findPlayerById(state, 'p1')).toBe(p1);
      expect(findPlayerById(state, 'p2')).toBe(p2);
    });

    it("retourne undefined pour un id inexistant", () => {
      const state = baseState([makePlayer({ id: 'p1' })]);
      expect(findPlayerById(state, 'unknown')).toBeUndefined();
    });

    it('memoise la map sur la meme reference de players array', () => {
      const state = baseState([makePlayer({ id: 'p1' })]);
      const first = getPlayerMap(state);
      const second = getPlayerMap(state);
      expect(second).toBe(first);
    });

    it('invalide le cache quand le players array change', () => {
      const p1 = makePlayer({ id: 'p1' });
      const state = baseState([p1]);
      const map1 = getPlayerMap(state);
      const p1Updated = { ...p1, pm: 0 };
      const next = { ...state, players: [p1Updated] };
      const map2 = getPlayerMap(next);
      expect(map2).not.toBe(map1);
      expect(map2.get('p1')).toBe(p1Updated);
    });
  });

  describe('getTeamPlayers', () => {
    it('retourne uniquement les joueurs de l equipe demandee', () => {
      const a1 = makePlayer({ id: 'a1', team: 'A' });
      const a2 = makePlayer({ id: 'a2', team: 'A' });
      const b1 = makePlayer({ id: 'b1', team: 'B' });
      const state = baseState([a1, b1, a2]);
      expect(getTeamPlayers(state, 'A')).toEqual([a1, a2]);
      expect(getTeamPlayers(state, 'B')).toEqual([b1]);
    });

    it('memoise et retourne la meme reference sur appels successifs', () => {
      const state = baseState([
        makePlayer({ id: 'a1', team: 'A' }),
        makePlayer({ id: 'b1', team: 'B' }),
      ]);
      expect(getTeamPlayers(state, 'A')).toBe(getTeamPlayers(state, 'A'));
    });
  });

  describe('getActiveTeamPlayers', () => {
    it('exclut KO, casualty, sent_off et stunned', () => {
      const active = makePlayer({ id: 'active', team: 'A', state: 'active' });
      const stunned = makePlayer({ id: 'stunned', team: 'A', state: 'active', stunned: true });
      const ko = makePlayer({ id: 'ko', team: 'A', state: 'knocked_out' });
      const cas = makePlayer({ id: 'cas', team: 'A', state: 'casualty' });
      const sent = makePlayer({ id: 'sent', team: 'A', state: 'sent_off' });
      const state = baseState([active, stunned, ko, cas, sent]);
      expect(getActiveTeamPlayers(state, 'A')).toEqual([active]);
    });

    it('inclut les joueurs avec state undefined (legacy fixtures)', () => {
      const p = makePlayer({ id: 'legacy', team: 'A' });
      // Reproduire un Player sans champ `state` (utilise dans des fixtures
      // anciennes pre-PlayerState).
      const legacy = { ...p, state: undefined } as typeof p;
      const state = baseState([legacy]);
      expect(getActiveTeamPlayers(state, 'A')).toEqual([legacy]);
    });
  });

  describe('getBallCarrier', () => {
    it('retourne le porteur quand un joueur a le ballon', () => {
      const carrier = makePlayer({ id: 'carrier', hasBall: true });
      const other = makePlayer({ id: 'other' });
      const state = baseState([other, carrier]);
      expect(getBallCarrier(state)).toBe(carrier);
    });

    it('retourne undefined quand aucun joueur n a la balle', () => {
      const state = baseState([makePlayer({ id: 'p1' })]);
      expect(getBallCarrier(state)).toBeUndefined();
    });

    it('cache aussi l absence (pas de re-scan)', () => {
      const state = baseState([makePlayer({ id: 'p1' })]);
      expect(getBallCarrier(state)).toBeUndefined();
      expect(getBallCarrier(state)).toBeUndefined();
      __resetStateCache(state);
      expect(getBallCarrier(state)).toBeUndefined();
    });
  });
});
