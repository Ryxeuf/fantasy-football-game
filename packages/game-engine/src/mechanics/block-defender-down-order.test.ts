/**
 * Défenseur Plaqué / Bousculé : le livre applique le Repoussé D'ABORD,
 * puis plaque la cible « sur la case où elle se trouve à présent ».
 *
 * Le moteur faisait l'inverse (plaquer + jet d'armure, puis pousser),
 * avec deux effets de bord visibles :
 *  - poussée hors du terrain : la cible encaissait le jet de blessure du
 *    blocage PUIS la Blessure par le Public — deux jets, deux « morts » ;
 *  - porteur du ballon : le ballon était lâché sur la case de DÉPART,
 *    alors que la cible avait déjà été déplacée.
 */

import { describe, expect, it } from 'vitest';
import { resolveBlockResult } from './blocking';
import { setup } from '../core/game-state';
import type { BlockResult, GameState, Player, RNG } from '../core/types';

/** RNG déterministe : rend toujours la même valeur (jets maximaux). */
function fixedRng(value: number): RNG {
  return () => value;
}

interface Fixture {
  readonly state: GameState;
  readonly attacker: Player;
  readonly target: Player;
}

/**
 * Deux joueurs adjacents. `targetPos` permet de coller la cible à la
 * ligne de touche pour forcer la sortie de terrain.
 */
function fixture(opts: {
  attackerPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  targetHasBall?: boolean;
}): Fixture {
  const base = setup();
  const [a, b] = base.players;
  const attacker: Player = {
    ...a,
    id: 'atk',
    team: 'A',
    pos: opts.attackerPos,
    st: 3,
    av: 9,
    stunned: false,
    hasBall: false,
  };
  const target: Player = {
    ...b,
    id: 'def',
    team: 'B',
    pos: opts.targetPos,
    st: 3,
    av: 9,
    stunned: false,
    hasBall: opts.targetHasBall ?? false,
  };
  const state: GameState = {
    ...base,
    players: [attacker, target],
    ball: opts.targetHasBall ? { ...opts.targetPos } : base.ball,
  };
  return { state, attacker, target };
}

function resolve(f: Fixture, result: BlockResult, rng: RNG): GameState {
  return resolveBlockResult(
    f.state,
    {
      type: 'block',
      playerId: f.attacker.id,
      targetId: f.target.id,
      diceRoll: 5,
      result,
      offensiveAssists: 0,
      defensiveAssists: 0,
      totalStrength: 3,
      targetStrength: 3,
    },
    rng,
  );
}

function countLogs(state: GameState, re: RegExp): number {
  return state.gameLog.filter((l) => re.test(l.message)).length;
}

describe.each<BlockResult>(['POW', 'STUMBLE'])(
  'ordre « repousser puis plaquer » — %s',
  (result) => {
    it("poussé hors du terrain : un seul jet de blessure (la foule), pas celui du blocage", () => {
      // Cible sur la ligne de touche (y = 0), attaquant juste en dessous :
      // toutes les cases de poussée sont hors du terrain.
      const f = fixture({ attackerPos: { x: 10, y: 1 }, targetPos: { x: 10, y: 0 } });
      const out = resolve(f, result, fixedRng(0.99));

      expect(countLogs(out, /poussé dans la foule/i)).toBe(1);
      expect(countLogs(out, /Jet de blessure/i)).toBe(1);
      expect(countLogs(out, /Jet de blessure \(foule\)/i)).toBe(1);
      // Le jet d'armure du blocage n'a pas lieu : pas de case où plaquer.
      expect(countLogs(out, /Jet d'armure/i)).toBe(0);
    });

    it("reste sur le terrain : le jet d'armure du blocage a bien lieu", () => {
      const f = fixture({ attackerPos: { x: 10, y: 10 }, targetPos: { x: 11, y: 10 } });
      const out = resolve(f, result, fixedRng(0.99));

      expect(countLogs(out, /Jet d'armure/i)).toBe(1);
      expect(countLogs(out, /poussé dans la foule/i)).toBe(0);
    });

    it("Stand Firm : la prédiction de sortie ne diverge pas de la poussée", () => {
      // Un joueur tout juste plaqué par Défenseur Plaqué / Bousculé n'est
      // plus debout : `handlePushWithChoice` refuse donc Stand Firm et le
      // pousse quand même hors du terrain. La prédiction doit lire le même
      // état, sinon le jet d'armure du blocage revient s'ajouter à la
      // Blessure par le Public.
      const f = fixture({ attackerPos: { x: 10, y: 1 }, targetPos: { x: 10, y: 0 } });
      const withStandFirm: GameState = {
        ...f.state,
        players: f.state.players.map((p) =>
          p.id === 'def' ? { ...p, skills: [...(p.skills ?? []), 'stand-firm'] } : p,
        ),
      };

      const out = resolve({ ...f, state: withStandFirm }, result, fixedRng(0.99));

      // Exactement un jet de blessure, quel que soit le chemin emprunté.
      expect(countLogs(out, /Jet de blessure/i)).toBe(1);
    });

    it('le porteur du ballon le lâche sur sa case d’arrivée, pas sur celle de départ', () => {
      // Attaquant en (10,1), cible en (11,0) contre la ligne de touche :
      // des trois cases de poussée, seule (12,0) est sur le terrain — la
      // poussée est donc appliquée immédiatement, sans choix de direction.
      const f = fixture({
        attackerPos: { x: 10, y: 1 },
        targetPos: { x: 11, y: 0 },
        targetHasBall: true,
      });

      // Jets minimaux : l'armure tient, la cible reste sur le terrain.
      const out = resolve(f, result, fixedRng(0));
      const moved = out.players.find((p) => p.id === 'def');

      // La cible a bien été déplacée, et n'est pas sortie du terrain.
      expect(moved?.pos).toEqual({ x: 12, y: 0 });
      // Le porteur a lâché le ballon sur sa case d'arrivée.
      expect(moved?.hasBall).toBe(false);
      expect(out.ball).toEqual({ x: 12, y: 0 });
    });
  },
);
