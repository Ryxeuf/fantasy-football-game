/**
 * Groupement par poule des rencontres d'une ronde de coupe.
 *
 * La RÈGLE vit dans `lib/competition-pools`, partagée avec la ligue. Ce
 * module ne dit que deux choses PROPRES à la coupe :
 *
 *  1. la poule d'une rencontre se lit par son équipe à domicile (la ligue
 *     passe, elle, par le participant) ;
 *  2. une ronde de BRACKET ne se groupe jamais. Une finale oppose par
 *     construction les qualifiés de deux poules : la coiffer de « Poule A »
 *     parce que son équipe à domicile en vient serait faux.
 *
 * Pur : testable sans DOM.
 */

import {
  groupByPool,
  type PoolGroup,
} from "../../lib/competition-pools";

/** Ce dont le groupement a besoin d'une rencontre. */
export interface CupPairingLike {
  readonly homeTeam: { readonly id: string };
}

/** Ce dont il a besoin d'une ronde. */
export interface CupRoundLike<P extends CupPairingLike> {
  readonly kind?: string;
  readonly pairings: readonly P[];
}

/**
 * Range les rencontres d'une ronde par poule, ou rend `null` quand le
 * découpage n'apprendrait rien (ronde de bracket, aucune poule déclarée, ou
 * une seule poule représentée) — l'appelant affiche alors la liste à plat.
 */
export function groupCupRoundByPool<P extends CupPairingLike>(
  round: CupRoundLike<P>,
  poolNamesById: Readonly<Record<string, string>>,
  poolIdByTeamId: Readonly<Record<string, string | null>>,
  preferredPoolId: string | null = null,
): Array<PoolGroup<P>> | null {
  if (round.kind === "playoff") return null;
  return groupByPool(
    round.pairings,
    (p) => poolIdByTeamId[p.homeTeam.id] ?? null,
    poolNamesById,
    preferredPoolId,
  );
}

/** Inscription telle que la page de coupe la sert. */
export interface CupParticipantLike {
  readonly id: string;
  readonly poolId?: string | null;
}

/**
 * Poule du coach connecté : celle de sa PREMIÈRE équipe affectée. Un coach
 * qui aligne deux équipes dans deux poules n'en verra remonter qu'une — il
 * faut bien trancher, et remonter les deux reviendrait à ne rien remonter.
 */
export function preferredPoolIdFor(
  participants: readonly CupParticipantLike[],
  myTeamIds: readonly string[],
): string | null {
  if (myTeamIds.length === 0) return null;
  const mine = new Set(myTeamIds);
  for (const p of participants) {
    if (mine.has(p.id) && p.poolId) return p.poolId;
  }
  return null;
}

/** `{ teamId → poolId }`, tel que le groupement le consomme. */
export function poolIdByTeamId(
  participants: readonly CupParticipantLike[],
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const p of participants) out[p.id] = p.poolId ?? null;
  return out;
}

/** `{ poolId → nom }`, vide quand la coupe n'a pas de poule. */
export function poolNamesById(
  pools: readonly { readonly id: string; readonly name: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pool of pools) out[pool.id] = pool.name;
  return out;
}
