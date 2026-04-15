import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  resolveBlockResult,
  applyMove,
  makeRNG,
  type GameState,
  type Player,
  type Move,
} from '../index';
import { hasFend, isFendActiveForFollowUp } from './fend';

/**
 * Fend (BB3 Season 2/3) :
 *  - Sur PUSH_BACK, l'attaquant ne peut pas faire de follow-up.
 *  - Sur STUMBLE converti en PUSH_BACK par Dodge, l'attaquant ne peut pas non
 *    plus faire de follow-up.
 *  - Sur POW ou STUMBLE sans Dodge, la cible est knocked-down avant la
 *    poussee : Fend n'est PAS actif.
 *  - Annule par Juggernaut sur un Blitz contre le defenseur direct.
 *
 * Utilisateurs principaux : Imperial Retainer Lineman (Noblesse Imperiale).
 */

function makeBlockResult(
  attackerId: string,
  targetId: string,
  result: 'BOTH_DOWN' | 'PUSH_BACK' | 'POW' | 'STUMBLE' | 'PLAYER_DOWN',
) {
  return {
    type: 'block' as const,
    playerId: attackerId,
    targetId: targetId,
    diceRoll: 2,
    result,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

function placePlayersForBlock(
  baseState: GameState,
  attackerSkills: string[],
  defenderSkills: string[],
  opts: { isBlitz?: boolean; defenderStunned?: boolean } = {},
): GameState {
  const nextState: GameState = {
    ...baseState,
    players: baseState.players.map(p => {
      if (p.id === 'A2')
        return {
          ...p,
          pos: { x: 10, y: 7 },
          stunned: false,
          pm: 6,
          skills: attackerSkills,
        };
      if (p.id === 'B2')
        return {
          ...p,
          pos: { x: 11, y: 7 },
          stunned: opts.defenderStunned ?? false,
          pm: 6,
          skills: defenderSkills,
        };
      // Eloigner les autres joueurs pour eviter les interferences
      if (p.team === 'A') return { ...p, pos: { x: 0, y: 0 } };
      if (p.team === 'B') return { ...p, pos: { x: 24, y: 14 } };
      return p;
    }),
  };
  if (opts.isBlitz) {
    return {
      ...nextState,
      playerActions: { ...nextState.playerActions, A2: 'BLITZ' },
    };
  }
  return nextState;
}

describe('Regle: Fend', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('fend-test-seed');
  });

  describe('Helpers', () => {
    it('hasFend retourne faux sans le skill', () => {
      const p = { skills: [] } as unknown as Player;
      expect(hasFend(p)).toBe(false);
    });

    it('hasFend retourne vrai avec le skill', () => {
      const p = { skills: ['fend'] } as unknown as Player;
      expect(hasFend(p)).toBe(true);
    });

    it("isFendActiveForFollowUp est faux si la cible n'a pas Fend", () => {
      const testState = placePlayersForBlock(state, [], []);
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isFendActiveForFollowUp(testState, attacker, target)).toBe(false);
    });

    it('isFendActiveForFollowUp est vrai si la cible a Fend et est debout', () => {
      const testState = placePlayersForBlock(state, [], ['fend']);
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isFendActiveForFollowUp(testState, attacker, target)).toBe(true);
    });

    it('isFendActiveForFollowUp est faux si la cible est stunned', () => {
      const testState = placePlayersForBlock(state, [], ['fend'], {
        defenderStunned: true,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isFendActiveForFollowUp(testState, attacker, target)).toBe(false);
    });

    it('isFendActiveForFollowUp est faux si Juggernaut actif sur Blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['fend'], {
        isBlitz: true,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isFendActiveForFollowUp(testState, attacker, target)).toBe(false);
    });

    it('isFendActiveForFollowUp reste vrai si Juggernaut sans Blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['fend'], {
        isBlitz: false,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isFendActiveForFollowUp(testState, attacker, target)).toBe(true);
    });
  });

  describe('PUSH_BACK', () => {
    it("empeche le follow-up de l'attaquant (pendingFollowUpChoice absent)", () => {
      const testState = placePlayersForBlock(state, [], ['fend']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      expect(result.pendingFollowUpChoice).toBeUndefined();
    });

    it("laisse l'attaquant sur sa case initiale (pas de follow-up)", () => {
      const testState = placePlayersForBlock(state, [], ['fend']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const attacker = result.players.find(p => p.id === 'A2')!;
      expect(attacker.pos).toEqual({ x: 10, y: 7 });
    });

    it('la cible est quand meme poussee', () => {
      const testState = placePlayersForBlock(state, [], ['fend']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      const moved = defender.pos.x !== 11 || defender.pos.y !== 7;
      const hasChoice = result.pendingPushChoice !== undefined;
      expect(moved || hasChoice).toBe(true);
    });

    it('log explicite Fend apres PUSH_CHOOSE', () => {
      const testState = placePlayersForBlock(state, [], ['fend']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const intermediate = resolveBlockResult(testState, blockResult, rng);

      // En configuration standard, plusieurs directions sont disponibles
      // → on choisit via PUSH_CHOOSE.
      if (intermediate.pendingPushChoice) {
        const dir = intermediate.pendingPushChoice.availableDirections[0];
        const pushMove: Move = {
          type: 'PUSH_CHOOSE',
          playerId: 'A2',
          targetId: 'B2',
          direction: dir,
        };
        const after = applyMove(intermediate, pushMove, rng);
        const fendLog = after.gameLog.find(log =>
          log.message.toLowerCase().includes('fend'),
        );
        expect(fendLog).toBeDefined();
      } else {
        // Cas single-direction (ou surf) : log genere directement
        const fendLog = intermediate.gameLog.find(log =>
          log.message.toLowerCase().includes('fend'),
        );
        expect(fendLog).toBeDefined();
      }
    });

    it("sans Fend, l'attaquant peut faire un follow-up", () => {
      const testState = placePlayersForBlock(state, [], []);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      // Soit pendingFollowUpChoice defini, soit pendingPushChoice (multi-dir)
      const hasFollowUp = result.pendingFollowUpChoice !== undefined;
      const hasPushChoice = result.pendingPushChoice !== undefined;
      expect(hasFollowUp || hasPushChoice).toBe(true);
    });

    it('Juggernaut sur Blitz annule Fend (follow-up possible)', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['fend'], {
        isBlitz: true,
      });
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const hasFollowUp = result.pendingFollowUpChoice !== undefined;
      const hasPushChoice = result.pendingPushChoice !== undefined;
      expect(hasFollowUp || hasPushChoice).toBe(true);
    });
  });

  describe('STUMBLE converti en PUSH_BACK par Dodge', () => {
    it("Fend empeche aussi le follow-up apres conversion Dodge", () => {
      const testState = placePlayersForBlock(state, [], ['dodge', 'fend']);
      const blockResult = makeBlockResult('A2', 'B2', 'STUMBLE');

      const result = resolveBlockResult(testState, blockResult, rng);

      expect(result.pendingFollowUpChoice).toBeUndefined();
      const defender = result.players.find(p => p.id === 'B2')!;
      // Le defenseur reste debout (pas knocked down car Dodge a negate)
      expect(defender.stunned).toBeFalsy();
    });
  });

  describe('POW', () => {
    it("Fend n'est PAS actif sur POW (cible knocked-down)", () => {
      const testState = placePlayersForBlock(state, [], ['fend']);
      const blockResult = makeBlockResult('A2', 'B2', 'POW');

      const result = resolveBlockResult(testState, blockResult, rng);

      // Soit pendingFollowUpChoice est defini (single dir), soit pendingPushChoice (multi)
      // Dans tous les cas, Fend ne doit pas avoir bloque le follow-up.
      const hasFollowUp = result.pendingFollowUpChoice !== undefined;
      const hasPushChoice = result.pendingPushChoice !== undefined;
      const targetSurfed = result.players
        .find(p => p.id === 'B2')!
        .pos.x < 0 || result.players.find(p => p.id === 'B2')!.pos.x > 25;
      expect(hasFollowUp || hasPushChoice || targetSurfed).toBe(true);
    });
  });

  describe('STUMBLE sans Dodge', () => {
    it("Fend n'est pas actif (cible knocked-down)", () => {
      const testState = placePlayersForBlock(state, [], ['fend']);
      const blockResult = makeBlockResult('A2', 'B2', 'STUMBLE');

      const result = resolveBlockResult(testState, blockResult, rng);

      const hasFollowUp = result.pendingFollowUpChoice !== undefined;
      const hasPushChoice = result.pendingPushChoice !== undefined;
      expect(hasFollowUp || hasPushChoice).toBe(true);
    });
  });

  describe('Integration PUSH_CHOOSE', () => {
    it('Fend empeche aussi le follow-up quand plusieurs directions disponibles', () => {
      // Placer A2 et B2 en diagonale pour avoir plusieurs directions disponibles
      const testState: GameState = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A2') return { ...p, pos: { x: 10, y: 7 }, stunned: false, pm: 6, skills: [] };
          if (p.id === 'B2') return { ...p, pos: { x: 11, y: 8 }, stunned: false, pm: 6, skills: ['fend'] };
          if (p.team === 'A') return { ...p, pos: { x: 0, y: 0 } };
          if (p.team === 'B') return { ...p, pos: { x: 24, y: 14 } };
          return p;
        }),
      };
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const intermediate = resolveBlockResult(testState, blockResult, rng);

      // Attendre un pendingPushChoice avec plusieurs directions
      expect(intermediate.pendingPushChoice).toBeDefined();
      const directions = intermediate.pendingPushChoice!.availableDirections;
      expect(directions.length).toBeGreaterThanOrEqual(1);

      // Choisir une direction
      const pushMove: Move = {
        type: 'PUSH_CHOOSE',
        playerId: 'A2',
        targetId: 'B2',
        direction: directions[0],
      };
      const after = applyMove(intermediate, pushMove, rng);

      // Fend doit empecher le pendingFollowUpChoice
      expect(after.pendingFollowUpChoice).toBeUndefined();
      const attacker = after.players.find(p => p.id === 'A2')!;
      // L'attaquant n'a pas suivi
      expect(attacker.pos).toEqual({ x: 10, y: 7 });
    });
  });
});
