/**
 * Pro League bet settlement — sprint Pro League lot 1.D.5.
 *
 * Hook post-match qui évalue les `ProBetMarket` d'un match terminé,
 * met à jour `ProBet.status` (won/lost/void), crédite les wallets
 * gagnants (WIN tx) et crée la row d'audit `ProBetSettlement`.
 *
 * Idempotent : un market `settled` est skip ; un market avec une row
 * `ProBetSettlement` existante est aussi skip (sécurité 2 niveaux).
 *
 * Pour chaque market :
 *  1. Détermine la `winningSelection` à partir de `ProLeagueMatch`
 *     (outcome / counters TD / casualtyCount / nuffleCount selon
 *     le type).
 *  2. Pour chaque `ProBet pending` :
 *     - Si `selection === winningSelection` : status `won`,
 *       payoutAmount = `round(stake * oddsAtPlace)`, crédit wallet.
 *     - Sinon : status `lost`, payoutAmount = 0, pas de crédit.
 *  3. Crée `ProBetSettlement` avec totalStake/totalPayout/betCount.
 *  4. Marque market `status = 'settled'`.
 *
 * Wire-up : exposé pour appel manuel (admin) et via cron sweep
 * `sweepUnsettledMarkets()` (lot 1.D.5 boot integration).
 */

import { prisma } from "../prisma";

import { credit } from "./pro-wallet";

const TYPES_WITH_OVER_UNDER = new Set(["OVER_UNDER_TD", "CAS_COUNT"]);

export class SettlementError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "SettlementError";
  }
}

export interface MarketSettlementSummary {
  readonly marketId: string;
  readonly winningSelection: string;
  readonly totalStake: number;
  readonly totalPayout: number;
  readonly betCount: number;
  readonly wonCount: number;
  readonly lostCount: number;
  readonly voidCount: number;
}

export interface SettlementResult {
  readonly matchId: string;
  readonly settled: number;
  readonly skipped: number;
  readonly summaries: readonly MarketSettlementSummary[];
}

interface MatchSnapshot {
  readonly id: string;
  readonly status: string;
  readonly outcome: string | null;
  readonly touchdownCount: number | null;
  readonly casualtyCount: number | null;
  readonly nuffleCount: number | null;
}

function parseConfig(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Détermine la sélection gagnante d'un market à partir du snapshot
 * du match. Renvoie `null` si la donnée n'est pas disponible (le
 * settlement est alors skip et le market reste `closed`).
 */
function determineWinningSelection(
  marketType: string,
  match: MatchSnapshot,
  config: Record<string, unknown>,
): string | null {
  switch (marketType) {
    case "ONE_X_TWO": {
      if (match.outcome === "home") return "home";
      if (match.outcome === "away") return "away";
      if (match.outcome === "draw") return "draw";
      return null;
    }
    case "OVER_UNDER_TD": {
      const td = match.touchdownCount;
      if (td === null) return null;
      const line = typeof config.line === "number" ? config.line : 2.5;
      return td > line ? "over" : "under";
    }
    case "CAS_COUNT": {
      const cas = match.casualtyCount;
      if (cas === null) return null;
      const line = typeof config.line === "number" ? config.line : 0.5;
      return cas > line ? "over" : "under";
    }
    case "NUFFLE_OCCURS": {
      const nuffle = match.nuffleCount;
      if (nuffle === null) return null;
      return nuffle >= 1 ? "yes" : "no";
    }
    default:
      return null;
  }
}

/**
 * Évalue + settle tous les markets non-`settled` d'un match `completed`.
 * Idempotent : skip silencieux des markets déjà settled.
 *
 * Lève `SettlementError` si :
 *  - match introuvable
 *  - match.status ≠ 'completed' (settlement pré-completion = bug)
 */
export async function settleMarketsForMatch(
  matchId: string,
): Promise<SettlementResult> {
  const match = (await prisma.proLeagueMatch.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      status: true,
      outcome: true,
      touchdownCount: true,
      casualtyCount: true,
      nuffleCount: true,
    },
  })) as MatchSnapshot | null;

  if (!match) {
    throw new SettlementError(
      "MATCH_NOT_FOUND",
      `ProLeagueMatch '${matchId}' introuvable`,
    );
  }
  if (match.status !== "completed") {
    throw new SettlementError(
      "MATCH_NOT_COMPLETED",
      `Match status='${match.status}' — settlement réservé aux matchs completed`,
    );
  }

  const markets = await prisma.proBetMarket.findMany({
    where: {
      matchId,
      status: { in: ["open", "closed"] }, // skip 'settled'
    },
    select: {
      id: true,
      type: true,
      config: true,
    },
  });

  let settled = 0;
  let skipped = 0;
  const summaries: MarketSettlementSummary[] = [];

  for (const market of markets) {
    const marketId = market.id as string;
    const marketType = market.type as string;
    const config = parseConfig(market.config);

    // Sécurité supplémentaire : si une row settlement existe déjà,
    // skip (race condition possible si 2 cron tournent en parallèle).
    const existingSettlement = await prisma.proBetSettlement.findUnique({
      where: { marketId },
      select: { id: true },
    });
    if (existingSettlement) {
      skipped += 1;
      continue;
    }

    const winningSelection = determineWinningSelection(
      marketType,
      match,
      config,
    );
    if (winningSelection === null) {
      skipped += 1;
      continue;
    }

    // Charge tous les bets pending pour ce market.
    const bets = await prisma.proBet.findMany({
      where: { marketId, status: "pending" },
      select: {
        id: true,
        userId: true,
        selection: true,
        stake: true,
        oddsAtPlace: true,
      },
    });

    let totalStake = 0;
    let totalPayout = 0;
    let wonCount = 0;
    let lostCount = 0;
    const voidCount = 0;

    for (const bet of bets) {
      const stake = bet.stake as number;
      const oddsAtPlace = bet.oddsAtPlace as number;
      const userId = bet.userId as string;
      const won = (bet.selection as string) === winningSelection;
      totalStake += stake;
      if (won) {
        const payoutAmount = Math.round(stake * oddsAtPlace);
        totalPayout += payoutAmount;
        wonCount += 1;
        await prisma.proBet.update({
          where: { id: bet.id as string },
          data: {
            status: "won",
            payoutAmount,
          },
        });
        await credit(userId, payoutAmount, "WIN", bet.id as string);
      } else {
        lostCount += 1;
        await prisma.proBet.update({
          where: { id: bet.id as string },
          data: {
            status: "lost",
            payoutAmount: 0,
          },
        });
      }
    }

    // Audit row + market settled.
    await prisma.proBetSettlement.create({
      data: {
        marketId,
        winningSelection,
        totalStake,
        totalPayout,
        betCount: bets.length,
      },
    });
    await prisma.proBetMarket.update({
      where: { id: marketId },
      data: { status: "settled" },
    });

    settled += 1;
    summaries.push({
      marketId,
      winningSelection,
      totalStake,
      totalPayout,
      betCount: bets.length,
      wonCount,
      lostCount,
      voidCount,
    });
  }

  return { matchId, settled, skipped, summaries };
}

export interface SweepResult {
  readonly matchesInspected: number;
  readonly settled: number;
  readonly failed: number;
}

const SWEEP_BATCH_LIMIT = 50;

/**
 * Cron sweep : trouve les matchs `completed` qui ont des markets
 * `open`/`closed` (= jamais settled), et les settle un par un.
 * Erreur par match isolée.
 */
export async function sweepUnsettledMarkets(): Promise<SweepResult> {
  // Un match a des markets non-settled <=> il existe au moins une
  // row ProBetMarket avec status open/closed pour ce match.
  const candidates = await prisma.proLeagueMatch.findMany({
    where: {
      status: "completed",
      betMarkets: {
        some: { status: { in: ["open", "closed"] } },
      },
      // Lot 2.C.3 — sandbox matchs ne settle aucun pari (par
      // construction ils n'ont pas de markets puisque la création
      // de bet est refusée sur isTest=true ; mais on filtre quand
      // même par défense en profondeur).
      isTest: false,
    },
    select: { id: true },
    orderBy: { completedAt: "asc" },
    take: SWEEP_BATCH_LIMIT,
  });

  let settled = 0;
  let failed = 0;
  for (const { id } of candidates) {
    try {
      const out = await settleMarketsForMatch(id as string);
      if (out.settled > 0) settled += 1;
    } catch {
      failed += 1;
    }
  }
  return {
    matchesInspected: candidates.length,
    settled,
    failed,
  };
}
