/**
 * 6 stratégies haut-niveau — sprint Pro League 0.B.1.
 *
 * Chaque stratégie expose :
 * - les patterns qu'elle peut exécuter (lot 0.B.1 patterns library)
 * - une fonction `score(context, profile)` qui retourne sa pertinence
 *   pour la situation courante et le profil tactique de l'équipe.
 *
 * Le driver hybride passe la liste complète à un softmax (température
 * pilotée par `riskAppetite` — lot 0.B.5) pour choisir la stratégie
 * du tour.
 */

import type { TacticalProfile } from '../../tactics/tactical-profile';
import type { DriveContext, Strategy } from '../types';

/** `cage-build` — prendre l'avancée yards en formation cage. Idéal
 *  pour les bash teams en possession. */
const CAGE_BUILD: Strategy = {
  id: 'cage-build',
  patterns: ['cage-formation', 'line-grind'],
  score: (ctx, p) => {
    if (!ctx.hasPossession) return 0;
    return p.cageAffinity / 100 + p.bashIndex / 200 + (ctx.pastMidfield ? 0.2 : 0);
  },
};

/** `breakaway` — coup-de-poker rapide via dodge / pass / GFI chains.
 *  Idéal pour Wood Elves, Skaven, Halflings underdogs. */
const BREAKAWAY: Strategy = {
  id: 'breakaway',
  patterns: ['pass-route-deep'],
  score: (ctx, p) => {
    if (!ctx.hasPossession) return 0;
    return (
      p.breakawayInstinct / 100 +
      p.passingFrequency / 200 +
      (ctx.trailing ? 0.3 : 0) +
      (ctx.inRedZone ? 0.2 : 0)
    );
  },
};

/** `defensive-screen` — ligne défensive serrée pour récupérer la balle.
 *  Idéal en défense (pas de possession). */
const DEFENSIVE_SCREEN: Strategy = {
  id: 'defensive-screen',
  patterns: ['screen'],
  score: (ctx, p) => {
    if (ctx.hasPossession) return 0;
    return p.screenAffinity / 100 + p.pressingDefense / 200;
  },
};

/** `blitz-train` — ramener la cavalerie sur le porteur de balle. */
const BLITZ_TRAIN: Strategy = {
  id: 'blitz-train',
  patterns: ['wedge'],
  score: (ctx, p) => {
    if (ctx.hasPossession) return 0.05; // useable at low base when in possession
    return p.blitzPriority / 100 + p.bashIndex / 200 + (ctx.pastMidfield ? 0 : 0.15);
  },
};

/** `stall` — bouffer les tours pour terminer la mi-temps en avance.
 *  Idéal en fin de mi-temps si on mène. */
const STALL: Strategy = {
  id: 'stall',
  patterns: ['cage-formation', 'line-grind'],
  score: (ctx, p) => {
    if (!ctx.hasPossession) return 0;
    return (
      p.stallTendency / 100 +
      (ctx.lateInHalf && ctx.leading ? 0.6 : 0) +
      p.patience / 300
    );
  },
};

/** `foul-fest` — démolir les stars adverses prone via fouls répétés.
 *  Profils Norse / Goblin / Chaos. */
const FOUL_FEST: Strategy = {
  id: 'foul-fest',
  patterns: ['line-grind'],
  score: (_ctx: DriveContext, p: TacticalProfile) => {
    return p.foulFrequency / 100 + (p.bashIndex >= 70 ? 0.1 : 0);
  },
};

/** Catalogue complet des 6 stratégies déclarées par le sprint. */
export const STRATEGIES: readonly Strategy[] = Object.freeze([
  CAGE_BUILD,
  BREAKAWAY,
  DEFENSIVE_SCREEN,
  BLITZ_TRAIN,
  STALL,
  FOUL_FEST,
]);

export const STRATEGY_BY_ID: Readonly<Record<string, Strategy>> = Object.freeze(
  Object.fromEntries(STRATEGIES.map((s) => [s.id, s]))
);
