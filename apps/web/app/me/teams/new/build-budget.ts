/**
 * Budget d'or et pool de PSP imposés au builder d'équipe.
 *
 * Trois sources peuvent imposer ces deux valeurs, et elles se superposent :
 *
 *  1. le **règlement de tournoi** (pack) choisi par le coach ou imposé par la
 *     compétition — il fixe `goldBudget` / `sppBudget` par tier de roster ;
 *  2. la **coupe** (Flow B, `?cupId=`) — budgets et pools par tier/roster ;
 *  3. rien du tout — le coach garde la main (jeu libre).
 *
 * L'ordre est celui du SERVEUR (`routes/team-build-handler.ts`) : quand une
 * coupe impose un règlement, le bloc `if (pack)` s'exécute APRÈS la
 * résolution des budgets de coupe et les écrase. **Le pack prime donc sur la
 * coupe.** Le builder appliquait l'inverse : ses deux effets « pack » étaient
 * gardés par `if (… || cupId) return`, si bien qu'une équipe construite
 * DEPUIS une coupe à règlement retombait sur le budget par défaut du roster
 * et sur un pool de **0 PSP** — donc aucune compétence achetable, alors que
 * la même équipe construite hors compétition en proposait.
 *
 * Ce module concentre la règle pour qu'elle ne puisse plus diverger entre le
 * client et le serveur : 100 % pur, testable sans React ni Prisma.
 */

import type { TournamentRosterRules } from "@bb/game-engine";

/** Config de composition d'une coupe, telle que servie par `GET /cup/:id`. */
export interface CupBuildRules {
  readonly tierBudgets: Record<string, number>;
  readonly rosterBudgetOverrides: Record<string, number>;
  readonly tierStartingPsp: Record<string, number>;
  readonly rosterStartingPspOverrides: Record<string, number>;
}

/** Ce que le builder connaît du roster sélectionné (via `/api/builder-rosters`). */
export interface RosterForBudget {
  readonly slug: string;
  /** "I" | "II" | "III" | "IV". `null` tant que la liste n'est pas chargée. */
  readonly tier?: string | null;
  /** Budget par défaut du roster (kpo). `null` idem. */
  readonly budget?: number | null;
}

/** Valeurs imposées. `null` = aucune contrainte, le coach garde la main. */
export interface ImposedBuildBudget {
  /** Budget d'or de construction, en kpo. */
  readonly teamValue: number;
  /** Pool de PSP dépensable en compétences à la création. */
  readonly startingPspPool: number;
}

export interface ResolveBuildBudgetInput {
  /** Règles du pack pour le roster courant (`null` = pas de règlement). */
  readonly packRules: TournamentRosterRules | null;
  /** Taxe SPP due pour les Star Players sélectionnés (0 hors pack). */
  readonly packStarTax?: number;
  /** Config de la coupe (`null` = build hors coupe / config non chargée). */
  readonly cupRules: CupBuildRules | null;
  /** Roster sélectionné (`null` tant que la liste n'est pas chargée). */
  readonly roster: RosterForBudget | null;
}

/**
 * Budget + pool imposés, ou `null` quand rien ne s'impose (jeu libre, ou
 * données pas encore chargées).
 *
 * Précédence — **identique au serveur** :
 *   règlement de tournoi > règles de coupe > (rien).
 *
 * Le pool du pack est servi NET de la taxe Star Players, comme le fait le
 * serveur juste après avoir facturé les Stars.
 */
export function resolveBuildBudget(
  input: ResolveBuildBudgetInput,
): ImposedBuildBudget | null {
  const { packRules, cupRules, roster } = input;

  // 1. Règlement de tournoi : prime sur tout le reste (miroir serveur).
  if (packRules) {
    const tax = Math.max(0, input.packStarTax ?? 0);
    return {
      teamValue: packRules.goldBudget,
      startingPspPool: Math.max(0, packRules.sppBudget - tax),
    };
  }

  // 2. Coupe sans règlement : budget/pool par override de roster, puis par
  //    tier, puis budget natif du roster et pool nul.
  if (cupRules && roster && roster.tier != null && roster.budget != null) {
    return {
      teamValue:
        cupRules.rosterBudgetOverrides[roster.slug] ??
        cupRules.tierBudgets[roster.tier] ??
        roster.budget,
      startingPspPool:
        cupRules.rosterStartingPspOverrides[roster.slug] ??
        cupRules.tierStartingPsp[roster.tier] ??
        0,
    };
  }

  // 3. Rien d'imposé.
  return null;
}
