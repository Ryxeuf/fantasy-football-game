/**
 * Tests skill awareness sur le scoring de block.
 *
 * Issu de l'audit IA 2026-05-19 (cf. `docs/ai-audit-2026-05-19.md`,
 * quick win #2) — avant ces changements, `estimateBlockKnockdown`
 * ignorait totalement les skills (Block, Dodge, Tackle, Wrestle,
 * Dauntless, Horns) : l'IA evaluait identiquement un block contre un
 * Lineman vanilla et contre un Blitzer avec Block+Dodge.
 *
 * Cible : verifier que la probabilite de knockdown et le score du
 * coup BLOCK varient de la maniere attendue selon les skills presents.
 */

import { describe, it, expect } from 'vitest';

import { setup } from '../core/game-state';
import type { GameState, Player, Move, TeamId } from '../core/types';

import { scoreMove } from './evaluator';

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    team: 'A',
    pos: { x: 5, y: 5 },
    name: 'Lineman',
    number: 1,
    position: 'Lineman',
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: [],
    pm: 6,
    state: 'active',
    ...overrides,
  };
}

function baseState(players: Player[], overrides: Partial<GameState> = {}): GameState {
  return { ...setup(), players, ...overrides };
}

function blockMove(attackerId: string, targetId: string): Extract<Move, { type: 'BLOCK' }> {
  return { type: 'BLOCK', playerId: attackerId, targetId };
}

const TEAM: TeamId = 'A';

describe('IA: skill awareness sur BLOCK — defenseur', () => {
  it('un defenseur avec Block reduit le score d un block adverse', () => {
    const atk = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const defVanilla = makePlayer({ id: 'b1', team: 'B', pos: { x: 11, y: 7 } });
    const defBlock = makePlayer({ ...defVanilla, skills: ['Block'] });

    const sVanilla = scoreMove(baseState([atk, defVanilla]), blockMove('a1', 'b1'), TEAM);
    const sBlock = scoreMove(baseState([atk, defBlock]), blockMove('a1', 'b1'), TEAM);

    expect(sBlock).toBeLessThan(sVanilla);
  });

  it('un defenseur avec Dodge reduit le score si l attaquant n a pas Tackle', () => {
    const atk = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const defVanilla = makePlayer({ id: 'b1', team: 'B', pos: { x: 11, y: 7 } });
    const defDodge = makePlayer({ ...defVanilla, skills: ['Dodge'] });

    const sVanilla = scoreMove(baseState([atk, defVanilla]), blockMove('a1', 'b1'), TEAM);
    const sDodge = scoreMove(baseState([atk, defDodge]), blockMove('a1', 'b1'), TEAM);

    expect(sDodge).toBeLessThan(sVanilla);
  });

  it('Tackle attaquant annule l effet Dodge defenseur', () => {
    const atkVanilla = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const atkTackle = makePlayer({ ...atkVanilla, skills: ['Tackle'] });
    const defDodge = makePlayer({ id: 'b1', team: 'B', pos: { x: 11, y: 7 }, skills: ['Dodge'] });

    const sNoTackle = scoreMove(baseState([atkVanilla, defDodge]), blockMove('a1', 'b1'), TEAM);
    const sTackle = scoreMove(baseState([atkTackle, defDodge]), blockMove('a1', 'b1'), TEAM);

    expect(sTackle).toBeGreaterThan(sNoTackle);
  });

  it('un defenseur avec Wrestle reduit (legerement) le score', () => {
    const atk = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const defVanilla = makePlayer({ id: 'b1', team: 'B', pos: { x: 11, y: 7 } });
    const defWrestle = makePlayer({ ...defVanilla, skills: ['Wrestle'] });

    const sVanilla = scoreMove(baseState([atk, defVanilla]), blockMove('a1', 'b1'), TEAM);
    const sWrestle = scoreMove(baseState([atk, defWrestle]), blockMove('a1', 'b1'), TEAM);

    expect(sWrestle).toBeLessThan(sVanilla);
  });
});

describe('IA: skill awareness sur BLOCK — attaquant', () => {
  it('Block attaquant ameliore le score (selfRisk reduit)', () => {
    // En 1D egal (atk ST 3 vs def ST 3) il y a un vrai selfRisk : Block
    // attaquant doit ameliorer significativement le score.
    const atkVanilla = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 } });
    const atkBlock = makePlayer({ ...atkVanilla, skills: ['Block'] });
    const def = makePlayer({ id: 'b1', team: 'B', pos: { x: 11, y: 7 } });

    const sVanilla = scoreMove(baseState([atkVanilla, def]), blockMove('a1', 'b1'), TEAM);
    const sBlock = scoreMove(baseState([atkBlock, def]), blockMove('a1', 'b1'), TEAM);

    expect(sBlock).toBeGreaterThan(sVanilla);
  });

  it('Dauntless permet un block 1:1 face a une cible plus forte (vs sans skill)', () => {
    const atkVanilla = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 }, st: 3 });
    const atkDauntless = makePlayer({ ...atkVanilla, skills: ['Dauntless'] });
    const bigDef = makePlayer({ id: 'b1', team: 'B', pos: { x: 11, y: 7 }, st: 5 });

    const sVanilla = scoreMove(baseState([atkVanilla, bigDef]), blockMove('a1', 'b1'), TEAM);
    const sDauntless = scoreMove(baseState([atkDauntless, bigDef]), blockMove('a1', 'b1'), TEAM);

    expect(sDauntless).toBeGreaterThan(sVanilla);
  });

  it('Dauntless est inutile contre une cible de force <= attaquant', () => {
    const atkVanilla = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 }, st: 3 });
    const atkDauntless = makePlayer({ ...atkVanilla, skills: ['Dauntless'] });
    const equalDef = makePlayer({ id: 'b1', team: 'B', pos: { x: 11, y: 7 }, st: 3 });

    const sVanilla = scoreMove(baseState([atkVanilla, equalDef]), blockMove('a1', 'b1'), TEAM);
    const sDauntless = scoreMove(baseState([atkDauntless, equalDef]), blockMove('a1', 'b1'), TEAM);

    expect(sDauntless).toBeCloseTo(sVanilla, 5);
  });
});

describe('IA: skill awareness sur BLITZ — Horns', () => {
  it('Horns ameliore le score d un blitz vs un block equivalent', () => {
    // Horns donne +1 ST sur un blitz (pas un block normal). On compare
    // donc deux blitzs : un avec Horns, un sans. Comme la mecanique est
    // active uniquement sur le blitz, il faut un attaquant avec Horns
    // confronte a une cible de meme force : sans Horns, ratio 3 vs 3
    // = 1D. Avec Horns, ratio 4 vs 3 = 2D attaquant.
    const atkVanilla = makePlayer({ id: 'a1', team: 'A', pos: { x: 10, y: 7 }, st: 3, pm: 7 });
    const atkHorns = makePlayer({ ...atkVanilla, skills: ['Horns'] });
    const def = makePlayer({ id: 'b1', team: 'B', pos: { x: 12, y: 7 }, st: 3 });

    const blitzMove: Extract<Move, { type: 'BLITZ' }> = {
      type: 'BLITZ',
      playerId: 'a1',
      targetId: 'b1',
      to: { x: 11, y: 7 },
    };

    const sVanilla = scoreMove(baseState([atkVanilla, def]), blitzMove, TEAM);
    const sHorns = scoreMove(baseState([atkHorns, def]), blitzMove, TEAM);

    expect(sHorns).toBeGreaterThan(sVanilla);
  });
});
