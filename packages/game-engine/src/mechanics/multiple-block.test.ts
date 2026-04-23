import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  applyMove,
  makeRNG,
  calculateBlockDiceCount,
  type GameState,
  type Player,
} from '../index';
import {
  hasMultipleBlock,
  canPerformMultipleBlock,
  findMultipleBlockTargets,
  MULTIPLE_BLOCK_ST_PENALTY,
} from './multiple-block';

/**
 * Regle: Multiple Block (Blood Bowl 2020 / BB3 Season 2/3)
 *
 * "Once per team turn, when a player with this skill takes a Block action, they
 *  may decide to Block two opposing players that are both in squares adjacent
 *  to them. Apply a -2 modifier to the active player's Strength for each of
 *  these Blocks. Both Blocks are performed one after the other in the same
 *  sequence."
 *
 * Notes d'implementation :
 *  - Ne fonctionne PAS pendant une action de Blitz.
 *  - Une seule utilisation par tour d'equipe.
 *  - Les deux cibles doivent etre adjacentes a l'attaquant au moment de la
 *    declaration. Apres le follow-up du premier bloc, si la deuxieme cible
 *    n'est plus adjacente, le second bloc est annule.
 *  - Un turnover issu du premier bloc interrompt la sequence : pas de second
 *    bloc.
 */

function arrangeThreePlayers(
  baseState: GameState,
  attackerSkills: string[],
  opts: { firstOnly?: boolean; secondOnly?: boolean; movedAwaySecond?: boolean } = {},
): GameState {
  // Attacker A2 at (10,7). First target B2 at (11,7). Second target B1 at (10,8).
  // B1 is adjacent (orthogonal) to A2 but NOT adjacent to B2.
  return {
    ...baseState,
    players: baseState.players.map(p => {
      if (p.id === 'A2') {
        return {
          ...p,
          pos: { x: 10, y: 7 },
          stunned: false,
          pm: 6,
          st: 4,
          skills: attackerSkills,
        };
      }
      if (p.id === 'B2') {
        return {
          ...p,
          pos: opts.firstOnly ? { x: 20, y: 0 } : { x: 11, y: 7 },
          stunned: false,
          pm: 6,
          st: 3,
          skills: [],
        };
      }
      if (p.id === 'B1') {
        return {
          ...p,
          pos: opts.secondOnly
            ? { x: 20, y: 1 }
            : opts.movedAwaySecond
              ? { x: 5, y: 5 }
              : { x: 10, y: 8 },
          stunned: false,
          pm: 6,
          st: 3,
          skills: [],
        };
      }
      // A1 out of the way
      if (p.id === 'A1') {
        return { ...p, pos: { x: 0, y: 0 } };
      }
      return p;
    }),
  };
}

describe('Regle: Multiple Block', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('multiple-block-test-seed');
  });

  describe('hasMultipleBlock (predicat)', () => {
    it('retourne false si le joueur n a pas le skill', () => {
      const attacker = state.players.find(p => p.id === 'A2')!;
      expect(hasMultipleBlock(attacker)).toBe(false);
    });

    it('retourne true si le joueur possede le skill (slug canonique)', () => {
      const player: Player = {
        ...state.players.find(p => p.id === 'A2')!,
        skills: ['multiple-block'],
      };
      expect(hasMultipleBlock(player)).toBe(true);
    });

    it('accepte la casse indifferente (slug canonique only)', () => {
      const player: Player = {
        ...state.players.find(p => p.id === 'A2')!,
        skills: ['Multiple-Block'],
      };
      expect(hasMultipleBlock(player)).toBe(true);
    });
  });

  describe('findMultipleBlockTargets', () => {
    it('retourne les adversaires adjacents debout', () => {
      const s = arrangeThreePlayers(state, ['multiple-block']);
      const attacker = s.players.find(p => p.id === 'A2')!;
      const targets = findMultipleBlockTargets(s, attacker);
      expect(targets.sort()).toEqual(['B1', 'B2']);
    });

    it('ignore les adversaires stunned / a terre', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      const s = {
        ...s0,
        players: s0.players.map(p => (p.id === 'B1' ? { ...p, stunned: true, pm: 0 } : p)),
      };
      const attacker = s.players.find(p => p.id === 'A2')!;
      expect(findMultipleBlockTargets(s, attacker)).toEqual(['B2']);
    });

    it('ignore les co-equipiers', () => {
      const s = arrangeThreePlayers(state, ['multiple-block']);
      const attacker = s.players.find(p => p.id === 'A2')!;
      const targets = findMultipleBlockTargets(s, attacker);
      expect(targets).not.toContain('A1');
    });
  });

  describe('canPerformMultipleBlock', () => {
    it('echoue si l attaquant n a pas le skill', () => {
      const s = arrangeThreePlayers(state, []);
      expect(canPerformMultipleBlock(s, 'A2', 'B1', 'B2')).toBe(false);
    });

    it('reussit avec skill + deux adversaires adjacents', () => {
      const s = arrangeThreePlayers(state, ['multiple-block']);
      expect(canPerformMultipleBlock(s, 'A2', 'B1', 'B2')).toBe(true);
    });

    it('echoue si les deux cibles sont identiques', () => {
      const s = arrangeThreePlayers(state, ['multiple-block']);
      expect(canPerformMultipleBlock(s, 'A2', 'B1', 'B1')).toBe(false);
    });

    it('echoue si une cible n est pas adjacente', () => {
      const s = arrangeThreePlayers(state, ['multiple-block'], { firstOnly: true });
      expect(canPerformMultipleBlock(s, 'A2', 'B1', 'B2')).toBe(false);
    });

    it('echoue si l equipe a deja utilise multiple-block ce tour', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      const s: GameState = { ...s0, usedMultipleBlockThisTurn: ['A'] };
      expect(canPerformMultipleBlock(s, 'A2', 'B1', 'B2')).toBe(false);
    });

    it('echoue pendant un Blitz (action declaree BLITZ)', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      const s: GameState = {
        ...s0,
        playerActions: { ...s0.playerActions, A2: 'BLITZ' },
      };
      expect(canPerformMultipleBlock(s, 'A2', 'B1', 'B2')).toBe(false);
    });

    it('echoue si l attaquant a deja agi (autre action)', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      const s: GameState = {
        ...s0,
        playerActions: { ...s0.playerActions, A2: 'MOVE' },
      };
      expect(canPerformMultipleBlock(s, 'A2', 'B1', 'B2')).toBe(false);
    });
  });

  describe('Effet en match via applyMove', () => {
    it('applique -2 a la force de l attaquant pour le premier bloc', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      // Sans multiple-block : ST 4 vs ST 3 → 2 des, attaquant choisit.
      // Avec multiple-block : ST 4-2=2 vs ST 3 → 2 des, DEFENDEUR choisit.
      expect(calculateBlockDiceCount(4, 3)).toBe(2);
      expect(calculateBlockDiceCount(4 + MULTIPLE_BLOCK_ST_PENALTY, 3)).toBe(2);

      const next = applyMove(
        s0,
        { type: 'MULTI_BLOCK', playerId: 'A2', firstTargetId: 'B2', secondTargetId: 'B1' },
        rng,
      );
      // Le chooser passe de 'attacker' a 'defender' parce que -2 fait tomber
      // l'attaquant sous la force de la cible.
      expect(next.pendingBlock?.chooser).toBe('defender');
      // La totalStrength enregistree inclut bien la penalite.
      expect(next.pendingBlock?.totalStrength).toBe(4 + MULTIPLE_BLOCK_ST_PENALTY);
      // Le log contient une mention du skill.
      const joined = next.gameLog.map(l => l.message).join('\n');
      expect(joined).toMatch(/Multiple Block|Blocage Multiple/i);
    });

    it('marque l usage du skill pour l equipe ce tour', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      const next = applyMove(
        s0,
        { type: 'MULTI_BLOCK', playerId: 'A2', firstTargetId: 'B2', secondTargetId: 'B1' },
        rng,
      );
      expect(next.usedMultipleBlockThisTurn).toContain('A');
    });

    it('refuse MULTI_BLOCK si la cible 2 n est pas adjacente', () => {
      // second target moved far away
      const s0 = arrangeThreePlayers(state, ['multiple-block'], { movedAwaySecond: true });
      const next = applyMove(
        s0,
        { type: 'MULTI_BLOCK', playerId: 'A2', firstTargetId: 'B2', secondTargetId: 'B1' },
        rng,
      );
      // Action refused : pas d'action enregistree sur A2, pas d'usage.
      expect(next.playerActions['A2']).toBeUndefined();
      expect(next.usedMultipleBlockThisTurn ?? []).not.toContain('A');
    });

    it('refuse MULTI_BLOCK sans le skill', () => {
      const s0 = arrangeThreePlayers(state, []);
      const next = applyMove(
        s0,
        { type: 'MULTI_BLOCK', playerId: 'A2', firstTargetId: 'B2', secondTargetId: 'B1' },
        rng,
      );
      expect(next).toEqual(s0);
    });

    it('enchaine le second bloc quand aucun push/pending n est en attente', () => {
      // Force ST 5 vs ST 3 : 5-2=3 vs 3 = 2 dice. With seed we expect the flow
      // to handle pending states correctly. We check that multi-block state is
      // tracked and eventually cleared.
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      const boosted: GameState = {
        ...s0,
        players: s0.players.map(p => (p.id === 'A2' ? { ...p, st: 5 } : p)),
      };
      const next = applyMove(
        boosted,
        { type: 'MULTI_BLOCK', playerId: 'A2', firstTargetId: 'B2', secondTargetId: 'B1' },
        rng,
      );
      // Le flag usedMultipleBlockThisTurn reste pose meme apres resolution complete
      expect(next.usedMultipleBlockThisTurn).toContain('A');
      // Si plus aucun pending bloquant, pendingMultipleBlock doit etre efface
      if (
        !next.pendingBlock &&
        !next.pendingPushChoice &&
        !next.pendingFollowUpChoice &&
        !next.pendingReroll
      ) {
        expect(next.pendingMultipleBlock).toBeUndefined();
      }
    });

    it('ne double pas la consommation : deuxieme MULTI_BLOCK meme tour refuse', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      // Simuler: premiere utilisation deja consommee
      const flagged: GameState = { ...s0, usedMultipleBlockThisTurn: ['A'] };
      const next = applyMove(
        flagged,
        { type: 'MULTI_BLOCK', playerId: 'A2', firstTargetId: 'B2', secondTargetId: 'B1' },
        rng,
      );
      // Pas d'action enregistree, usage inchange.
      expect(next.playerActions['A2']).toBeUndefined();
    });
  });

  describe('Reset usedMultipleBlockThisTurn', () => {
    it('reset au changement de tour (END_TURN)', () => {
      const s0 = arrangeThreePlayers(state, ['multiple-block']);
      const flagged: GameState = { ...s0, usedMultipleBlockThisTurn: ['A'] };
      const next = applyMove(flagged, { type: 'END_TURN' }, rng);
      expect(next.usedMultipleBlockThisTurn ?? []).toEqual([]);
    });
  });
});
