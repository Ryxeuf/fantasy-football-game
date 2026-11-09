import { describe, it, expect } from 'vitest';
import { setup, applyMove, getLegalMoves, type GameState, type Player, type RNG } from '../index';
import { canThrowTeamMate } from './throw-team-mate';
import { findShadowingCandidates } from './shadowing';
import { canChomp, clearExpiredChomps, isChomped } from './chomp';

const rngOf = (value: number): RNG => () => value;
const ROLL_2 = rngOf(0.2);
const ROLL_3 = rngOf(0.4);

function patch(state: GameState, id: string, change: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === id ? { ...p, ...change } : p)),
  };
}

function byId(state: GameState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(id);
  return player;
}

/** A1 (Grande Gueule) au contact de B1, les autres joueurs au loin. */
function scenario(): GameState {
  let state = setup();
  state = patch(state, 'A1', { skills: ['monstrous-mouth'], pos: { x: 10, y: 7 }, pm: 6, state: 'active' });
  state = patch(state, 'B1', { pos: { x: 11, y: 7 }, pm: 6, state: 'active' });
  state = patch(state, 'A2', { pos: { x: 1, y: 1 }, state: 'active' });
  state = patch(state, 'B2', { pos: { x: 24, y: 13 }, state: 'active' });
  return { ...state, gamePhase: 'playing', currentPlayer: 'A' };
}

function chompedScenario(): GameState {
  return applyMove(scenario(), { type: 'CHOMP', playerId: 'A1', targetId: 'B1' }, ROLL_3);
}

describe('Grande Gueule — Croquement', () => {
  it('est proposé contre un adversaire Debout au contact', () => {
    expect(getLegalMoves(scenario())).toContainEqual({ type: 'CHOMP', playerId: 'A1', targetId: 'B1' });
  });

  it('est absent au texte 2020 (Saison 2)', () => {
    const state: GameState = { ...scenario(), ruleset: 'season_2' };
    expect(getLegalMoves(state).some((m) => m.type === 'CHOMP')).toBe(false);
    expect(canChomp(state, byId(state, 'A1'), byId(state, 'B1'))).toBe(false);
  });

  it('exige un adversaire Debout', () => {
    const state = patch(scenario(), 'B1', { stunned: true });
    expect(canChomp(state, byId(state, 'A1'), byId(state, 'B1'))).toBe(false);
  });

  it('exige que le joueur Marque sa cible', () => {
    const state: GameState = { ...scenario(), hypnotizedPlayers: ['A1'] };
    expect(canChomp(state, byId(state, 'A1'), byId(state, 'B1'))).toBe(false);
  });

  it('sur 1-2, rien ne se passe et l\'activation est consommée', () => {
    const state = applyMove(scenario(), { type: 'CHOMP', playerId: 'A1', targetId: 'B1' }, ROLL_2);
    expect(byId(state, 'B1').chompedBy).toBeUndefined();
    expect(byId(state, 'A1').pm).toBe(0);
    expect(state.playerActions?.A1).toBe('CHOMP');
  });

  it('sur 3+, la cible est Croquée', () => {
    const state = chompedScenario();
    expect(byId(state, 'B1').chompedBy).toEqual(['A1']);
    expect(isChomped(state, byId(state, 'B1'))).toBe(true);
  });

  it('remplace le Blocage d\'un Blitz après un Mouvement', () => {
    let state = scenario();
    state = patch(state, 'A1', { pos: { x: 9, y: 7 } });
    state = applyMove(state, { type: 'MOVE', playerId: 'A1', to: { x: 10, y: 7 } }, ROLL_3);
    expect(getLegalMoves(state)).toContainEqual({ type: 'CHOMP', playerId: 'A1', targetId: 'B1' });
    state = applyMove(state, { type: 'CHOMP', playerId: 'A1', targetId: 'B1' }, ROLL_3);
    expect(state.teamBlitzCount?.A).toBe(1);
    expect(byId(state, 'A1').pm).toBe(0);
    expect(isChomped(state, byId(state, 'B1'))).toBe(true);
  });

  describe('la cible Croquée', () => {
    function targetTurn(): GameState {
      // La fin du tour rend leurs PM à tous : `canBlock` exige une cible à PM > 0.
      return patch(
        { ...chompedScenario(), currentPlayer: 'B', playerActions: {} },
        'A1',
        { pm: 6, gfiUsed: 0 },
      );
    }

    it('ne peut ni se déplacer ni blitzer', () => {
      const moves = getLegalMoves(targetTurn()).filter((m) => 'playerId' in m && m.playerId === 'B1');
      expect(moves.some((m) => m.type === 'MOVE' || m.type === 'BLITZ' || m.type === 'LEAP')).toBe(false);
    });

    it('peut encore bloquer sur place', () => {
      expect(getLegalMoves(targetTurn())).toContainEqual({ type: 'BLOCK', playerId: 'B1', targetId: 'A1' });
    });

    it('voit son déplacement refusé par le dispatcher, sans jet', () => {
      const state = targetTurn();
      const rng: RNG = () => {
        throw new Error('aucun jet attendu');
      };
      const next = applyMove(state, { type: 'MOVE', playerId: 'B1', to: { x: 12, y: 7 } }, rng);
      expect(byId(next, 'B1').pos).toEqual({ x: 11, y: 7 });
    });

    it('ne peut pas être lancée ni filer un esquiveur', () => {
      let state = targetTurn();
      state = patch(state, 'B2', { skills: ['throw-team-mate'], pos: { x: 12, y: 7 } });
      state = patch(state, 'B1', { skills: ['right-stuff', 'shadowing'], st: 2 });
      expect(canThrowTeamMate(state, byId(state, 'B2'), byId(state, 'B1'))).toBe(false);
      expect(findShadowingCandidates(state, byId(state, 'A1'), { x: 11, y: 8 })).toEqual([]);
    });
  });

  describe('fin de l\'effet', () => {
    it('s\'éteint quand le joueur ne Marque plus, et ne revient pas', () => {
      let state = chompedScenario();
      state = patch(state, 'A1', { pos: { x: 3, y: 3 } });
      state = clearExpiredChomps(state);
      expect(byId(state, 'B1').chompedBy).toBeUndefined();
      state = clearExpiredChomps(patch(state, 'A1', { pos: { x: 10, y: 7 } }));
      expect(isChomped(state, byId(state, 'B1'))).toBe(false);
    });

    it('s\'éteint si le joueur est mis à terre', () => {
      const state = clearExpiredChomps(patch(chompedScenario(), 'A1', { stunned: true }));
      expect(byId(state, 'B1').chompedBy).toBeUndefined();
    });

    it('se purge après chaque coup appliqué', () => {
      let state = chompedScenario();
      state = patch(state, 'A1', { pos: { x: 3, y: 3 } });
      state = { ...state, playerActions: {} };
      state = applyMove(state, { type: 'MOVE', playerId: 'A2', to: { x: 2, y: 1 } }, ROLL_3);
      expect(byId(state, 'B1').chompedBy).toBeUndefined();
    });

    it('garde les Croquements encore valides d\'un autre joueur', () => {
      let state = chompedScenario();
      state = patch(state, 'A2', { pos: { x: 12, y: 7 } });
      state = patch(state, 'B1', { chompedBy: ['A1', 'A2'] });
      state = patch(state, 'A1', { pos: { x: 3, y: 3 } });
      state = clearExpiredChomps(state);
      expect(byId(state, 'B1').chompedBy).toEqual(['A2']);
    });

    it('rend le même état quand rien n\'a changé', () => {
      const state = chompedScenario();
      expect(clearExpiredChomps(state)).toBe(state);
    });
  });
});
