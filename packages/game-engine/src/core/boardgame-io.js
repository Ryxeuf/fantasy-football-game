/**
 * Intégration boardgame.io pour Blood Bowl
 * Fournit l'interface nécessaire pour utiliser le moteur de jeu avec boardgame.io
 */
import { setup } from './game-state';
import { applyMove } from '../actions/actions';
import { makeRNG } from '../utils/rng';
import { clearDiceResult } from './game-state';
/**
 * Crée l'objet de jeu pour boardgame.io
 * @returns Configuration du jeu pour boardgame.io
 */
export function toBGIOGame() {
  return {
    name: 'bloobowl',
    setup: () => setup(),
    moves: {
      MOVE: (G, ctx, args) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(G, { type: 'MOVE', playerId: args.playerId, to: args.to }, rng);
        Object.assign(G, s2);
      },
      DODGE: (G, ctx, args) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(
          G,
          { type: 'DODGE', playerId: args.playerId, from: args.from, to: args.to },
          rng
        );
        Object.assign(G, s2);
      },
      BLOCK: (G, ctx, args) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(
          G,
          { type: 'BLOCK', playerId: args.playerId, targetId: args.targetId },
          rng
        );
        Object.assign(G, s2);
      },
      END_TURN: (G, ctx) => {
        const rng = makeRNG(String(ctx.turn || 1));
        const s2 = applyMove(G, { type: 'END_TURN' }, rng);
        Object.assign(G, s2);
      },
      CLEAR_DICE_RESULT: G => {
        const s2 = clearDiceResult(G);
        Object.assign(G, s2);
      },
    },
    turn: {
      // alterne automatiquement entre 2 joueurs
      order: {
        first: () => 0,
        next: (G, ctx) => (ctx.playOrderPos + 1) % 2,
      },
    },
  };
}
