/**
 * Combat misc corrections BB2020 :
 *  1. Juggernaut sur Blitz annule Wrestle de la cible.
 *  2. Stand Firm ne s'applique pas si la cible vient de tomber (POW/STUMBLE).
 *  3. Projectile Vomit reussi : pm=0 (activation termine).
 *  4. Chainsaw self-hit : casualty NON-creditee a l'attaquant.
 */
import { describe, it, expect } from 'vitest';
import { setup } from '../core/game-state';
import { resolveBlockResult } from './blocking';
import { executeProjectileVomit } from './projectile-vomit';
import { executeChainsaw } from './chainsaw';
import type { GameState, Player, RNG } from '../core/types';

function basePlayer(over: Partial<Player>): Player {
  return {
    id: 'X', team: 'A', pos: { x: 5, y: 5 }, name: 'X', number: 1,
    position: 'Lineman', ma: 6, st: 3, ag: 3, pa: 4, av: 7,
    skills: [], pm: 6, state: 'active',
    ...over,
  };
}

function makeState(players: Player[]): GameState {
  const s = setup();
  return { ...s, players, currentPlayer: 'A', playerActions: {}, matchStats: {} };
}

function makeRNG(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

function bothDownResult(attackerId: string, targetId: string) {
  return {
    type: 'block' as const,
    playerId: attackerId,
    targetId,
    diceRoll: 2,
    result: 'BOTH_DOWN' as const,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

function powResult(attackerId: string, targetId: string) {
  return {
    type: 'block' as const,
    playerId: attackerId,
    targetId,
    diceRoll: 5,
    result: 'POW' as const,
    offensiveAssists: 0,
    defensiveAssists: 0,
    totalStrength: 3,
    targetStrength: 3,
  };
}

describe('1. Juggernaut anti-Wrestle (BB2020)', () => {
  it('Juggernaut+Block attaquant sur Blitz contre Wrestle defenseur : Wrestle annule', () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['juggernaut', 'block'] }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, skills: ['wrestle'] }),
    ];
    const state: GameState = {
      ...makeState(players),
      playerActions: { A1: 'BLITZ' },
    };

    const result = resolveBlockResult(state, bothDownResult('A1', 'B1'), makeRNG([0.5, 0.5, 0.5]));

    // Avec Juggernaut+Block : attaquant Block negate fall + Juggernaut
    // negate target Wrestle. Cible tombe (Block != Wrestle pour cette
    // path), attaquant reste debout.
    const attacker = result.players.find((p) => p.id === 'A1')!;
    const target = result.players.find((p) => p.id === 'B1')!;
    expect(attacker.stunned).toBeFalsy();
    expect(target.stunned).toBe(true);
  });

  it('Pas de Juggernaut : Wrestle s\'applique normalement (les 2 tombent)', () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['block'] }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, skills: ['wrestle'] }),
    ];
    const state: GameState = {
      ...makeState(players),
      playerActions: { A1: 'BLOCK' },
    };

    const result = resolveBlockResult(state, bothDownResult('A1', 'B1'), makeRNG([0.5, 0.5]));

    const attacker = result.players.find((p) => p.id === 'A1')!;
    const target = result.players.find((p) => p.id === 'B1')!;
    // Wrestle : les deux tombent
    expect(attacker.stunned).toBe(true);
    expect(target.stunned).toBe(true);
  });
});

describe('2. Stand Firm sur POW (BB2020)', () => {
  it("Stand Firm ne s'applique PAS sur POW (le joueur vient de tomber)", () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 } }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, skills: ['stand-firm'] }),
    ];
    const state = makeState(players);

    const result = resolveBlockResult(state, powResult('A1', 'B1'), makeRNG([0.5, 0.5, 0.5, 0.5]));

    // Apres POW + push : la cible est stunned ET deplacee (Stand Firm
    // n'a pas pu s'appliquer car elle vient de tomber). Position != initiale.
    const target = result.players.find((p) => p.id === 'B1')!;
    expect(target.stunned).toBe(true);
    // Le push a deplace la cible : x != 6 OU y != 5.
    expect(target.pos.x === 6 && target.pos.y === 5).toBe(false);
  });
});

describe('3. Projectile Vomit : pm=0 sur succes (BB2020)', () => {
  it('PV reussi termine l\'activation (pm=0)', () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['projectile-vomit'], pm: 5 }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 } }),
    ];
    const state = makeState(players);

    // RNG : 0.5 → die=4 → 2+ success. Puis armor 0.5/0.5 (tient).
    const result = executeProjectileVomit(state, players[0], players[1], makeRNG([0.5, 0.5, 0.5, 0.5]));

    const vomiter = result.players.find((p) => p.id === 'A1')!;
    expect(vomiter.pm).toBe(0);
  });

  it('PV echoue termine aussi l\'activation (comportement preserve)', () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['projectile-vomit'], pm: 5 }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 } }),
    ];
    const state = makeState(players);

    // RNG : 0.0 → die=1 → echec.
    const result = executeProjectileVomit(state, players[0], players[1], makeRNG([0.0]));

    const vomiter = result.players.find((p) => p.id === 'A1')!;
    expect(vomiter.pm).toBe(0);
  });
});

describe('4. Chainsaw self-hit non-credite (BB2020)', () => {
  it("auto-blessure (double 1) ne credite PAS l'attaquant de la casualty", () => {
    const players: Player[] = [
      basePlayer({ id: 'A1', team: 'A', pos: { x: 5, y: 5 }, skills: ['chainsaw'], pm: 5 }),
      basePlayer({ id: 'B1', team: 'B', pos: { x: 6, y: 5 }, av: 9 }),
    ];
    const state = makeState(players);

    // RNG initial : roll1=0.0 (die=1), roll2=0.0 (die=1) → double 1 self-hit.
    // Puis selfDie1=0.99, selfDie2=0.99 (armor 5+5=10+3=13>av=7 perce).
    // Puis injury die1=0.99, die2=0.99 (12+ ⇒ casualty).
    const result = executeChainsaw(state, players[0], players[1], makeRNG([0.0, 0.0, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99]));

    // Verifier : aucune casualty creditee a A1 (l'attaquant).
    const a1Stats = result.matchStats?.['A1'];
    expect(a1Stats?.casualties ?? 0).toBe(0);
  });
});
