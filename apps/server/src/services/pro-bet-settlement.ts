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

import { creditInTx, ensureWalletExists } from "./pro-wallet";
import {
  settlePicksForMatch,
  type PickSelection,
} from "./pro-prediction-leagues";
import { settleSurvivorRound } from "./pro-survivor";
import { settlePredictions } from "./pro-match-predictions";
import { serverLog } from "../utils/server-log";

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
  readonly roundId: string;
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
      roundId: true,
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

    // BUG fix audit round 4 (CRITICAL) : avant, le loop update bet +
    // credit user n'etait PAS atomique. Si le process crashait entre
    // l'update bet.status='won' et le credit user, le bet etait marque
    // comme `won` (status !== 'pending') donc le sweep ulterieur skipait
    // le credit (cf. filter `status: 'pending'` ligne 213) → user perdait
    // son gain.
    // Inversement : crash entre boucle complete et `proBetSettlement.create`
    // ligne 260 → bets settled mais market reste non-settled → re-run de
    // settlement skip les wons (filter pending) → market jamais settled
    // → boucle infinie au sweep.
    // Fix : tout le settlement (update bets + credit users + create
    // settlement row + update market.status) dans UNE seule $transaction.
    // Pre-ensure wallets HORS transaction pour eviter rollback partiel.
    for (const bet of bets) {
      if ((bet.selection as string) === winningSelection) {
        await ensureWalletExists(bet.userId as string);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      for (const bet of bets) {
        const stake = bet.stake as number;
        const oddsAtPlace = bet.oddsAtPlace as number;
        const userId = bet.userId as string;
        const won = (bet.selection as string) === winningSelection;
        if (won) {
          const payoutAmount = Math.round(stake * oddsAtPlace);
          totalPayout += payoutAmount;
          wonCount += 1;
          await tx.proBet.update({
            where: { id: bet.id as string },
            data: { status: "won", payoutAmount },
          });
          await creditInTx(tx, userId, payoutAmount, "WIN", bet.id as string);
        } else {
          lostCount += 1;
          await tx.proBet.update({
            where: { id: bet.id as string },
            data: { status: "lost", payoutAmount: 0 },
          });
        }
        totalStake += stake;
      }

      // Audit row + market settled — meme transaction pour garantir
      // que market.status='settled' apparait UNIQUEMENT si tous les
      // bets sont traites + tous les wins credites.
      await tx.proBetSettlement.create({
        data: {
          marketId,
          winningSelection,
          totalStake,
          totalPayout,
          betCount: bets.length,
        },
      });
      await tx.proBetMarket.update({
        where: { id: marketId },
        data: { status: "settled" },
      });
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

  // Sprint Q lot Q.D.1 — settle aussi les picks des mini-ligues
  // de prediction. Encapsule dans try/catch isole car ce settlement
  // est secondaire au bet settlement et ne doit pas faire echouer
  // l'ensemble si la table n'existe pas (rollback partiel migration).
  if (match.outcome === "home" || match.outcome === "draw" || match.outcome === "away") {
    try {
      await settlePicksForMatch({
        matchId,
        result: match.outcome as PickSelection,
      });
    } catch (e) {
      serverLog.error(
        `[pro-prediction-leagues] settle failed for match ${matchId}`,
        e,
      );
    }
  }

  // Sprint Q lot Q.D.2 — settle aussi les survivor entries du round.
  // Idempotent : skip les entries non pending ou dont le match n'a
  // pas encore d'outcome. Au fil des matchs completed du round, les
  // entries seront settled progressivement.
  try {
    await settleSurvivorRound({ roundId: match.roundId });
  } catch (e) {
    serverLog.error(
      `[pro-survivor] settle failed for round ${match.roundId}`,
      e,
    );
  }

  // Sprint Q lot Q.B.3 — settle aussi les fan predictions. Requiert
  // un context complet (scores + team meta) : on recharge le match
  // avec les relations teams. Encapsule dans try/catch isole.
  if (
    match.outcome === "home" ||
    match.outcome === "away" ||
    match.outcome === "draw"
  ) {
    try {
      const fullMatch = (await prisma.proLeagueMatch.findUnique({
        where: { id: matchId },
        select: {
          scoreHome: true,
          scoreAway: true,
          homeTeam: { select: { slug: true, name: true } },
          awayTeam: { select: { slug: true, name: true } },
        },
      })) as {
        scoreHome: number | null;
        scoreAway: number | null;
        homeTeam: { slug: string; name: string };
        awayTeam: { slug: string; name: string };
      } | null;
      if (
        fullMatch &&
        fullMatch.scoreHome !== null &&
        fullMatch.scoreAway !== null
      ) {
        await settlePredictions({
          matchId,
          ctx: {
            homeTeamSlug: fullMatch.homeTeam.slug,
            homeTeamName: fullMatch.homeTeam.name,
            awayTeamSlug: fullMatch.awayTeam.slug,
            awayTeamName: fullMatch.awayTeam.name,
            scoreHome: fullMatch.scoreHome,
            scoreAway: fullMatch.scoreAway,
            outcome: match.outcome as "home" | "away" | "draw",
          },
        });
      }
    } catch (e) {
      serverLog.error(
        `[pro-match-predictions] settle failed for match ${matchId}`,
        e,
      );
    }
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
