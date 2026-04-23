import { describe, it, expect } from 'vitest';
import {
  setup,
  applyMove,
  makeRNG,
  type GameState,
  type Player,
  type RNG,
} from '../index';
import { getArmBarBonus } from './arm-bar';

function scriptedRng(values: number[]): RNG {
  let idx = 0;
  return () => {
    const v = values[idx % values.length];
    idx += 1;
    return v;
  };
}

/**
 * O.1 batch 3g — Arm Bar (Cle de Bras)
 *
 * +1 au jet d'Armure (ou Blessure) du joueur adverse qui Tombe en ratant
 * une esquive/Saut/Bond pour quitter une case ou il etait marque par ce
 * joueur.
 */

function patchPlayer(state: GameState, id: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map(p => (p.id === id ? { ...p, ...patch } : p)),
  };
}

describe('Arm Bar : helper getArmBarBonus', () => {
  it('retourne 0 si aucun adversaire adjacent a la case d\'origine', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 } });
    s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 0 } });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(0);
  });

  it('retourne 0 si l\'adversaire adjacent n\'a pas arm-bar', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 } });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: ['tackle'] });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(0);
  });

  it('retourne +1 si un adversaire adjacent a arm-bar', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 } });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: ['arm-bar'] });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(1);
  });

  it('reste a +1 meme avec plusieurs adversaires arm-bar adjacents (non cumulatif)', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 } });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: ['arm-bar'] });
    s = patchPlayer(s, 'B2', { pos: { x: 4, y: 5 }, skills: ['arm-bar'] });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(1);
  });

  it('ignore un adversaire arm-bar s\'il est sonne (stunned)', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 } });
    s = patchPlayer(s, 'B1', {
      pos: { x: 6, y: 5 },
      skills: ['arm-bar'],
      stunned: true,
      state: 'stunned',
    });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(0);
  });

  it('ignore un adversaire arm-bar mis Knocked Out', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 } });
    s = patchPlayer(s, 'B1', {
      pos: { x: 6, y: 5 },
      skills: ['arm-bar'],
      state: 'knocked_out',
    });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(0);
  });

  it('ignore un coequipier ayant arm-bar (ne s\'applique pas en friendly fire)', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 } });
    s = patchPlayer(s, 'A1', { pos: { x: 6, y: 5 }, skills: ['arm-bar'] });
    s = patchPlayer(s, 'B1', { pos: { x: 25, y: 14 } });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(0);
  });

  it('utilise la position d\'origine, pas la position courante du dodger', () => {
    let s = setup();
    // Dodger est passe de (5,5) a (6,5) ; un adversaire arm-bar etait
    // adjacent a (5,5).
    s = patchPlayer(s, 'A2', { pos: { x: 6, y: 5 } });
    s = patchPlayer(s, 'B1', { pos: { x: 4, y: 5 }, skills: ['arm-bar'] }); // adjacent a (5,5)
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    const dodger = s.players.find(p => p.id === 'A2')!;
    expect(getArmBarBonus(s, dodger, { x: 5, y: 5 })).toBe(1);
    // Sans le `from`, B1 (4,5) n'est pas adjacent au dodger (6,5)
    expect(getArmBarBonus(s, dodger, dodger.pos)).toBe(0);
  });
});

describe('Arm Bar : integration via dodge failure', () => {
  it('applique +1 au target d\'armure quand un esquive echoue dans la TZ d\'un arm-bar', () => {
    let s = setup();
    // A2 (AV 9) tente d'esquiver depuis (5,5) vers (5,6).
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 }, av: 9, ag: 3, pm: 6, skills: [] });
    // B1 (arm-bar) marque (5,5).
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: ['arm-bar'] });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
    // Pas de relance d'equipe.
    s = { ...s, teamRerolls: { teamA: 0, teamB: 0 }, currentPlayer: 'A' };

    // Premier rng() = jet d'esquive (force echec : 0.01 -> D6=1).
    // Second rng() = die1 d'armure, troisieme = die2.
    const rng = scriptedRng([0.01, 0.5, 0.5]);
    const result = applyMove(s, { type: 'MOVE', playerId: 'A2', to: { x: 5, y: 6 } }, rng);

    // Doit y avoir un log d'armure mentionnant Arm Bar.
    const armorLog = result.gameLog.find(e =>
      e.message.includes('Arm Bar') && e.message.startsWith("Jet d'armure"),
    );
    expect(armorLog).toBeDefined();
    expect(armorLog!.message).toContain('+1');
    // Turnover declenche par l'esquive ratee.
    expect(result.isTurnover).toBe(true);
  });

  it('aucun marqueur Arm Bar dans le log si aucun adversaire arm-bar adjacent a la case d\'origine', () => {
    let s = setup();
    s = patchPlayer(s, 'A2', { pos: { x: 5, y: 5 }, av: 9, ag: 3, pm: 6, skills: [] });
    s = patchPlayer(s, 'B1', { pos: { x: 6, y: 5 }, skills: [] });
    s = patchPlayer(s, 'B2', { pos: { x: 25, y: 14 } });
    s = patchPlayer(s, 'A1', { pos: { x: 0, y: 0 } });
    s = { ...s, teamRerolls: { teamA: 0, teamB: 0 }, currentPlayer: 'A' };

    const rng = scriptedRng([0.01, 0.5, 0.5]);
    const result = applyMove(s, { type: 'MOVE', playerId: 'A2', to: { x: 5, y: 6 } }, rng);

    const armorLog = result.gameLog.find(e => e.message.startsWith("Jet d'armure"));
    expect(armorLog).toBeDefined();
    expect(armorLog!.message).not.toContain('Arm Bar');
  });
});
