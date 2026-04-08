import { describe, it, expect } from 'vitest';
import { setup, applyMove, makeRNG } from '../index';
import type { GameState, Player, Move, RNG } from '../core/types';
import { extractLineage, hasAnimosityAgainst, checkAnimosity } from './animosity';
import { getSkillEffect } from '../skills/skill-registry';

/**
 * Animosity (BB2020 rules):
 * When a player with Animosity attempts to Hand Off or Pass to a teammate
 * of the disliked type, roll a D6:
 * - On 1: The player refuses, their activation ends (NOT a turnover)
 * - On 2+: The action proceeds normally
 *
 * Variants:
 * - animosity: Dislikes teammates of a different lineage/race
 * - animosity-all: Dislikes ALL teammates regardless of lineage
 * - animosity-underworld: Skaven vs non-Skaven in Underworld teams
 * - animosity-all-dwarf-halfling: Dislikes Dwarf and Halfling teammates
 * - animosity-all-dwarf-human: Dislikes Dwarf and Human teammates
 */

// ─── Helpers ────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> & { id: string; team: Player['team'] }): Player {
  return {
    pos: { x: 5, y: 7 },
    name: 'Test Player',
    number: 1,
    position: 'lineman',
    ma: 6, st: 3, ag: 3, pa: 3, av: 9,
    skills: [],
    pm: 6,
    hasBall: false,
    state: 'active',
    stunned: false,
    ...overrides,
  };
}

/** RNG that returns fixed values (maps to D6 rolls) */
function makeFixedRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

/** RNG value that produces a specific D6 result: (result - 1) / 6 */
function d6Value(result: number): number {
  return (result - 0.5) / 6;
}

function setupAnimosityState(): GameState {
  const state = setup();
  return {
    ...state,
    currentTeam: 'A' as const,
    currentPlayer: 'A' as const,
    teamRerolls: { teamA: 2, teamB: 2 },
    rerollUsedThisTurn: false,
  };
}

// ─── Tests: extractLineage ──────────────────────────────────────

describe('Regle: Animosity', () => {
  describe('extractLineage', () => {
    it('extracts goblin from position slug', () => {
      expect(extractLineage('chaos_renegade_goblin')).toBe('goblin');
      expect(extractLineage('orc_goblin')).toBe('goblin');
      expect(extractLineage('underworld_underworld_goblin_lineman')).toBe('goblin');
    });

    it('extracts orc from position slug', () => {
      expect(extractLineage('chaos_renegade_orc')).toBe('orc');
      expect(extractLineage('orc_orc_lineman')).toBe('orc');
      expect(extractLineage('orc_blitzer')).toBe('orc');
      expect(extractLineage('orc_thrower')).toBe('orc');
      expect(extractLineage('orc_big_un_blocker')).toBe('orc');
    });

    it('extracts skaven from position slug', () => {
      expect(extractLineage('chaos_renegade_skaven')).toBe('skaven');
      expect(extractLineage('underworld_skaven_clanrat')).toBe('skaven');
      expect(extractLineage('underworld_skaven_thrower')).toBe('skaven');
      expect(extractLineage('underworld_skaven_blitzer')).toBe('skaven');
    });

    it('extracts skaven for gutter runner and rat ogre', () => {
      expect(extractLineage('underworld_gutter_runner')).toBe('skaven');
      expect(extractLineage('underworld_mutant_rat_ogre')).toBe('skaven');
    });

    it('extracts human from position slug', () => {
      expect(extractLineage('chaos_renegade_human_thrower')).toBe('human');
      expect(extractLineage('chaos_renegade_human_lineman')).toBe('human');
      expect(extractLineage('old_world_alliance_old_world_human_thrower')).toBe('human');
    });

    it('extracts dwarf from position slug', () => {
      expect(extractLineage('old_world_alliance_old_world_dwarf_blocker')).toBe('dwarf');
      expect(extractLineage('old_world_alliance_old_world_dwarf_troll_slayer')).toBe('dwarf');
    });

    it('extracts halfling from position slug', () => {
      expect(extractLineage('old_world_alliance_old_world_halfling_hopeful')).toBe('halfling');
    });

    it('extracts dark_elf from position slug (before generic elf)', () => {
      expect(extractLineage('chaos_renegade_dark_elf')).toBe('dark_elf');
    });

    it('extracts troll from position slug', () => {
      expect(extractLineage('chaos_renegade_troll')).toBe('troll');
      expect(extractLineage('orc_untrained_troll')).toBe('troll');
      expect(extractLineage('underworld_underworld_troll')).toBe('troll');
    });

    it('extracts ogre from position slug', () => {
      expect(extractLineage('chaos_renegade_ogre')).toBe('ogre');
      expect(extractLineage('old_world_alliance_ogre')).toBe('ogre');
    });

    it('extracts snotling from position slug', () => {
      expect(extractLineage('underworld_underworld_snotling')).toBe('snotling');
    });

    it('returns unknown for unrecognized slugs', () => {
      expect(extractLineage('some_weird_position')).toBe('unknown');
    });

    // Season 3 French slugs
    it('extracts lineage from Season 3 French slugs', () => {
      expect(extractLineage('underworld_gobelin_des_bas_fond')).toBe('goblin');
      expect(extractLineage('underworld_snotling_des_bas_fond')).toBe('snotling');
      expect(extractLineage('underworld_skaven_du_clan_du_rat')).toBe('skaven');
      expect(extractLineage('chaos_renegade_gobelin_renegat')).toBe('goblin');
      expect(extractLineage('chaos_renegade_orque_renegat')).toBe('orc');
      expect(extractLineage('chaos_renegade_elf_noir_renegat')).toBe('dark_elf');
      expect(extractLineage('chaos_renegade_lanceur_humain_renegat')).toBe('human');
      expect(extractLineage('chaos_renegade_troll_renegat')).toBe('troll');
    });
  });

  // ─── Tests: hasAnimosityAgainst ─────────────────────────────────

  describe('hasAnimosityAgainst', () => {
    describe('animosity (generic — different lineage)', () => {
      it('returns true when passer and target are different lineage', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_orc_lineman', skills: ['animosity'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_goblin', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });

      it('returns false when passer and target are same lineage', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_orc_lineman', skills: ['animosity'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_blitzer', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(false);
      });

      it('returns false when passer has no animosity', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_goblin', skills: ['dodge'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_orc_lineman', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(false);
      });
    });

    describe('animosity-all (dislikes ALL teammates)', () => {
      it('returns true even for same lineage', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_thrower', skills: ['animosity-all'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_blitzer', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });

      it('returns true for different lineage', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_thrower', skills: ['animosity-all'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_goblin', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });
    });

    describe('animosity-underworld', () => {
      it('returns true when Skaven targets non-Skaven', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'underworld_skaven_clanrat', skills: ['animosity-underworld'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'underworld_underworld_goblin_lineman', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });

      it('returns false when Skaven targets Skaven', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'underworld_skaven_clanrat', skills: ['animosity-underworld'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'underworld_skaven_thrower', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(false);
      });
    });

    describe('animosity-all-dwarf-halfling', () => {
      it('returns true when targeting a dwarf', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'old_world_alliance_old_world_human_thrower', skills: ['animosity-all-dwarf-halfling'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'old_world_alliance_old_world_dwarf_blocker', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });

      it('returns true when targeting a halfling', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'old_world_alliance_old_world_human_thrower', skills: ['animosity-all-dwarf-halfling'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'old_world_alliance_old_world_halfling_hopeful', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });

      it('returns false when targeting a human', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'old_world_alliance_old_world_human_thrower', skills: ['animosity-all-dwarf-halfling'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'old_world_alliance_old_world_human_catcher', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(false);
      });
    });

    describe('animosity-all-dwarf-human', () => {
      it('returns true when targeting a dwarf', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'old_world_alliance_old_world_halfling_hopeful', skills: ['animosity-all-dwarf-human'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'old_world_alliance_old_world_dwarf_blocker', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });

      it('returns true when targeting a human', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'old_world_alliance_old_world_halfling_hopeful', skills: ['animosity-all-dwarf-human'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'old_world_alliance_old_world_human_thrower', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(true);
      });

      it('returns false when targeting another halfling', () => {
        const passer = makePlayer({ id: 'A1', team: 'A', position: 'old_world_alliance_old_world_halfling_hopeful', skills: ['animosity-all-dwarf-human'] });
        const target = makePlayer({ id: 'A2', team: 'A', position: 'old_world_alliance_old_world_halfling_hopeful', skills: [] });
        expect(hasAnimosityAgainst(passer, target)).toBe(false);
      });
    });
  });

  // ─── Tests: checkAnimosity (D6 roll) ────────────────────────────

  describe('checkAnimosity', () => {
    it('on D6 = 1, returns passed = false and logs refusal', () => {
      const state = setupAnimosityState();
      const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 } });
      const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_goblin', skills: [], pos: { x: 10, y: 8 } });

      const rng = makeFixedRNG([d6Value(1)]);
      const result = checkAnimosity(state, passer, target, rng);

      expect(result.passed).toBe(false);
      expect(result.newState.gameLog.some(l => l.message.includes('Animosité'))).toBe(true);
      expect(result.newState.gameLog.some(l => l.message.includes('refuse'))).toBe(true);
    });

    it('on D6 = 2, returns passed = true', () => {
      const state = setupAnimosityState();
      const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 } });
      const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_goblin', skills: [], pos: { x: 10, y: 8 } });

      const rng = makeFixedRNG([d6Value(2)]);
      const result = checkAnimosity(state, passer, target, rng);

      expect(result.passed).toBe(true);
    });

    it('on D6 = 6, returns passed = true', () => {
      const state = setupAnimosityState();
      const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 } });
      const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_goblin', skills: [], pos: { x: 10, y: 8 } });

      const rng = makeFixedRNG([d6Value(6)]);
      const result = checkAnimosity(state, passer, target, rng);

      expect(result.passed).toBe(true);
    });

    it('does not set isTurnover on failure (activation ends, not turnover)', () => {
      const state = setupAnimosityState();
      const passer = makePlayer({ id: 'A1', team: 'A', position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 } });
      const target = makePlayer({ id: 'A2', team: 'A', position: 'orc_goblin', skills: [], pos: { x: 10, y: 8 } });

      const rng = makeFixedRNG([d6Value(1)]);
      const result = checkAnimosity(state, passer, target, rng);

      expect(result.passed).toBe(false);
      expect(result.newState.isTurnover).toBeFalsy();
    });
  });

  // ─── Tests: Skill Registry ──────────────────────────────────────

  describe('Skill Registry', () => {
    it('animosity is registered', () => {
      expect(getSkillEffect('animosity')).toBeDefined();
    });

    it('animosity-all is registered', () => {
      expect(getSkillEffect('animosity-all')).toBeDefined();
    });

    it('animosity-underworld is registered', () => {
      expect(getSkillEffect('animosity-underworld')).toBeDefined();
    });

    it('animosity-all-dwarf-halfling is registered', () => {
      expect(getSkillEffect('animosity-all-dwarf-halfling')).toBeDefined();
    });

    it('animosity-all-dwarf-human is registered', () => {
      expect(getSkillEffect('animosity-all-dwarf-human')).toBeDefined();
    });
  });

  // ─── Tests: Integration with handlePass/handleHandoff ───────────

  describe('Integration: Pass with Animosity', () => {
    it('blocks pass on D6 = 1 and ends activation', () => {
      let state = setupAnimosityState();
      // Place passer (Orc Lineman with animosity) and target (Goblin)
      state = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 }, pm: 6, state: 'active' as const };
          if (p.id === 'A2') return { ...p, position: 'orc_goblin', skills: [], hasBall: false, pos: { x: 13, y: 7 }, pm: 6, state: 'active' as const };
          return p;
        }),
        ball: { x: 10, y: 7 },
      };

      // D6=1 → animosity check fails → pass blocked
      const rng = makeFixedRNG([d6Value(1)]);
      const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
      const result = applyMove(state, passMove, rng);

      // Ball should still be with the passer
      const passer = result.players.find(p => p.id === 'A1')!;
      expect(passer.hasBall).toBe(true);
      // Should NOT be a turnover
      expect(result.isTurnover).toBeFalsy();
      // Log should mention animosity
      expect(result.gameLog.some(l => l.message.includes('Animosité'))).toBe(true);
    });

    it('allows pass on D6 >= 2', () => {
      let state = setupAnimosityState();
      state = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 }, pm: 6, state: 'active' as const };
          if (p.id === 'A2') return { ...p, position: 'orc_goblin', skills: [], hasBall: false, pos: { x: 13, y: 7 }, pm: 6, state: 'active' as const };
          return p;
        }),
        ball: { x: 10, y: 7 },
      };

      // D6=2 → animosity passes, then pass roll etc.
      const rng = makeFixedRNG([d6Value(2), d6Value(6), d6Value(6)]);
      const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
      const result = applyMove(state, passMove, rng);

      // Ball should have moved (pass attempted)
      const passer = result.players.find(p => p.id === 'A1')!;
      expect(passer.hasBall).toBe(false);
    });

    it('skips animosity check when passer has no animosity skill', () => {
      let state = setupAnimosityState();
      state = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, position: 'orc_orc_lineman', skills: [], hasBall: true, pos: { x: 10, y: 7 }, pm: 6, state: 'active' as const };
          if (p.id === 'A2') return { ...p, position: 'orc_goblin', skills: [], hasBall: false, pos: { x: 13, y: 7 }, pm: 6, state: 'active' as const };
          return p;
        }),
        ball: { x: 10, y: 7 },
      };

      // Even with D6=1, no animosity because passer has no animosity skill
      const rng = makeFixedRNG([d6Value(6), d6Value(6)]);
      const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
      const result = applyMove(state, passMove, rng);

      const passer = result.players.find(p => p.id === 'A1')!;
      expect(passer.hasBall).toBe(false);
      expect(result.gameLog.some(l => l.message.includes('Animosité'))).toBe(false);
    });

    it('skips animosity check when passer and target are same lineage', () => {
      let state = setupAnimosityState();
      state = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 }, pm: 6, state: 'active' as const };
          if (p.id === 'A2') return { ...p, position: 'orc_blitzer', skills: [], hasBall: false, pos: { x: 13, y: 7 }, pm: 6, state: 'active' as const };
          return p;
        }),
        ball: { x: 10, y: 7 },
      };

      // Same lineage → no animosity check, pass proceeds
      const rng = makeFixedRNG([d6Value(6), d6Value(6)]);
      const passMove: Move = { type: 'PASS', playerId: 'A1', targetId: 'A2' };
      const result = applyMove(state, passMove, rng);

      const passer = result.players.find(p => p.id === 'A1')!;
      expect(passer.hasBall).toBe(false);
      expect(result.gameLog.some(l => l.message.includes('Animosité'))).toBe(false);
    });
  });

  describe('Integration: Handoff with Animosity', () => {
    it('blocks handoff on D6 = 1 and ends activation', () => {
      let state = setupAnimosityState();
      state = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 }, pm: 6, state: 'active' as const };
          if (p.id === 'A2') return { ...p, position: 'orc_goblin', skills: [], hasBall: false, pos: { x: 11, y: 7 }, pm: 6, state: 'active' as const };
          return p;
        }),
        ball: { x: 10, y: 7 },
      };

      const rng = makeFixedRNG([d6Value(1)]);
      const handoffMove: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };
      const result = applyMove(state, handoffMove, rng);

      const passer = result.players.find(p => p.id === 'A1')!;
      expect(passer.hasBall).toBe(true);
      expect(result.isTurnover).toBeFalsy();
      expect(result.gameLog.some(l => l.message.includes('Animosité'))).toBe(true);
    });

    it('allows handoff on D6 >= 2', () => {
      let state = setupAnimosityState();
      state = {
        ...state,
        players: state.players.map(p => {
          if (p.id === 'A1') return { ...p, position: 'orc_orc_lineman', skills: ['animosity'], hasBall: true, pos: { x: 10, y: 7 }, pm: 6, state: 'active' as const };
          if (p.id === 'A2') return { ...p, position: 'orc_goblin', skills: [], hasBall: false, pos: { x: 11, y: 7 }, pm: 6, state: 'active' as const };
          return p;
        }),
        ball: { x: 10, y: 7 },
      };

      // D6=2 → animosity passes, then catch roll
      const rng = makeFixedRNG([d6Value(2), d6Value(6)]);
      const handoffMove: Move = { type: 'HANDOFF', playerId: 'A1', targetId: 'A2' };
      const result = applyMove(state, handoffMove, rng);

      const passer = result.players.find(p => p.id === 'A1')!;
      expect(passer.hasBall).toBe(false);
    });
  });
});
