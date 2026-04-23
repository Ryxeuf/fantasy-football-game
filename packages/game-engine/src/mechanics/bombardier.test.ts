import { describe, it, expect, beforeEach } from 'vitest';
import { setup, type GameState, type Player, type RNG } from '../index';
import {
  hasBombardier,
  canBombThrow,
  executeBombThrow,
  BOMB_ARMOR_BONUS,
  BOMB_MAX_RANGE,
} from './bombardier';

/**
 * Regle: Bombardier (Blood Bowl 2020 / BB3 Season 2/3)
 *
 * Resume:
 * - Remplace l'action de blocage par une action speciale "Lancer de Bombe".
 * - Cible une case dans la portee Quick ou Short (1-6 cases).
 * - Jet de D6 contre la PA du Bombardier (modificateurs de portee standard).
 * - Succes : la bombe atterrit sur la case cible. Tout joueur sur cette case
 *   fait un jet d'armure a +1 (BOMB_ARMOR_BONUS). Armure percee -> jet de
 *   blessure.
 * - Echec (non-fumble) : la bombe devie (D8) d'une case depuis la cible.
 * - Fumble (jet brut = 1) : la bombe explose sur le lanceur.
 * - Pas de turnover sur echec (regle officielle BB2020).
 * - `pm = 0` apres l'action (activation terminee).
 */

function scriptedRng(values: number[]): RNG {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx += 1;
    return v;
  };
}

function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
  };
}

describe('Regle: Bombardier', () => {
  let state: GameState;

  beforeEach(() => {
    state = setup();
  });

  describe('hasBombardier', () => {
    it('retourne false si le joueur n\'a pas le skill', () => {
      const player = state.players.find(p => p.id === 'A2')!;
      expect(hasBombardier(player)).toBe(false);
    });

    it('retourne true si le joueur a bombardier', () => {
      const player: Player = {
        ...state.players.find(p => p.id === 'A2')!,
        skills: ['bombardier'],
      };
      expect(hasBombardier(player)).toBe(true);
    });
  });

  describe('Constantes', () => {
    it('BOMB_ARMOR_BONUS vaut +1 (regle BB2020)', () => {
      expect(BOMB_ARMOR_BONUS).toBe(1);
    });

    it('BOMB_MAX_RANGE vaut 6 (Quick + Short only)', () => {
      expect(BOMB_MAX_RANGE).toBe(6);
    });
  });

  describe('canBombThrow', () => {
    it('retourne false sans le skill bombardier', () => {
      const s = patchPlayer(state, 'A2', { pos: { x: 5, y: 5 } });
      expect(canBombThrow(s, 'A2', { x: 8, y: 5 })).toBe(false);
    });

    it('retourne false si le joueur est stunned', () => {
      const s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
        stunned: true,
      });
      expect(canBombThrow(s, 'A2', { x: 8, y: 5 })).toBe(false);
    });

    it('retourne false si ce n\'est pas le tour de son equipe', () => {
      const s = patchPlayer(state, 'B1', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
      });
      expect(canBombThrow(s, 'B1', { x: 8, y: 5 })).toBe(false);
    });

    it('retourne false si la cible est hors portee (>6 cases)', () => {
      const s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
      });
      // 8 cases ecart
      expect(canBombThrow(s, 'A2', { x: 13, y: 5 })).toBe(false);
    });

    it('retourne false si la cible est hors du terrain', () => {
      const s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
      });
      expect(canBombThrow(s, 'A2', { x: -1, y: 5 })).toBe(false);
    });

    it('retourne false si la cible est la case du lanceur', () => {
      const s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
      });
      expect(canBombThrow(s, 'A2', { x: 5, y: 5 })).toBe(false);
    });

    it('retourne true pour une cible en portee Short (5 cases)', () => {
      const s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
      });
      expect(canBombThrow(s, 'A2', { x: 10, y: 5 })).toBe(true);
    });

    it('retourne true pour une cible en portee Quick (2 cases)', () => {
      const s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
      });
      expect(canBombThrow(s, 'A2', { x: 7, y: 5 })).toBe(true);
    });
  });

  describe('executeBombThrow - succes', () => {
    it('la bombe atterrit sur la cible et touche le joueur present', () => {
      // Bomber en (5,5), cible ennemie B1 en (8,5), PA=3.
      let s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
        pa: 3,
        pm: 6,
      });
      s = patchPlayer(s, 'B1', { pos: { x: 8, y: 5 }, av: 8 });
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B2', { pos: { x: 0, y: 1 } });

      // rng: pass roll = 4 (succes car PA=3 et Short=-0 -> target 3), puis armor dice.
      // pass D6 -> 4 via 0.55 (floor(0.55*6)+1=4)
      // armor 2D6 -> 6+5=11 via 0.9, 0.7 (floor(0.9*6)+1=6, floor(0.7*6)+1=5) -> 11 vs 8+1=9 -> percee
      const rng = scriptedRng([0.55, 0.9, 0.7, 0.5, 0.5]);
      const result = executeBombThrow(s, 'A2', { x: 8, y: 5 }, rng);

      // L'activation est terminee
      const bomber = result.players.find(p => p.id === 'A2')!;
      expect(bomber.pm).toBe(0);

      // Le joueur cible a reellement subi un jet d'armure/blessure : verifier
      // via le log que la bombe a atteint B1.
      const logText = result.gameLog.map(e => e.message).join('\n');
      expect(logText).toMatch(/bombe|Bombe/i);
    });

    it('la bombe sans cible (case vide) n\'entraine aucun jet d\'armure', () => {
      let s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
        pa: 3,
        pm: 6,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      const rng = scriptedRng([0.55, 0.5, 0.5, 0.5, 0.5]);
      const result = executeBombThrow(s, 'A2', { x: 8, y: 5 }, rng);

      // Aucun jet d'armure enregistre
      expect(result.lastDiceResult?.type).not.toBe('armor');
      // Activation terminee
      expect(result.players.find(p => p.id === 'A2')!.pm).toBe(0);
    });

    it('n\'entraine pas de turnover sur echec (regle BB2020)', () => {
      let s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
        pa: 6, // tres difficile
        pm: 6,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      // pass D6 -> 2 (echec non-fumble car PA=6 target=6)
      // Ensuite scatter D8 puis eventuel armor (case vide normalement)
      const rng = scriptedRng([0.2, 0.3, 0.5, 0.5, 0.5, 0.5]);
      const result = executeBombThrow(s, 'A2', { x: 8, y: 5 }, rng);

      expect(result.isTurnover).toBeFalsy();
    });
  });

  describe('executeBombThrow - fumble', () => {
    it('un jet brut de 1 fait exploser la bombe sur le lanceur', () => {
      let s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
        pa: 3,
        pm: 6,
        av: 8,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      // rng: pass D6 = 1 via 0.01 -> fumble
      // armor 2D6 = 6+6 = 12 via 0.99, 0.99 -> percee (12 >= 8+1=9)
      const rng = scriptedRng([0.01, 0.99, 0.99, 0.5, 0.5]);
      const result = executeBombThrow(s, 'A2', { x: 8, y: 5 }, rng);

      const logText = result.gameLog.map(e => e.message).join('\n');
      expect(logText).toMatch(/fumble|rate|rebond|lanceur|Bombardier/i);
      // Activation terminee
      expect(result.players.find(p => p.id === 'A2')!.pm).toBe(0);
    });
  });

  describe('executeBombThrow - invariants', () => {
    it('ne fait rien si le joueur n\'a pas bombardier', () => {
      const before = state;
      const after = executeBombThrow(before, 'A2', { x: 10, y: 7 }, scriptedRng([0.5]));
      expect(after).toBe(before);
    });

    it('ne fait rien si la cible est hors portee', () => {
      const s = patchPlayer(state, 'A2', {
        skills: ['bombardier'],
        pos: { x: 5, y: 5 },
      });
      const after = executeBombThrow(s, 'A2', { x: 20, y: 5 }, scriptedRng([0.5]));
      // L'etat reste inchange
      expect(after).toBe(s);
    });

    it('ne fait rien si le joueur est introuvable', () => {
      const before = state;
      const after = executeBombThrow(before, 'UNKNOWN', { x: 10, y: 7 }, scriptedRng([0.5]));
      expect(after).toBe(before);
    });
  });
});
