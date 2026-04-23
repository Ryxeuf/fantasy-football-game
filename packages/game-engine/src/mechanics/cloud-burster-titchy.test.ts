import { describe, it, expect } from 'vitest';
import {
  setup,
  type GameState,
  type Player,
  type RNG,
} from '../index';
import {
  getAdjacentOpponents,
  calculateDodgeModifiers,
  calculatePickupModifiers,
} from './movement';
import { canBlock } from './blocking';
import { executePass } from './passing';

/**
 * O.1 batch 3g — Skills niche :
 * - Cloud Burster (passing) : sur une passe Long ou Bomb, le passeur peut
 *   forcer l'adversaire a relancer une interception reussie (une fois par passe).
 * - Titchy (trait) : le joueur n'exerce pas de zone de tacle et ne peut pas
 *   declarer d'action de blocage (les joueurs tres petits comme Gobelins,
 *   Halflings, Lineman Gnome, Skink, etc.).
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

describe('Trait: Titchy — pas de zone de tacle', () => {
  it('un joueur adverse titchy n\'est pas compte comme adjacent (pas de TZ)', () => {
    let s = setup();
    // A1 en (5,5), B1 adjacent en (6,5) avec titchy.
    s = patchPlayer(s, 'A1', { pos: { x: 5, y: 5 }, skills: [] });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: ['titchy'] });
    // Eloigner les autres pour eviter des TZ parasites.
    s = patchPlayer(s, 'A2', { pos: { x: 0, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });

    const opponents = getAdjacentOpponents(s, { x: 5, y: 5 }, 'A');
    expect(opponents).toHaveLength(0);
  });

  it('un joueur adverse non-titchy exerce toujours sa TZ', () => {
    let s = setup();
    s = patchPlayer(s, 'A1', { pos: { x: 5, y: 5 }, skills: [] });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: [] });
    s = patchPlayer(s, 'A2', { pos: { x: 0, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });

    const opponents = getAdjacentOpponents(s, { x: 5, y: 5 }, 'A');
    expect(opponents).toHaveLength(1);
  });

  it('calculateDodgeModifiers : 0 malus quand la case d\'arrivee a un adversaire titchy adjacent', () => {
    let s = setup();
    // A1 dodge de (5,5) vers (6,5). B1 titchy adjacent a la case d\'arrivee.
    s = patchPlayer(s, 'A1', { pos: { x: 5, y: 5 }, skills: [] });
    s = patchPlayer(s, 'B1', { pos: { x: 7, y: 5 }, skills: ['titchy'] });
    s = patchPlayer(s, 'A2', { pos: { x: 0, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });

    const mod = calculateDodgeModifiers(s, { x: 5, y: 5 }, { x: 6, y: 5 }, 'A');
    // Sans titchy, -1 ; avec titchy sur le marqueur, 0.
    expect(mod).toBe(0);
  });

  it('calculatePickupModifiers : 0 malus quand un adversaire adjacent a titchy', () => {
    let s = setup();
    // La balle est en (5,5) ; B1 titchy adjacent.
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: ['titchy'] });
    s = patchPlayer(s, 'A2', { pos: { x: 0, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });

    const mod = calculatePickupModifiers(s, { x: 5, y: 5 }, 'A');
    expect(mod).toBe(0);
  });

  it('titchy ne filtre pas les autres adversaires adjacents', () => {
    let s = setup();
    // A1 en (5,5) ; B1 titchy en (6,5), B2 normal en (5,6).
    s = patchPlayer(s, 'A1', { pos: { x: 5, y: 5 }, skills: [] });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: ['titchy'] });
    s = patchPlayer(s, 'B2', { pos: { x: 5, y: 6 }, skills: [] });
    s = patchPlayer(s, 'A2', { pos: { x: 0, y: 0 } });

    const opponents = getAdjacentOpponents(s, { x: 5, y: 5 }, 'A');
    expect(opponents.map(p => p.id)).toEqual(['B2']);
  });
});

describe('Trait: Titchy — ne peut pas effectuer de Block', () => {
  it('canBlock : un joueur titchy ne peut pas initier un blocage', () => {
    let s = setup();
    // A2 adjacent a B1, mais A2 a titchy -> pas de block autorise.
    s = patchPlayer(s, 'A2', {
      pos: { x: 10, y: 5 },
      skills: ['titchy'],
      pm: 6,
    });
    s = patchPlayer(s, 'B1', { pos: { x: 11, y: 5 }, skills: [], pm: 6 });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });

    expect(canBlock(s, 'A2', 'B1')).toBe(false);
  });

  it('canBlock : un joueur non-titchy peut toujours bloquer normalement', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 10, y: 5 }, skills: [], pm: 6 });
    s = patchPlayer(s, 'B1', { pos: { x: 11, y: 5 }, skills: [], pm: 6 });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });

    expect(canBlock(s, 'A2', 'B1')).toBe(true);
  });
});

describe('Passing skill: Cloud Burster', () => {
  function setupInterceptionScenario(passerSkills: string[]): GameState {
    let s = setup();
    // A1 passeur en (5,5), A2 cible eloignee (Long range : 10 cases).
    // B1 intercepteur sur la trajectoire en (10,5).
    s = patchPlayer(s, 'A1', {
      pos: { x: 5, y: 5 },
      skills: passerSkills,
      hasBall: true,
      pa: 3,
    });
    s = patchPlayer(s, 'A2', {
      pos: { x: 15, y: 5 },
      skills: [],
      ag: 4,
    });
    s = patchPlayer(s, 'B1', {
      pos: { x: 10, y: 5 },
      skills: [],
      ag: 3,
    });
    // Eloigner pour ne pas influencer la trajectoire.
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    return {
      ...s,
      currentPlayer: 'A',
      ball: undefined,
    };
  }

  it('force le reroll d\'une interception reussie sur Long range (succes -> echec)', () => {
    const s = setupInterceptionScenario(['cloud-burster']);
    const passer = s.players.find(p => p.id === 'A1')!;
    const target = s.players.find(p => p.id === 'A2')!;
    // B1 AG 3, interception = -2 de base -> target AG - (-2) = 5.
    // 1er jet : 6 (0.95 -> 6) = succes
    // Reroll force : 2 (0.16 -> 2) = echec
    // Puis jet de passe A1 PA 3 sur Long (-1) : 6 (0.95) = succes
    // Puis jet de catch A2 AG 4 : 6 (0.95) = succes
    const rng = scriptedRng([0.95, 0.16, 0.95, 0.95]);
    const result = executePass(s, passer, target, rng);

    // Pas de turnover.
    expect(result.isTurnover).toBeFalsy();
    // Le receveur a le ballon (passe + catch reussis apres echec de l'interception rerollee).
    const receiver = result.players.find(p => p.id === 'A2')!;
    expect(receiver.hasBall).toBe(true);
    // Log contient une mention Cloud Burster.
    const logText = result.gameLog.map(e => e.message).join('\n');
    expect(logText).toMatch(/Cloud Burster/i);
  });

  it('sans Cloud Burster, une interception reussie n\'est pas rerollee (turnover)', () => {
    const s = setupInterceptionScenario([]);
    const passer = s.players.find(p => p.id === 'A1')!;
    const target = s.players.find(p => p.id === 'A2')!;
    const rng = scriptedRng([0.95, 0.16, 0.95]);
    const result = executePass(s, passer, target, rng);

    // L'interception a reussi, turnover.
    expect(result.isTurnover).toBe(true);
    const interceptor = result.players.find(p => p.id === 'B1')!;
    expect(interceptor.hasBall).toBe(true);
  });

  it('sur Quick range, Cloud Burster n\'a AUCUN effet (pas de reroll)', () => {
    let s = setup();
    // Distance 3 = Quick. A1 en (5,5), A2 en (8,5). B1 sur (6,5) ou (7,5).
    s = patchPlayer(s, 'A1', {
      pos: { x: 5, y: 5 },
      skills: ['cloud-burster'],
      hasBall: true,
      pa: 3,
    });
    s = patchPlayer(s, 'A2', { pos: { x: 8, y: 5 }, skills: [], ag: 4 });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: [], ag: 3 });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    s = { ...s, currentPlayer: 'A', ball: undefined };

    const passer = s.players.find(p => p.id === 'A1')!;
    const target = s.players.find(p => p.id === 'A2')!;
    // Interception (AG 3 -> target 5) 1er jet : 6 (succes) -> pas de reroll CB sur Quick
    const rng = scriptedRng([0.95, 0.16]);
    const result = executePass(s, passer, target, rng);

    // L'interception tient -> turnover.
    expect(result.isTurnover).toBe(true);
    const interceptor = result.players.find(p => p.id === 'B1')!;
    expect(interceptor.hasBall).toBe(true);
    const logText = result.gameLog.map(e => e.message).join('\n');
    expect(logText).not.toMatch(/Cloud Burster/i);
  });

  it('Cloud Burster ne declenche pas de reroll si l\'interception echoue directement', () => {
    const s = setupInterceptionScenario(['cloud-burster']);
    const passer = s.players.find(p => p.id === 'A1')!;
    const target = s.players.find(p => p.id === 'A2')!;
    // Interception rate (1), passe reussie, catch reussi.
    const rng = scriptedRng([0.0, 0.95, 0.95]);
    const result = executePass(s, passer, target, rng);

    expect(result.isTurnover).toBeFalsy();
    const logText = result.gameLog.map(e => e.message).join('\n');
    expect(logText).not.toMatch(/Cloud Burster/i);
  });

  it('Cloud Burster sur Bomb range : reroll applique (succes -> echec)', () => {
    let s = setup();
    // Distance 13 = Bomb. A1 en (5,5), A2 en (18,5), B1 intercepteur en (12,5).
    s = patchPlayer(s, 'A1', {
      pos: { x: 5, y: 5 },
      skills: ['cloud-burster'],
      hasBall: true,
      pa: 3,
    });
    s = patchPlayer(s, 'A2', { pos: { x: 18, y: 5 }, skills: [], ag: 4 });
    s = patchPlayer(s, 'B1', { pos: { x: 12, y: 5 }, skills: [], ag: 4 });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    s = { ...s, currentPlayer: 'A', ball: undefined };

    const passer = s.players.find(p => p.id === 'A1')!;
    const target = s.players.find(p => p.id === 'A2')!;
    // Interception AG 4 -> -2 base = target 6. 1er jet : 6 (succes), reroll : 2 (echec)
    // puis pass PA 3 sur Bomb (-2) : 6 (succes), catch AG 4 : 6 (succes)
    const rng = scriptedRng([0.95, 0.16, 0.95, 0.95]);
    const result = executePass(s, passer, target, rng);

    expect(result.isTurnover).toBeFalsy();
    const receiver = result.players.find(p => p.id === 'A2')!;
    expect(receiver.hasBall).toBe(true);
  });
});

describe('Registre des skills: batch 3g', () => {
  it('cloud-burster et titchy sont enregistres dans le skill-registry', async () => {
    const { getSkillEffect } = await import('../skills/skill-registry');
    expect(getSkillEffect('cloud-burster')).toBeDefined();
    expect(getSkillEffect('titchy')).toBeDefined();
  });
});
