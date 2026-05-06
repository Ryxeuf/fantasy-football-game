/**
 * Pro League wallet — sprint Pro League lot 1.D.1.
 *
 * Service qui gère le porte-monnaie Crowns d'un user et le ledger
 * immuable `ProTransaction`. Toutes les opérations debit/credit sont
 * atomiques : `ProWallet.crowns` (cache) et l'entrée `ProTransaction`
 * (audit) sont écrits dans la même transaction Prisma.
 *
 * Sources / sorties de Crowns au MVP (lot 1.D.6) :
 *  - `REWARD` : first-time bonus inscription (1000 Crowns).
 *  - `DAILY` : login quotidien (50 Crowns / 24h).
 *  - `BET` : pose d'un pari (debit, montant négatif).
 *  - `WIN` : gain net post-settlement (credit).
 *  - `BADGE` : prime variable badge débloqué.
 *
 * Contrats :
 *  - `getOrCreateWallet(userId)` : idempotent, renvoie le wallet
 *    (création si absent).
 *  - `debit(userId, amount, type, ref?)` :
 *    * `amount` strictly > 0 ; throw `InvalidAmountError` sinon.
 *    * Le wallet est créé si nécessaire.
 *    * Si le solde courant < `amount` → throw `InsufficientFundsError`.
 *    * Sinon : décrément atomique + écriture ProTransaction
 *      `{type, amount: -amount, ref?}` et renvoie le nouveau solde.
 *  - `credit(userId, amount, type, ref?)` :
 *    * `amount` strictly > 0 ; throw `InvalidAmountError` sinon.
 *    * Création wallet si absent ; incrément + écriture
 *      ProTransaction `{type, amount: +amount, ref?}`.
 *  - `getBalance(userId)` : 0 si pas de wallet (pas d'erreur).
 *  - `getRecentTransactions(userId, limit)` : ledger paginé desc.
 */

import { prisma } from "../prisma";

/** Types valides pour `ProTransaction.type`. */
export type ProTxType = "BET" | "WIN" | "REWARD" | "DAILY" | "BADGE";

const VALID_TX_TYPES: ReadonlySet<ProTxType> = new Set([
  "BET",
  "WIN",
  "REWARD",
  "DAILY",
  "BADGE",
]);

export interface ProWalletSnapshot {
  readonly userId: string;
  readonly crowns: number;
}

export interface ProTransactionEntry {
  readonly id: string;
  readonly type: ProTxType;
  readonly amount: number;
  readonly ref: string | null;
  readonly createdAt: string;
}

export class InvalidAmountError extends Error {
  readonly code = "WALLET_INVALID_AMOUNT";
  constructor(message: string) {
    super(message);
    this.name = "InvalidAmountError";
  }
}

export class InvalidTxTypeError extends Error {
  readonly code = "WALLET_INVALID_TX_TYPE";
  constructor(public readonly raw: string) {
    super(`ProTransaction.type invalide : '${raw}'`);
    this.name = "InvalidTxTypeError";
  }
}

export class InsufficientFundsError extends Error {
  readonly code = "WALLET_INSUFFICIENT_FUNDS";
  constructor(
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Solde insuffisant : disponible ${available}, demandé ${requested}.`,
    );
    this.name = "InsufficientFundsError";
  }
}

function ensureValidAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new InvalidAmountError(
      `Le montant doit être un entier > 0 (reçu: ${amount}).`,
    );
  }
}

function ensureValidType(type: ProTxType): void {
  if (!VALID_TX_TYPES.has(type)) {
    throw new InvalidTxTypeError(type as string);
  }
}

/**
 * Crée le wallet de l'user s'il n'existe pas, sinon le renvoie tel
 * quel. Idempotent : 2 appels successifs ne dupliquent pas le wallet.
 */
export async function getOrCreateWallet(
  userId: string,
): Promise<ProWalletSnapshot> {
  const wallet = await prisma.proWallet.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { userId: true, crowns: true },
  });
  return {
    userId: wallet.userId as string,
    crowns: (wallet.crowns as number) ?? 0,
  };
}

/**
 * Renvoie le solde courant. Pas d'erreur si le wallet n'existe pas
 * encore (un user qui n'a jamais reçu/dépensé de Crowns a un solde 0).
 */
export async function getBalance(userId: string): Promise<number> {
  const w = await prisma.proWallet.findUnique({
    where: { userId },
    select: { crowns: true },
  });
  return ((w?.crowns as number | undefined) ?? 0) as number;
}

/**
 * Débite le wallet de `amount` Crowns. Atomique : décrément + écriture
 * ProTransaction `{type, amount: -amount}` dans la même $transaction.
 *
 * Lève `InsufficientFundsError` si solde < amount au moment de l'appel.
 *
 * Renvoie le nouveau solde après débit.
 */
export async function debit(
  userId: string,
  amount: number,
  type: ProTxType,
  ref?: string,
): Promise<number> {
  ensureValidAmount(amount);
  ensureValidType(type);
  // Garantit l'existence du wallet (création silencieuse si absent).
  await getOrCreateWallet(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await prisma.$transaction(async (tx: any) => {
    const w = await tx.proWallet.findUnique({
      where: { userId },
      select: { crowns: true },
    });
    const current = (w?.crowns as number | undefined) ?? 0;
    if (current < amount) {
      throw new InsufficientFundsError(current, amount);
    }
    const updated = await tx.proWallet.update({
      where: { userId },
      data: { crowns: current - amount },
      select: { crowns: true },
    });
    await tx.proTransaction.create({
      data: {
        walletId: userId,
        type,
        amount: -amount,
        ref: ref ?? null,
      },
    });
    return updated.crowns as number;
  })) as number;

  return result;
}

/**
 * Crédite le wallet de `amount` Crowns. Atomique : incrément +
 * écriture ProTransaction `{type, amount: +amount}` dans la même
 * $transaction.
 *
 * Renvoie le nouveau solde.
 */
export async function credit(
  userId: string,
  amount: number,
  type: ProTxType,
  ref?: string,
): Promise<number> {
  ensureValidAmount(amount);
  ensureValidType(type);
  await getOrCreateWallet(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await prisma.$transaction(async (tx: any) => {
    const w = await tx.proWallet.findUnique({
      where: { userId },
      select: { crowns: true },
    });
    const current = (w?.crowns as number | undefined) ?? 0;
    const updated = await tx.proWallet.update({
      where: { userId },
      data: { crowns: current + amount },
      select: { crowns: true },
    });
    await tx.proTransaction.create({
      data: {
        walletId: userId,
        type,
        amount: amount,
        ref: ref ?? null,
      },
    });
    return updated.crowns as number;
  })) as number;

  return result;
}

/**
 * Liste les `limit` dernières transactions de l'user, ordre desc
 * (plus récentes d'abord). Renvoie [] si le wallet n'existe pas.
 */
export async function getRecentTransactions(
  userId: string,
  limit: number = 20,
): Promise<ProTransactionEntry[]> {
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new InvalidAmountError(
      `limit doit être un entier > 0 (reçu: ${limit}).`,
    );
  }
  const rows = await prisma.proTransaction.findMany({
    where: { walletId: userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      amount: true,
      ref: true,
      createdAt: true,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rows.map((r: any) => ({
    id: r.id as string,
    type: r.type as ProTxType,
    amount: r.amount as number,
    ref: (r.ref as string | null) ?? null,
    createdAt: (r.createdAt as Date).toISOString(),
  }));
}
