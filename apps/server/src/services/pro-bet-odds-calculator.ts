/**
 * Pro League odds calculator — sprint Pro League lot 1.D.3.
 *
 * Pré-simule N matchs (default 200) entre les 2 équipes d'un
 * `ProLeagueMatch` via le sim-engine, agrège les outcomes par type de
 * market, applique la marge maison (5%) et retourne les configs
 * sérialisables vers `ProBetMarket.config`.
 *
 * Usage typique :
 *   1. Appelé par `createMarketsForMatch(matchId)` au pre-match (lot
 *      1.D.4) : calcule les 5 markets standards (1X2, OU TD, OU CAS,
 *      NUFFLE_OCCURS, MVP) et upsert les rows ProBetMarket.
 *   2. Re-callable si line-up change (admin / lot 1.E pour casualties
 *      persistantes) — l'upsert garantit que les odds sont rafraîchies
 *      sans dupliquer le market.
 *
 * Performance : 200 sim → ~1-2s sur le pairing moyen. Acceptable pour
 * une route admin / cron T-24h. Pour des odds re-calculés en live,
 * cache + déduplication seront nécessaires (lot 1.D.x optimisation).
 *
 * Cotes décimales (convention bookmaker européen) : `payout = stake *
 * odds`. La cote est figée au moment de la pose (`oddsAtPlace` sur
 * `ProBet`) pour fairness — un changement post-pose n'impacte pas le
 * gain d'un pari déjà placé.
 */

import {
  PRO_LEAGUE_TEAM_BY_ID,
  simulateMatch,
  type SimInput,
  type SimResult,
} from "@bb/sim-engine";

import { prisma } from "../prisma";

import {
  DEFAULT_HOUSE_MARGIN,
  computeNuffleOccursProbabilities,
  computeOneXTwoProbabilities,
  computeOverUnderProbabilities,
  probabilityToDecimalOdds,
} from "./pro-bet-odds-math";

/** Types de markets supportés. */
export type ProMarketType =
  | "ONE_X_TWO"
  | "OVER_UNDER_TD"
  | "CAS_COUNT"
  | "NUFFLE_OCCURS";

/** Lines par défaut pour les markets over/under (convention .5 pour
 *  éviter les égalités). Les lines sont choisis pour donner des
 *  probabilités proches de 50/50 sur le sample FUMBBL de référence. */
export const DEFAULT_TD_LINE = 2.5;
export const DEFAULT_CAS_LINE = 0.5;

/** Nombre de simulations par défaut pour estimer les probas. */
export const DEFAULT_RUNS = 200;

interface OneXTwoConfig {
  readonly homeOdds: number;
  readonly drawOdds: number;
  readonly awayOdds: number;
}

interface OverUnderConfig {
  readonly line: number;
  readonly overOdds: number;
  readonly underOdds: number;
}

interface NuffleOccursConfig {
  readonly yesOdds: number;
  readonly noOdds: number;
}

export type ProMarketConfig =
  | { type: "ONE_X_TWO"; config: OneXTwoConfig }
  | { type: "OVER_UNDER_TD"; config: OverUnderConfig }
  | { type: "CAS_COUNT"; config: OverUnderConfig }
  | { type: "NUFFLE_OCCURS"; config: NuffleOccursConfig };

export class ProMatchNotReadyForOddsError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ProMatchNotReadyForOddsError";
  }
}

/** Hash FNV1a 32-bit pour seeds déterministes (cohérent avec sim-runner). */
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Pré-simule N matchs entre les 2 équipes d'un `ProLeagueMatch` et
 * agrège les compteurs nécessaires aux différents markets.
 *
 * Renvoie l'agrégat brut — l'application de la marge maison + la
 * conversion en cotes se fait dans `computeMarketsForMatch`.
 */
async function gatherSamples(
  matchId: string,
  runs: number,
): Promise<{
  oneXTwoCounts: { home: number; draws: number; away: number };
  tdCounts: number[];
  casCounts: number[];
  nuffleCounts: number[];
}> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: {
      homeTeam: { select: { slug: true, name: true } },
      awayTeam: { select: { slug: true, name: true } },
    },
  });
  if (!match) {
    throw new ProMatchNotReadyForOddsError(
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  const homeProfile = PRO_LEAGUE_TEAM_BY_ID[match.homeTeam.slug as string];
  const awayProfile = PRO_LEAGUE_TEAM_BY_ID[match.awayTeam.slug as string];
  if (!homeProfile || !awayProfile) {
    throw new ProMatchNotReadyForOddsError(
      `Slugs ProTeam introuvables : home='${match.homeTeam.slug}' away='${match.awayTeam.slug}'`,
    );
  }

  const baseSeed = hashSeed(`odds:${matchId}`);
  const oneXTwoCounts = { home: 0, draws: 0, away: 0 };
  const tdCounts: number[] = [];
  const casCounts: number[] = [];
  const nuffleCounts: number[] = [];

  for (let i = 0; i < runs; i += 1) {
    const seed = (baseSeed + i) >>> 0;
    const sim: SimInput = {
      seed,
      home: {
        id: homeProfile.id,
        name: homeProfile.name,
        side: "home",
        tactics: homeProfile.tactics,
        tv: homeProfile.tv,
      },
      away: {
        id: awayProfile.id,
        name: awayProfile.name,
        side: "away",
        tactics: awayProfile.tactics,
        tv: awayProfile.tv,
      },
    };
    const result: SimResult = simulateMatch(sim);
    if (result.summary.outcome === "home") oneXTwoCounts.home += 1;
    else if (result.summary.outcome === "away") oneXTwoCounts.away += 1;
    else oneXTwoCounts.draws += 1;
    tdCounts.push(result.summary.touchdownCount);
    casCounts.push(result.casualties.length);
    nuffleCounts.push(result.summary.nuffleCount);
  }

  return { oneXTwoCounts, tdCounts, casCounts, nuffleCounts };
}

interface ComputeMarketsOptions {
  readonly runs?: number;
  readonly houseMargin?: number;
  readonly tdLine?: number;
  readonly casLine?: number;
}

/**
 * Renvoie la liste des markets `{type, config}` calculés pour un match,
 * sans les persister. Useful for testing + admin previews.
 */
export async function computeMarketsForMatch(
  matchId: string,
  options: ComputeMarketsOptions = {},
): Promise<ProMarketConfig[]> {
  const runs = options.runs ?? DEFAULT_RUNS;
  const houseMargin = options.houseMargin ?? DEFAULT_HOUSE_MARGIN;
  const tdLine = options.tdLine ?? DEFAULT_TD_LINE;
  const casLine = options.casLine ?? DEFAULT_CAS_LINE;

  if (!Number.isInteger(runs) || runs <= 0) {
    throw new Error(`computeMarketsForMatch: runs must be > 0 (got ${runs})`);
  }

  const samples = await gatherSamples(matchId, runs);

  const oneXTwoP = computeOneXTwoProbabilities(samples.oneXTwoCounts);
  const tdP = computeOverUnderProbabilities(samples.tdCounts, tdLine);
  const casP = computeOverUnderProbabilities(samples.casCounts, casLine);
  const nuffleP = computeNuffleOccursProbabilities(samples.nuffleCounts);

  return [
    {
      type: "ONE_X_TWO",
      config: {
        homeOdds: probabilityToDecimalOdds(oneXTwoP.home, houseMargin),
        drawOdds: probabilityToDecimalOdds(oneXTwoP.draw, houseMargin),
        awayOdds: probabilityToDecimalOdds(oneXTwoP.away, houseMargin),
      },
    },
    {
      type: "OVER_UNDER_TD",
      config: {
        line: tdLine,
        overOdds: probabilityToDecimalOdds(tdP.over, houseMargin),
        underOdds: probabilityToDecimalOdds(tdP.under, houseMargin),
      },
    },
    {
      type: "CAS_COUNT",
      config: {
        line: casLine,
        overOdds: probabilityToDecimalOdds(casP.over, houseMargin),
        underOdds: probabilityToDecimalOdds(casP.under, houseMargin),
      },
    },
    {
      type: "NUFFLE_OCCURS",
      config: {
        yesOdds: probabilityToDecimalOdds(nuffleP.yes, houseMargin),
        noOdds: probabilityToDecimalOdds(nuffleP.no, houseMargin),
      },
    },
  ];
}

export interface UpsertMarketsResult {
  readonly matchId: string;
  readonly created: number;
  readonly updated: number;
  readonly markets: ProMarketConfig[];
}

/**
 * Upsert les markets calculés pour un match. Idempotent. `closesAt`
 * est calé sur `ProLeagueMatch.scheduledAt` (pas de paris après le
 * kickoff). Ne touche pas aux markets `settled` (audit).
 */
export async function createOrRefreshMarketsForMatch(
  matchId: string,
  options: ComputeMarketsOptions = {},
): Promise<UpsertMarketsResult> {
  const match = await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: { id: true, scheduledAt: true, status: true },
  });
  if (!match) {
    throw new ProMatchNotReadyForOddsError(
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  if (match.status === "completed" || match.status === "failed") {
    throw new ProMatchNotReadyForOddsError(
      `ProLeagueMatch status='${match.status}' — markets ne sont plus rafraîchissables`,
    );
  }

  const markets = await computeMarketsForMatch(matchId, options);
  const closesAt = match.scheduledAt as Date;
  let created = 0;
  let updated = 0;

  for (const m of markets) {
    const existing = await prisma.proBetMarket.findUnique({
      where: { matchId_type: { matchId, type: m.type } },
      select: { id: true, status: true },
    });
    if (existing && existing.status === "settled") {
      // Audit : on ne réécrit pas un settled.
      continue;
    }
    if (existing) {
      await prisma.proBetMarket.update({
        where: { id: existing.id as string },
        data: {
          config: m.config as unknown as object,
          closesAt,
        },
      });
      updated += 1;
    } else {
      await prisma.proBetMarket.create({
        data: {
          matchId,
          type: m.type,
          config: m.config as unknown as object,
          status: "open",
          closesAt,
        },
      });
      created += 1;
    }
  }

  return { matchId, created, updated, markets };
}
