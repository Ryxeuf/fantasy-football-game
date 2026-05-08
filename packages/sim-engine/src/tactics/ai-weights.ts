/**
 * Pro League sim — Lot 3.A.0.a : conversion d'un `TacticalProfile`
 * (ex: Halflings, Wood Elves) en `Partial<EvalWeights>` pour
 * piloter l'IA `@bb/game-engine` sans dupliquer la logique
 * d'évaluation.
 *
 * Pourquoi un module séparé
 * -------------------------
 * `@bb/game-engine` ne dépend PAS de `@bb/sim-engine` (cyclic dep).
 * `TacticalProfile` vit côté sim-engine. Le full driver
 * (Lot 3.A.2) appellera `weightsFromProfile(team.tactics)` puis
 * passera le résultat à `pickAIMove(state, team, { weights })`.
 *
 * Mapping retenu
 * --------------
 * Chaque dimension du profil tactique module *un* poids cohérent :
 *
 * - bashIndex (haut = équipe bash, type Orcs / Norse / Khorne) :
 *     ↓ PLAYER_CASUALTY_PENALTY (ils acceptent les pertes)
 *     ↓ CARRIER_TACKLEZONE_PENALTY (le porteur peut prendre des coups)
 * - pace (haut = tempo rapide, Wood Elves / Skaven) :
 *     ↑ BALL_PROGRESS_PER_STEP (chaque case compte)
 *     ↑ CARRIER_IN_ENDZONE_BONUS (rush vers le score)
 * - stallTendency (haut = stalling, Dwarves / Lizardmen défensifs) :
 *     ↓ END_TURN_PENALTY (pas pénalisé pour passer son tour)
 *     ↑ POSITIONING_PER_STEP (chaque positionnement gagne du temps)
 * - patience (haut = construit ses jeux, low = burns blitz) :
 *     ↑ CARRIER_PROTECTION_ALLY (protection prioritaire)
 * - breakawayInstinct (haut = sprint au porteur, Wood Elves) :
 *     ↑ POSSESSION (récupérer/conserver la balle vaut plus)
 * - foulFrequency (haut = Goblins / Underworld) :
 *     traité dans le mapping de `scoreMoveFoul` côté evaluator
 *     (constante interne) — pas de modulation ici au MVP.
 *
 * Tous les multiplicateurs sont bornés à `[0.4, 1.6]` pour éviter
 * qu'un profil extrême ne casse l'IA (poids négatifs ou explosifs).
 */

import type { EvalWeights } from '@bb/game-engine';

import type { TacticalProfile } from './tactical-profile';

/** Borne supérieure et inférieure du multiplicateur appliqué. */
const MIN_FACTOR = 0.4;
const MAX_FACTOR = 1.6;

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(MIN_FACTOR, Math.min(MAX_FACTOR, n));
}

/**
 * Maps un paramètre 0..100 à un facteur multiplicatif `1 ± span` :
 * - paramètre 50 → facteur 1 (neutre)
 * - paramètre 0  → facteur 1 - span
 * - paramètre 100 → facteur 1 + span
 */
function paramFactor(value: number, span: number): number {
  const normalized = Math.max(0, Math.min(100, value));
  const offset = ((normalized - 50) / 50) * span;
  return clamp(1 + offset);
}

/**
 * Dérive un override `Partial<EvalWeights>` depuis un `TacticalProfile`.
 * Les poids non listés (ex: `TOUCHDOWN`, `PLAYER_KO_PENALTY`) gardent
 * leur valeur baseline `EVAL_WEIGHTS` côté game-engine.
 *
 * Le format `Partial` est important : le caller (full driver) peut
 * ne fournir que les poids modifiés, le reste retombe sur la baseline.
 *
 * Span retenu
 * -----------
 * 0.4 sur les axes principaux (pace / bashIndex / stallTendency) :
 * un profil extrême module ±40% du poids de base, suffisant pour
 * différencier visiblement Halflings de Wood Elves sans rendre l'IA
 * incohérente. Span 0.25 sur les axes secondaires.
 */
export function weightsFromProfile(
  profile: TacticalProfile
): Partial<EvalWeights> {
  const bash = paramFactor(profile.bashIndex, 0.4);
  const pace = paramFactor(profile.pace, 0.4);
  const stall = paramFactor(profile.stallTendency, 0.4);
  const patience = paramFactor(profile.patience, 0.25);
  const breakaway = paramFactor(profile.breakawayInstinct, 0.25);

  // Bash teams pénalisent moins les pertes (1 - (bash - 1))
  const casualtyMul = 2 - bash;
  // Pace teams progressent plus
  const progressMul = pace;
  // Stall teams pénalisent moins l'END_TURN
  const endTurnMul = 2 - stall;
  // Patience teams protègent plus le porteur
  const protectionMul = patience;
  // Breakaway teams valorisent plus la possession
  const possessionMul = breakaway;

  return {
    PLAYER_CASUALTY_PENALTY: Math.round(150 * clamp(casualtyMul)),
    CARRIER_TACKLEZONE_PENALTY: Math.round(35 * clamp(2 - bash)),
    BALL_PROGRESS_PER_STEP: Math.round(15 * clamp(progressMul)),
    CARRIER_IN_ENDZONE_BONUS: Math.round(250 * clamp(progressMul)),
    END_TURN_PENALTY: Math.max(
      0,
      Math.round(1 * clamp(endTurnMul) * 10) / 10
    ),
    POSITIONING_PER_STEP: Math.max(
      1,
      Math.round(2 * clamp(stall))
    ),
    CARRIER_PROTECTION_ALLY: Math.round(20 * clamp(protectionMul)),
    POSSESSION: Math.round(300 * clamp(possessionMul)),
  };
}
