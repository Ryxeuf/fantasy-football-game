/**
 * Running Pass (BB3 Season 2/3 rules).
 *
 * Quand un joueur avec Running Pass effectue une Action de Passe Rapide, son
 * activation ne se termine pas une fois la passe resolue. Si le joueur a encore
 * de l'allocation de mouvement, il peut continuer a se deplacer apres la passe.
 *
 * Variantes de slug supportees :
 *  - `running-pass` : variante BB3 Season 2 — uniquement Quick Pass.
 *  - `running_pass` : meme effet (compatibilite slug underscore).
 *  - `running-pass-2025` : variante Season 3 — Quick Pass OU Action de Transmission
 *    (Hand-Off). Les autres portees (Short, Long, Long Bomb) restent exclues.
 *
 * Conditions d'activation (toutes obligatoires) :
 *  - Le joueur possede l'un des slugs ci-dessus.
 *  - L'action est une Quick Pass (ou un Hand-Off pour la variante S3).
 *  - La passe ne provoque pas de turnover (interception adverse, jet de passe
 *    rate ou reception ratee : la regle ne s'applique pas car le tour de
 *    l'equipe se termine de toute facon).
 *  - Le joueur a encore au moins 1 PM (sinon il ne peut pas continuer).
 *  - Le joueur n'a pas deja utilise Running Pass durant ce tour d'equipe.
 *
 * Quand Running Pass s'active, on enregistre l'utilisation dans
 * `state.usedRunningPassThisTurn`. Le tableau est reinitialise au changement
 * de tour (`handleEndTurn` dans `actions.ts`), exactement comme pour
 * `usedBreakTackleThisTurn`. La fonction `canPlayerContinueMoving` du moteur
 * traite ce flag pour autoriser la suite du mouvement meme si l'action
 * principale du joueur reste enregistree comme `PASS` ou `HANDOFF`.
 *
 * Utilisateur principal (5 equipes prioritaires) : Imperial Thrower (Noblesse
 * Imperiale). Egalement utilisable par les Throwers Skaven (en S3 via
 * `running-pass-2025`) et plusieurs star players hirables.
 */

import type { GameState, Player } from '../core/types';
import type { PassRange } from './passing';
import { hasSkill } from '../skills/skill-effects';

const RUNNING_PASS_SLUGS = ['running-pass', 'running_pass', 'running-pass-2025'] as const;
const RUNNING_PASS_HANDOFF_SLUGS = ['running-pass-2025'] as const;

/**
 * Retourne vrai si le joueur possede une variante du skill Running Pass.
 */
export function hasRunningPass(player: Player): boolean {
  return RUNNING_PASS_SLUGS.some(slug => hasSkill(player, slug));
}

/**
 * Retourne vrai si le joueur possede la variante S3 qui couvre aussi
 * l'Action de Transmission (Hand-Off).
 */
export function hasRunningPassHandoffVariant(player: Player): boolean {
  return RUNNING_PASS_HANDOFF_SLUGS.some(slug => hasSkill(player, slug));
}

/**
 * Retourne vrai si Running Pass a deja ete utilise par ce joueur durant le
 * tour d'equipe en cours.
 */
export function hasUsedRunningPassThisTurn(state: GameState, playerId: string): boolean {
  return (state.usedRunningPassThisTurn ?? []).includes(playerId);
}

/**
 * Retourne vrai si Running Pass peut s'activer pour cette Action de Passe.
 *
 * @param state - etat courant du jeu (apres resolution de la passe)
 * @param player - le passeur
 * @param range - portee de la passe declaree
 * @param hadTurnover - true si la passe a provoque un turnover
 */
export function canApplyRunningPass(
  state: GameState,
  player: Player,
  range: PassRange | null,
  hadTurnover: boolean,
): boolean {
  if (!hasRunningPass(player)) return false;
  if (range !== 'quick') return false;
  if (hadTurnover) return false;
  if (player.pm <= 0) return false;
  if (hasUsedRunningPassThisTurn(state, player.id)) return false;
  return true;
}

/**
 * Retourne vrai si Running Pass peut s'activer pour une Action de Transmission
 * (Hand-Off). Reserve a la variante S3 du skill.
 */
export function canApplyRunningPassToHandoff(
  state: GameState,
  player: Player,
  hadTurnover: boolean,
): boolean {
  if (!hasRunningPassHandoffVariant(player)) return false;
  if (hadTurnover) return false;
  if (player.pm <= 0) return false;
  if (hasUsedRunningPassThisTurn(state, player.id)) return false;
  return true;
}

/**
 * Marque le joueur comme ayant utilise Running Pass durant ce tour d'equipe.
 * Retourne un nouvel etat ; ne mute jamais l'entree. Idempotent.
 */
export function markRunningPassUsed(state: GameState, playerId: string): GameState {
  const current = state.usedRunningPassThisTurn ?? [];
  if (current.includes(playerId)) {
    return state.usedRunningPassThisTurn
      ? state
      : { ...state, usedRunningPassThisTurn: current };
  }
  return {
    ...state,
    usedRunningPassThisTurn: [...current, playerId],
  };
}
