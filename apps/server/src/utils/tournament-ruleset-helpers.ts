/**
 * Résolution des règlements de tournoi (« rules packs », ex : NAF World
 * Cup 2027) côté serveur. Miroir de `ruleset-helpers.ts` pour le 3e axe
 * de création d'équipe : le registre vit dans `@bb/game-engine`
 * (`TOURNAMENT_RULESETS`), la valeur persistée est le slug (nullable).
 */

import {
  getTournamentRuleset,
  isTournamentRulesetSlug,
  type TournamentRulesetDefinition,
} from '@bb/game-engine';

export type ParsedTournamentRuleset =
  | { readonly ok: true; readonly def: TournamentRulesetDefinition | null }
  | { readonly ok: false; readonly error: string };

/**
 * Parse un slug de règlement de tournoi venant du body (déjà borné par Zod).
 * `null` / `undefined` / chaîne vide = aucun règlement (cas nominal). Un slug
 * non présent dans le registre est une erreur explicite (pas de fallback
 * silencieux : le règlement conditionne budget et restrictions).
 */
export function parseTournamentRuleset(value: unknown): ParsedTournamentRuleset {
  if (value === undefined || value === null || value === '') {
    return { ok: true, def: null };
  }
  if (typeof value !== 'string' || !isTournamentRulesetSlug(value)) {
    return { ok: false, error: 'Règlement de tournoi inconnu' };
  }
  return { ok: true, def: getTournamentRuleset(value) };
}
