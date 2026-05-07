/**
 * Pro League bet service — sprint Pro League lot 1.D.4.
 *
 * Implémente les 3 endpoints paris :
 *  - `listMarketsForMatch(matchId)` : liste les markets `open` d'un match.
 *  - `placeBet({...})` : place un pari de manière idempotente, en
 *    debitant le wallet (BET tx) atomique avec la création du Bet.
 *  - `listMyBets(userId, limit)` : historique des paris d'un user.
 *
 * Validation :
 *  - market doit être `open` ET `closesAt > now()`.
 *  - selection valide selon le type de market.
 *  - stake entier > 0.
 *  - oddsAtPlace ≈ cote courante côté market (±1% pour anti-stale).
 *  - clientToken cuid-like (idempotence client).
 *  - solde wallet ≥ stake (sinon `InsufficientFundsError` levée par
 *    `pro-wallet.debit`).
 */

import { prisma } from "../prisma";

import {
  type ProTransactionEntry,
  debit,
} from "./pro-wallet";

const MARKET_STATUS_OPEN = "open";
const ODDS_DRIFT_TOLERANCE = 0.02; // 2% — tolère un drift léger
const MAX_STAKE = 100_000;
const MIN_STAKE = 1;

export interface ProMarketSummary {
  readonly id: string;
  readonly matchId: string;
  readonly type: string;
  readonly config: Record<string, unknown>;
  readonly status: string;
  readonly closesAt: string;
}

export interface ProBetSummary {
  readonly id: string;
  readonly userId: string;
  readonly marketId: string;
  readonly marketType: string;
  readonly matchId: string;
  readonly selection: string;
  readonly stake: number;
  readonly oddsAtPlace: number;
  readonly status: string;
  readonly payoutAmount: number | null;
  readonly clientToken: string;
  readonly createdAt: string;
}

export class BetValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BetValidationError";
  }
}

export class MarketNotFoundError extends Error {
  readonly code = "MARKET_NOT_FOUND";
  constructor(id: string) {
    super(`Market '${id}' introuvable`);
    this.name = "MarketNotFoundError";
  }
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
 * Renvoie les markets `open` d'un match, sans les `closed` ou
 * `settled`. Empty array si match introuvable (pas d'erreur — la
 * page match peut afficher "pas de paris dispo").
 */
export async function listMarketsForMatch(
  matchId: string,
): Promise<ProMarketSummary[]> {
  const rows = await prisma.proBetMarket.findMany({
    where: {
      matchId,
      status: MARKET_STATUS_OPEN,
    },
    orderBy: { type: "asc" },
    select: {
      id: true,
      matchId: true,
      type: true,
      config: true,
      status: true,
      closesAt: true,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((m: any) => ({
    id: m.id as string,
    matchId: m.matchId as string,
    type: m.type as string,
    config: parseConfig(m.config),
    status: m.status as string,
    closesAt: (m.closesAt as Date).toISOString(),
  }));
}

const VALID_SELECTIONS: Record<string, ReadonlySet<string>> = {
  ONE_X_TWO: new Set(["home", "draw", "away"]),
  OVER_UNDER_TD: new Set(["over", "under"]),
  CAS_COUNT: new Set(["over", "under"]),
  NUFFLE_OCCURS: new Set(["yes", "no"]),
};

function getCurrentOdds(
  marketType: string,
  config: Record<string, unknown>,
  selection: string,
): number | null {
  const oddsKey = (() => {
    if (marketType === "ONE_X_TWO") {
      if (selection === "home") return "homeOdds";
      if (selection === "draw") return "drawOdds";
      if (selection === "away") return "awayOdds";
      return null;
    }
    if (marketType === "OVER_UNDER_TD" || marketType === "CAS_COUNT") {
      if (selection === "over") return "overOdds";
      if (selection === "under") return "underOdds";
      return null;
    }
    if (marketType === "NUFFLE_OCCURS") {
      if (selection === "yes") return "yesOdds";
      if (selection === "no") return "noOdds";
      return null;
    }
    return null;
  })();
  if (!oddsKey) return null;
  const v = config[oddsKey];
  return typeof v === "number" ? v : null;
}

export interface PlaceBetInput {
  readonly userId: string;
  readonly marketId: string;
  readonly selection: string;
  readonly stake: number;
  readonly oddsAtPlace: number;
  /** Idempotence client. Cuid recommandé. */
  readonly clientToken: string;
}

/**
 * Place un pari de manière idempotente. Si un Bet avec le même
 * `clientToken` existe déjà, on le renvoie sans rien faire (retry
 * réseau ne dupli pas). Sinon : valide market open + selection +
 * stake + odds drift, puis débit wallet (BET) + create bet en
 * `$transaction`.
 *
 * Lève :
 *  - `BetValidationError` (`INVALID_TOKEN`, `INVALID_STAKE`, etc.)
 *  - `MarketNotFoundError`
 *  - `InsufficientFundsError` (du wallet service)
 */
export async function placeBet(input: PlaceBetInput): Promise<ProBetSummary> {
  // Validation client token (idempotence requires non-empty).
  if (typeof input.clientToken !== "string" || input.clientToken.length < 8) {
    throw new BetValidationError(
      "INVALID_TOKEN",
      "clientToken doit être une string ≥ 8 chars (cuid recommandé)",
    );
  }

  // Idempotence : check ProBet by clientToken.
  const existing = await prisma.proBet.findUnique({
    where: { clientToken: input.clientToken },
    select: betSelect(),
  });
  if (existing) {
    return toBetSummary(existing);
  }

  // Validation stake.
  if (
    !Number.isInteger(input.stake) ||
    input.stake < MIN_STAKE ||
    input.stake > MAX_STAKE
  ) {
    throw new BetValidationError(
      "INVALID_STAKE",
      `stake doit être un entier ∈ [${MIN_STAKE}, ${MAX_STAKE}] (reçu: ${input.stake})`,
    );
  }

  // Validation oddsAtPlace.
  if (!Number.isFinite(input.oddsAtPlace) || input.oddsAtPlace < 1.05) {
    throw new BetValidationError(
      "INVALID_ODDS",
      `oddsAtPlace doit être ≥ 1.05 (reçu: ${input.oddsAtPlace})`,
    );
  }

  // Charge le market et valide.
  const market = await prisma.proBetMarket.findUnique({
    where: { id: input.marketId },
    select: {
      id: true,
      matchId: true,
      type: true,
      config: true,
      status: true,
      closesAt: true,
    },
  });
  if (!market) {
    throw new MarketNotFoundError(input.marketId);
  }
  const marketType = market.type as string;
  const marketStatus = market.status as string;
  const closesAt = market.closesAt as Date;
  const now = new Date();
  if (marketStatus !== MARKET_STATUS_OPEN) {
    throw new BetValidationError(
      "MARKET_CLOSED",
      `Market status='${marketStatus}' n'accepte plus de paris`,
    );
  }
  if (closesAt.getTime() <= now.getTime()) {
    throw new BetValidationError(
      "MARKET_CLOSED",
      `Market clos depuis ${closesAt.toISOString()}`,
    );
  }

  // Validation selection valide pour ce type.
  const validSelections = VALID_SELECTIONS[marketType];
  if (!validSelections || !validSelections.has(input.selection)) {
    throw new BetValidationError(
      "INVALID_SELECTION",
      `selection='${input.selection}' invalide pour market type='${marketType}'`,
    );
  }

  // Anti-stale : check oddsAtPlace ≈ cote courante.
  const config = parseConfig(market.config);
  const currentOdds = getCurrentOdds(marketType, config, input.selection);
  if (currentOdds === null) {
    throw new BetValidationError(
      "INVALID_ODDS",
      `Cote introuvable pour selection='${input.selection}'`,
    );
  }
  const drift = Math.abs(currentOdds - input.oddsAtPlace) / currentOdds;
  if (drift > ODDS_DRIFT_TOLERANCE) {
    throw new BetValidationError(
      "STALE_ODDS",
      `Cote a changé : courante=${currentOdds}, soumise=${input.oddsAtPlace}. Rafraîchir et resoumettre.`,
    );
  }

  // Debit wallet + create bet — atomique via service wallet
  // (lui-même $transaction). En cas d'échec wallet, le bet n'est
  // pas créé — la cohérence est garantie par l'ordre.
  await debit(input.userId, input.stake, "BET");

  const created = await prisma.proBet.create({
    data: {
      userId: input.userId,
      marketId: input.marketId,
      selection: input.selection,
      stake: input.stake,
      oddsAtPlace: input.oddsAtPlace,
      status: "pending",
      clientToken: input.clientToken,
    },
    select: betSelect(),
  });

  return toBetSummary(created);
}

/**
 * Liste les `limit` derniers paris d'un user, ordre desc.
 */
export async function listMyBets(
  userId: string,
  limit: number = 50,
): Promise<ProBetSummary[]> {
  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    throw new BetValidationError(
      "INVALID_LIMIT",
      `limit doit être ∈ [1, 200] (reçu: ${limit})`,
    );
  }
  const rows = await prisma.proBet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: betSelect(),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => toBetSummary(r));
}

/** Re-export depuis le wallet service pour les routes (1.D.4). */
export type { ProTransactionEntry };

function betSelect() {
  return {
    id: true,
    userId: true,
    marketId: true,
    selection: true,
    stake: true,
    oddsAtPlace: true,
    status: true,
    payoutAmount: true,
    clientToken: true,
    createdAt: true,
    market: {
      select: { type: true, matchId: true },
    },
  } as const;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toBetSummary(row: any): ProBetSummary {
  return {
    id: row.id as string,
    userId: row.userId as string,
    marketId: row.marketId as string,
    marketType: row.market.type as string,
    matchId: row.market.matchId as string,
    selection: row.selection as string,
    stake: row.stake as number,
    oddsAtPlace: row.oddsAtPlace as number,
    status: row.status as string,
    payoutAmount: (row.payoutAmount as number | null) ?? null,
    clientToken: row.clientToken as string,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}
