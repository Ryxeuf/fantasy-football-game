import { describe, it, expect, beforeEach } from 'vitest';
import { setup, type GameState, type Player, type RNG } from '../index';
import {
  BALL_AND_CHAIN_DIRECTIONS,
  canBallAndChain,
  rollBallAndChainDirection,
  executeBallAndChain,
  hasBallAndChain,
} from './ball-and-chain';

/**
 * Regle: Ball and Chain (Blood Bowl 2020 / BB3 Season 2/3).
 *
 * Resume:
 * - Le joueur avec Ball and Chain remplace son action de Mouvement par un
 *   deplacement automatique aleatoire.
 * - Jet de D8 (gabarit de direction aleatoire).
 * - Le joueur avance tout droit jusqu'a MA cases dans la direction tiree.
 * - S'il sort du terrain -> sort dans la foule (handleInjuryByCrowd) +
 *   turnover.
 * - S'il entre dans une case occupee par un adversaire -> Block automatique
 *   (la balle et chaine declenche un bloc, force au corps).
 * - S'il entre dans une case occupee par un coequipier -> activation terminee,
 *   le joueur reste a la case precedente.
 * - Apres l'action, pm = 0 (activation terminee).
 */

/** RNG deterministe qui repete la meme sequence de valeurs. */
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

describe('Regle: Ball and Chain', () => {
  let state: GameState;

  beforeEach(() => {
    state = setup();
  });

  describe('hasBallAndChain', () => {
    it('retourne false si le joueur n\'a pas le skill', () => {
      const player = state.players.find(p => p.id === 'A2')!;
      expect(hasBallAndChain(player)).toBe(false);
    });

    it('retourne true si le joueur possede ball-and-chain', () => {
      const player: Player = {
        ...state.players.find(p => p.id === 'A2')!,
        skills: ['ball-and-chain'],
      };
      expect(hasBallAndChain(player)).toBe(true);
    });
  });

  describe('BALL_AND_CHAIN_DIRECTIONS', () => {
    it('contient exactement 8 directions unitaires', () => {
      expect(BALL_AND_CHAIN_DIRECTIONS).toHaveLength(8);
      for (const dir of BALL_AND_CHAIN_DIRECTIONS) {
        expect(Math.abs(dir.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(dir.y)).toBeLessThanOrEqual(1);
        expect(dir.x === 0 && dir.y === 0).toBe(false);
      }
    });
  });

  describe('rollBallAndChainDirection', () => {
    it('retourne une des 8 directions du gabarit', () => {
      for (let i = 0; i < 8; i++) {
        // rng() retourne des valeurs uniformement dans [0, 1)
        // pour atteindre chaque index on passe i / 8 + petite marge
        const dir = rollBallAndChainDirection(scriptedRng([i / 8 + 0.01]));
        expect(BALL_AND_CHAIN_DIRECTIONS).toContainEqual(dir);
      }
    });

    it('mappe la valeur aleatoire sur un index [0, 8[', () => {
      // rng() = 0 -> premiere direction
      expect(rollBallAndChainDirection(scriptedRng([0]))).toEqual(BALL_AND_CHAIN_DIRECTIONS[0]);
      // rng() = 0.999 -> derniere direction
      expect(rollBallAndChainDirection(scriptedRng([0.999]))).toEqual(
        BALL_AND_CHAIN_DIRECTIONS[7],
      );
    });
  });

  describe('canBallAndChain', () => {
    it('retourne false si le joueur n\'a pas le skill', () => {
      expect(canBallAndChain(state, 'A2')).toBe(false);
    });

    it('retourne false si le joueur est stunned', () => {
      const s = patchPlayer(state, 'A2', { skills: ['ball-and-chain'], stunned: true });
      expect(canBallAndChain(s, 'A2')).toBe(false);
    });

    it('retourne false si ce n\'est pas le tour de son equipe', () => {
      const s = patchPlayer(state, 'B1', { skills: ['ball-and-chain'] });
      expect(canBallAndChain(s, 'B1')).toBe(false);
    });

    it('retourne true si le joueur a ball-and-chain, debout, dans son tour', () => {
      const s = patchPlayer(state, 'A2', { skills: ['ball-and-chain'] });
      expect(canBallAndChain(s, 'A2')).toBe(true);
    });

    it('retourne false si le joueur n\'existe pas', () => {
      expect(canBallAndChain(state, 'UNKNOWN')).toBe(false);
    });
  });

  describe('executeBallAndChain - deplacement libre', () => {
    it('avance de MA cases tout droit quand la route est libre', () => {
      // Placer le Fanatic au centre avec ma=3, loin de tout joueur.
      let s = patchPlayer(state, 'A2', {
        skills: ['ball-and-chain'],
        pos: { x: 5, y: 5 },
        ma: 3,
        pm: 3,
      });
      // Degager le terrain autour: deplacer tous les autres joueurs en zones isolees
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      // rng() = 0.3 -> index 2 -> Est (+1, 0)
      const rng = scriptedRng([0.3]);
      const newState = executeBallAndChain(s, 'A2', rng);

      const moved = newState.players.find(p => p.id === 'A2')!;
      expect(moved.pos).toEqual({ x: 8, y: 5 });
      expect(moved.pm).toBe(0);
    });

    it('apres l\'action, l\'activation est terminee (pm = 0)', () => {
      let s = patchPlayer(state, 'A2', {
        skills: ['ball-and-chain'],
        pos: { x: 5, y: 5 },
        ma: 2,
        pm: 2,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      const rng = scriptedRng([0.3]);
      const result = executeBallAndChain(s, 'A2', rng);
      const moved = result.players.find(p => p.id === 'A2')!;
      expect(moved.pm).toBe(0);
    });

    it('loggue une entree indiquant la direction tiree', () => {
      let s = patchPlayer(state, 'A2', {
        skills: ['ball-and-chain'],
        pos: { x: 5, y: 5 },
        ma: 1,
        pm: 1,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      const rng = scriptedRng([0.3]);
      const result = executeBallAndChain(s, 'A2', rng);
      const logMessages = result.gameLog.map(e => e.message).join('\n');
      expect(logMessages.toLowerCase()).toContain('chain');
    });
  });

  describe('executeBallAndChain - collisions', () => {
    it('s\'arrete sur la case precedant un coequipier (pas de turnover)', () => {
      // A2 a ball-and-chain en (5,5), A1 coequipier en (8,5). Direction Est.
      // Le Fanatic avance vers (6,5), (7,5), puis (8,5) est occupe -> stop en (7,5).
      let s = patchPlayer(state, 'A2', {
        skills: ['ball-and-chain'],
        pos: { x: 5, y: 5 },
        ma: 5,
        pm: 5,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 8, y: 5 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      const rng = scriptedRng([0.3]);
      const result = executeBallAndChain(s, 'A2', rng);

      const moved = result.players.find(p => p.id === 'A2')!;
      const mate = result.players.find(p => p.id === 'A1')!;
      expect(moved.pos).toEqual({ x: 7, y: 5 });
      expect(mate.pos).toEqual({ x: 8, y: 5 });
      expect(result.isTurnover).toBeFalsy();
    });

    it('declenche un Block quand il entre dans un adversaire', () => {
      // A2 a ball-and-chain en (5,5), B1 adversaire en (7,5). Direction Est.
      // Avance (6,5) vide, puis collision en (7,5) -> Block.
      let s = patchPlayer(state, 'A2', {
        skills: ['ball-and-chain'],
        pos: { x: 5, y: 5 },
        ma: 5,
        pm: 5,
        st: 7,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 7, y: 5 }, st: 2 });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });

      // rng: 0.3 pour la direction (Est), puis valeurs pour le bloc et push.
      // On passe des valeurs qui garantissent un POW (dice roll = 5 -> pow).
      const rng = scriptedRng([
        0.3, // direction
        5 / 6 - 0.001, // block die -> 5 -> POW
        0.5, // push choice (si demande)
        0.1, // armor die 1
        0.1, // armor die 2
      ]);

      const result = executeBallAndChain(s, 'A2', rng);
      // Un bloc doit avoir ete declenche : trace dans le log + collision
      // signalee ou jet de bloc/armure consecutif.
      const logText = result.gameLog.map(e => e.message).join('\n');
      expect(logText).toMatch(/percute|Block|bloc|Blocage/i);
    });

    it('sort dans la foule si la trajectoire quitte le terrain', () => {
      // A2 pres du bord ouest, direction Ouest (-1, 0) -> sort en (-1, 7).
      let s = patchPlayer(state, 'A2', {
        skills: ['ball-and-chain'],
        pos: { x: 0, y: 7 },
        ma: 3,
        pm: 3,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 25, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 1 } });

      // rng: 0.8 -> index 6 -> Ouest (-1, 0)
      const rng = scriptedRng([0.8, 0.5, 0.5, 0.5, 0.5]);
      const result = executeBallAndChain(s, 'A2', rng);

      // Le Fanatic quitte le terrain : sorti ou envoye au dugout.
      const fanatic = result.players.find(p => p.id === 'A2');
      // handleInjuryByCrowd deplace dans le dugout (state != 'active') ou retire du tableau.
      const removedOrInjured =
        fanatic === undefined ||
        fanatic.state === 'knocked_out' ||
        fanatic.state === 'casualty' ||
        fanatic.stunned === true;
      expect(removedOrInjured).toBe(true);
      // Turnover obligatoire quand le joueur actif sort du terrain.
      expect(result.isTurnover).toBe(true);
    });

    it('ne declenche pas de sortie si la trajectoire reste dans les limites', () => {
      let s = patchPlayer(state, 'A2', {
        skills: ['ball-and-chain'],
        pos: { x: 5, y: 7 },
        ma: 2,
        pm: 2,
      });
      s = patchPlayer(s, 'A1', { pos: { x: 25, y: 0 } });
      s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
      s = patchPlayer(s, 'B2', { pos: { x: 25, y: 1 } });

      // Est
      const rng = scriptedRng([0.3]);
      const result = executeBallAndChain(s, 'A2', rng);
      expect(result.isTurnover).toBeFalsy();
      const fanatic = result.players.find(p => p.id === 'A2')!;
      expect(fanatic.pos).toEqual({ x: 7, y: 7 });
    });
  });

  describe('executeBallAndChain - invariants', () => {
    it('ne fait rien si le joueur n\'a pas ball-and-chain (retourne state inchange)', () => {
      const before = state;
      const after = executeBallAndChain(before, 'A2', scriptedRng([0.3]));
      expect(after).toBe(before);
    });

    it('ne fait rien si le joueur est introuvable', () => {
      const before = state;
      const after = executeBallAndChain(before, 'UNKNOWN', scriptedRng([0.3]));
      expect(after).toBe(before);
    });
  });
});
