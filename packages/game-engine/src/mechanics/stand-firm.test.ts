import { describe, it, expect, beforeEach } from 'vitest';
import {
  setup,
  resolveBlockResult,
  applyChainPush,
  makeRNG,
  type GameState,
  type Player,
} from '../index';
import {
  hasStandFirm,
  isStandFirmActiveForBlock,
  isStandFirmActiveForChainPush,
} from './stand-firm';

/**
 * Stand Firm (BB3 Season 2/3) :
 *  - La cible d'une poussee peut refuser d'etre deplacee (reste sur sa case).
 *  - Sur POW, la cible tombe sur sa case sans etre poussee.
 *  - L'attaquant ne fait PAS de follow-up.
 *  - Empeche aussi d'etre pousse en chaine.
 *  - Annule par Juggernaut sur un Blitz contre le defenseur direct.
 *  - Ne fonctionne pas si la cible est stunned/prone.
 *
 * Utilisateur principal : Dwarf Deathroller, Bodyguard, Treeman Gnome.
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
  const nextState = {
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

describe('Regle: Stand Firm', () => {
  let state: GameState;
  let rng: ReturnType<typeof makeRNG>;

  beforeEach(() => {
    state = setup();
    rng = makeRNG('stand-firm-test-seed');
  });

  describe('Helpers', () => {
    it('hasStandFirm retourne faux sans le skill', () => {
      const p = { skills: [] } as unknown as Player;
      expect(hasStandFirm(p)).toBe(false);
    });

    it('hasStandFirm accepte le slug canonique', () => {
      const p = { skills: ['stand-firm'] } as unknown as Player;
      expect(hasStandFirm(p)).toBe(true);
    });

    it('hasStandFirm accepte les variantes de slug', () => {
      expect(hasStandFirm({ skills: ['stand_firm'] } as unknown as Player)).toBe(
        true,
      );
      expect(hasStandFirm({ skills: ['Stand Firm'] } as unknown as Player)).toBe(
        true,
      );
    });

    it("isStandFirmActiveForBlock est faux si la cible n'a pas le skill", () => {
      const testState = placePlayersForBlock(state, [], []);
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveForBlock(testState, attacker, target)).toBe(false);
    });

    it('isStandFirmActiveForBlock est vrai si la cible a Stand Firm et est debout', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveForBlock(testState, attacker, target)).toBe(true);
    });

    it('isStandFirmActiveForBlock est faux si la cible est stunned', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm'], {
        defenderStunned: true,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveForBlock(testState, attacker, target)).toBe(false);
    });

    it('isStandFirmActiveForBlock est faux si Juggernaut actif sur Blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['stand-firm'], {
        isBlitz: true,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveForBlock(testState, attacker, target)).toBe(false);
    });

    it('isStandFirmActiveForBlock reste vrai si Juggernaut sans Blitz', () => {
      const testState = placePlayersForBlock(state, ['juggernaut'], ['stand-firm'], {
        isBlitz: false,
      });
      const attacker = testState.players.find(p => p.id === 'A2')!;
      const target = testState.players.find(p => p.id === 'B2')!;
      expect(isStandFirmActiveForBlock(testState, attacker, target)).toBe(true);
    });

    it('isStandFirmActiveForChainPush suit les regles (skill + debout)', () => {
      const withSkill = {
        skills: ['stand-firm'],
        stunned: false,
      } as unknown as Player;
      expect(isStandFirmActiveForChainPush(withSkill)).toBe(true);

      const prone = {
        skills: ['stand-firm'],
        stunned: true,
      } as unknown as Player;
      expect(isStandFirmActiveForChainPush(prone)).toBe(false);

      const noSkill = { skills: [], stunned: false } as unknown as Player;
      expect(isStandFirmActiveForChainPush(noSkill)).toBe(false);
    });
  });

  describe('PUSH_BACK', () => {
    it("empeche la cible d'etre deplacee", () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.pos).toEqual({ x: 11, y: 7 });
    });

    it("empeche le follow-up de l'attaquant (pendingFollowUpChoice absent)", () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      expect(result.pendingFollowUpChoice).toBeUndefined();
    });

    it("empeche l'ouverture du pendingPushChoice meme quand plusieurs directions existent", () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      expect(result.pendingPushChoice).toBeUndefined();
    });

    it('log explicite Stand Firm', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const sfLog = result.gameLog.find(log =>
        log.message.toLowerCase().includes('stand firm'),
      );
      expect(sfLog).toBeDefined();
    });

    it('la cible est toujours poussee sans Stand Firm', () => {
      const testState = placePlayersForBlock(state, [], []);
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      // Le defenseur est soit pousse, soit attend un choix de direction.
      const pushed = defender.pos.x !== 11 || defender.pos.y !== 7;
      const hasChoice = result.pendingPushChoice !== undefined;
      expect(pushed || hasChoice).toBe(true);
    });

    it('Juggernaut sur Blitz annule Stand Firm (cible directe poussee)', () => {
      const testState = placePlayersForBlock(
        state,
        ['juggernaut'],
        ['stand-firm'],
        { isBlitz: true },
      );
      const blockResult = makeBlockResult('A2', 'B2', 'PUSH_BACK');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      const pushed = defender.pos.x !== 11 || defender.pos.y !== 7;
      const hasChoice = result.pendingPushChoice !== undefined;
      expect(pushed || hasChoice).toBe(true);
    });
  });

  describe('POW', () => {
    it('la cible tombe sur sa case actuelle (pas de deplacement)', () => {
      const testState = placePlayersForBlock(state, [], ['stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'POW');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.pos).toEqual({ x: 11, y: 7 });
      expect(defender.stunned).toBe(true);
    });
  });

  describe('STUMBLE (converti en PUSH_BACK par Dodge)', () => {
    it('Stand Firm empeche la poussee apres conversion Dodge', () => {
      const testState = placePlayersForBlock(state, [], ['dodge', 'stand-firm']);
      const blockResult = makeBlockResult('A2', 'B2', 'STUMBLE');

      const result = resolveBlockResult(testState, blockResult, rng);

      const defender = result.players.find(p => p.id === 'B2')!;
      expect(defender.pos).toEqual({ x: 11, y: 7 });
    });
  });

  describe('Chain push', () => {
    function addChainPushVictim(
      baseState: GameState,
      opts: { stunned?: boolean; standFirm?: boolean } = {},
    ): GameState {
      // B2 est a (11,7). On ajoute un joueur B3 adjacent a (12,7) pour creer
      // une chaine quand B2 est pousse vers (1,0).
      const b2 = baseState.players.find(p => p.id === 'B2')!;
      const newPlayer: Player = {
        ...b2,
        id: 'B3',
        number: 3,
        pos: { x: 12, y: 7 },
        stunned: opts.stunned ?? false,
        hasBall: false,
        skills: opts.standFirm ? ['stand-firm'] : [],
      };
      return { ...baseState, players: [...baseState.players, newPlayer] };
    }

    it("un joueur avec Stand Firm n'est pas pousse en chaine", () => {
      const baseState = placePlayersForBlock(state, [], []);
      const testState = addChainPushVictim(baseState, { standFirm: true });

      const resultState = applyChainPush(
        testState,
        'B2',
        { x: 1, y: 0 },
        rng,
      );

      const chainTarget = resultState.players.find(p => p.id === 'B3')!;
      const pushed = resultState.players.find(p => p.id === 'B2')!;
      // B3 n'a pas bouge (Stand Firm).
      expect(chainTarget.pos).toEqual({ x: 12, y: 7 });
      // B2 n'a pas bouge non plus (la case est toujours occupee par B3).
      expect(pushed.pos).toEqual({ x: 11, y: 7 });
    });

    it('un joueur stunned avec Stand Firm peut etre pousse en chaine', () => {
      const baseState = placePlayersForBlock(state, [], []);
      const testState = addChainPushVictim(baseState, {
        stunned: true,
        standFirm: true,
      });

      const resultState = applyChainPush(
        testState,
        'B2',
        { x: 1, y: 0 },
        rng,
      );

      const chainTarget = resultState.players.find(p => p.id === 'B3')!;
      // B3 stunned : Stand Firm ne s'applique pas, il est pousse.
      expect(chainTarget.pos).toEqual({ x: 13, y: 7 });
    });
  });
});
