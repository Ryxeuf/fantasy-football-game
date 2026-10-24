/**
 * Fans Dévoués : le premier fan OFFERT est une règle de LIGUE.
 *
 * Une équipe construite hors compétition ou pour une coupe part de 0 Fan
 * Dévoué et paie chacun des siens. Une équipe de ligue reçoit son premier fan
 * gratuitement : il lui est accordé à son inscription en ligue, et repris si
 * elle quitte la ligue (retrait, suppression).
 *
 * Le compte stocké (`Team.dedicatedFans`) ne se lit donc qu'avec son marqueur
 * (`Team.leagueFreeFan`) :
 *   - `null`  : équipe antérieure à la règle, le fan offert est DÉJÀ compté ;
 *   - `false` : aucun fan offert (équipe neuve hors ligue) ;
 *   - `true`  : fan offert accordé par une inscription en ligue.
 * `undefined` (champ absent d'une réponse d'API plus ancienne) se lit comme
 * `null`, c'est-à-dire comme avant la règle.
 *
 * Module PUR, partagé par le serveur (construction, budget, octroi / reprise)
 * et le web (builder, résumé de budget, page de partage).
 */

export type LeagueFreeFanMarker = boolean | null | undefined;

/** Nature de ce qu'une inscription en ligue a accordé. */
export type LeagueFreeFanGrantKind = "fan" | "refund";

/** Fans OFFERTS compris dans le compte : 1 si historique ou accordé, 0 sinon. */
export function includedFreeDedicatedFans(marker: LeagueFreeFanMarker): 0 | 1 {
  return marker === false ? 0 : 1;
}

/** Fans PAYÉS : le compte moins le fan offert qu'il comprend (jamais < 0). */
export function paidDedicatedFans(
  fans: number,
  marker: LeagueFreeFanMarker,
): number {
  return Math.max(0, fans - includedFreeDedicatedFans(marker));
}

/**
 * Coût d'achat des Fans Dévoués (même unité que `unitCost`). Leur valeur
 * n'entre ni dans la VE ni dans la VEA.
 */
export function dedicatedFansPurchaseCost(
  fans: number,
  unitCost: number,
  marker: LeagueFreeFanMarker,
): number {
  return paidDedicatedFans(fans, marker) * unitCost;
}

/** Minimum de Fans Dévoués de l'équipe : son fan offert, s'il est compté. */
export function minDedicatedFans(marker: LeagueFreeFanMarker): 0 | 1 {
  return includedFreeDedicatedFans(marker);
}

export interface LeagueFreeFanGrantInput {
  readonly fans: number;
  readonly marker: LeagueFreeFanMarker;
  /** Plafond de Fans Dévoués de la config staff résolue. */
  readonly maxFans: number;
  /** Prix unitaire d'un Fan Dévoué (po). */
  readonly unitCost: number;
}

export type LeagueFreeFanGrantPlan =
  | { readonly kind: "none" }
  | { readonly kind: "fan" }
  | { readonly kind: "refund"; readonly amount: number };

/**
 * Ce qu'une inscription en ligue accorde à l'équipe.
 *
 * Seule une équipe sans fan offert (`false`) reçoit quelque chose. Au plafond,
 * un 7e fan n'existe pas : l'équipe reçoit le prix d'un fan en trésorerie, ce
 * qui revient à l'avoir construite selon la règle de ligue (6 fans payés 5).
 */
export function planLeagueFreeFanGrant(
  input: LeagueFreeFanGrantInput,
): LeagueFreeFanGrantPlan {
  if (input.marker !== false) return { kind: "none" };
  if (input.fans < input.maxFans) return { kind: "fan" };
  return { kind: "refund", amount: Math.max(0, input.unitCost) };
}

export interface LeagueFreeFanRevokeInput {
  /** Ce que l'inscription a accordé (`null` = rien). */
  readonly grant: LeagueFreeFanGrantKind | null;
  /** Montant crédité si `grant = "refund"` (po). */
  readonly refund: number | null;
  readonly fans: number;
  readonly treasury: number;
}

export type LeagueFreeFanRevokePlan =
  | { readonly kind: "none" }
  | { readonly kind: "fan" }
  | { readonly kind: "treasury"; readonly amount: number };

/**
 * Ce qu'on reprend à une équipe qui quitte la ligue, sans jamais rendre ses
 * fans ni sa trésorerie négatifs :
 *   - fan accordé : −1 fan s'il en reste ;
 *   - remboursement : son montant si la trésorerie le couvre, sinon −1 fan
 *     (un fan s'achète ce prix-là), sinon rien.
 */
export function planLeagueFreeFanRevoke(
  input: LeagueFreeFanRevokeInput,
): LeagueFreeFanRevokePlan {
  if (input.grant === "fan") {
    return input.fans >= 1 ? { kind: "fan" } : { kind: "none" };
  }
  if (input.grant === "refund") {
    const amount = Math.max(0, input.refund ?? 0);
    if (amount === 0) return { kind: "none" };
    if (input.treasury >= amount) return { kind: "treasury", amount };
    return input.fans >= 1 ? { kind: "fan" } : { kind: "none" };
  }
  return { kind: "none" };
}

/** Lecture tolérante de `LeagueParticipant.freeFanGrant` (colonne texte). */
export function parseLeagueFreeFanGrant(
  raw: unknown,
): LeagueFreeFanGrantKind | null {
  return raw === "fan" || raw === "refund" ? raw : null;
}
