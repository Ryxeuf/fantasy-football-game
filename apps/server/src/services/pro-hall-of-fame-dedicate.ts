/**
 * Service Hall of Fame dedications — Sprint P (Lot P.B.2).
 *
 * Permet a un user de payer 500 Crowns pour epingler un message
 * custom (max 280 chars) sur une entree Hall of Fame. **Sink Crowns**
 * volontaire — sert a equilibrer l'inflation introduite par les
 * daily bonus + paris gagnes.
 *
 * Idempotent : un user ne peut dedier qu'une seule fois par entree
 * (`unique[hallOfFameId, userId]`). Re-appel renvoie la dedication
 * existante sans nouveau debit.
 *
 * Atomique : debit wallet + insert dedication dans la meme
 * `$transaction`. Si l'insert echoue (unique violation, etc.), le
 * debit est rollback.
 */

import { prisma } from "../prisma";
import { InsufficientFundsError, getOrCreateWallet } from "./pro-wallet";

export const DEDICATE_COST_CROWNS = 500;
export const DEDICATION_MAX_LENGTH = 280;

export type DedicateErrorCode =
  | "HOF_NOT_FOUND"
  | "INVALID_MESSAGE"
  | "MESSAGE_TOO_LONG";

export class DedicateError extends Error {
  constructor(
    public readonly code: DedicateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DedicateError";
  }
}

export interface DedicateOutcome {
  /** True si une nouvelle dedication a ete creee (et 500 Crowns debites). */
  readonly granted: boolean;
  readonly dedicationId: string;
  readonly message: string;
  readonly costCrowns: number;
  /** Solde apres operation. */
  readonly balance: number;
  readonly createdAt: string;
}

/**
 * Dedie une entree Hall of Fame avec un message custom. Idempotent.
 *
 * @throws {DedicateError} HOF_NOT_FOUND si l'id n'existe pas.
 * @throws {DedicateError} INVALID_MESSAGE si message vide/trim.
 * @throws {DedicateError} MESSAGE_TOO_LONG si > 280 chars.
 * @throws {InsufficientFundsError} si solde < 500.
 */
export async function dedicateHallOfFame(
  userId: string,
  hallOfFameId: string,
  rawMessage: string,
): Promise<DedicateOutcome> {
  // Validation message
  const message = (rawMessage ?? "").trim();
  if (message.length === 0) {
    throw new DedicateError(
      "INVALID_MESSAGE",
      "Le message ne peut pas etre vide",
    );
  }
  if (message.length > DEDICATION_MAX_LENGTH) {
    throw new DedicateError(
      "MESSAGE_TOO_LONG",
      `Le message ne peut depasser ${DEDICATION_MAX_LENGTH} caracteres`,
    );
  }

  // Verifie que l'entree HoF existe (pas dedier dans le vide).
  const hof = await prisma.proHallOfFame.findUnique({
    where: { id: hallOfFameId },
    select: { id: true },
  });
  if (!hof) {
    throw new DedicateError(
      "HOF_NOT_FOUND",
      `ProHallOfFame id='${hallOfFameId}' introuvable`,
    );
  }

  // Idempotence : si dedicace existe deja pour ce (user, hof), renvoie-la
  // sans nouveau debit. Pas de mise a jour du message (pour rester
  // sink-only, sinon on detournerait le pattern via update gratuit).
  const existing = await prisma.proHallOfFameDedication.findUnique({
    where: {
      hallOfFameId_userId: { hallOfFameId, userId },
    },
    select: {
      id: true,
      message: true,
      costCrowns: true,
      createdAt: true,
    },
  });
  if (existing) {
    const w = await getOrCreateWallet(userId);
    return {
      granted: false,
      dedicationId: existing.id as string,
      message: existing.message as string,
      costCrowns: existing.costCrowns as number,
      balance: w.crowns,
      createdAt: (existing.createdAt as Date).toISOString(),
    };
  }

  // Garantit le wallet (creation silencieuse si absent).
  await getOrCreateWallet(userId);

  // Atomique : check solde + decremente wallet + cree tx + insert
  // dedication dans la meme $transaction. Si l'insert dedication
  // echoue (race condition sur unique), tout rollback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (await prisma.$transaction(async (tx: any) => {
    const w = await tx.proWallet.findUnique({
      where: { userId },
      select: { crowns: true },
    });
    const current = (w?.crowns as number | undefined) ?? 0;
    if (current < DEDICATE_COST_CROWNS) {
      throw new InsufficientFundsError(current, DEDICATE_COST_CROWNS);
    }
    const updated = await tx.proWallet.update({
      where: { userId },
      data: { crowns: current - DEDICATE_COST_CROWNS },
      select: { crowns: true },
    });
    await tx.proTransaction.create({
      data: {
        walletId: userId,
        type: "SINK",
        amount: -DEDICATE_COST_CROWNS,
        ref: `hof-dedicate:${hallOfFameId}`,
      },
    });
    const created = await tx.proHallOfFameDedication.create({
      data: {
        hallOfFameId,
        userId,
        message,
        costCrowns: DEDICATE_COST_CROWNS,
      },
      select: { id: true, createdAt: true },
    });
    return {
      dedicationId: created.id as string,
      createdAt: (created.createdAt as Date).toISOString(),
      balance: updated.crowns as number,
    };
  })) as { dedicationId: string; createdAt: string; balance: number };

  return {
    granted: true,
    dedicationId: result.dedicationId,
    message,
    costCrowns: DEDICATE_COST_CROWNS,
    balance: result.balance,
    createdAt: result.createdAt,
  };
}

export interface DedicationEntry {
  readonly id: string;
  readonly userId: string;
  readonly coachName: string;
  readonly message: string;
  readonly costCrowns: number;
  readonly createdAt: string;
}

/**
 * Liste les dedications d'une entree Hall of Fame (paginees, plus
 * recentes en premier). Public, pas d'auth requis.
 */
export async function listDedications(
  hallOfFameId: string,
  limit = 50,
): Promise<readonly DedicationEntry[]> {
  const cap = Math.min(Math.max(1, Math.floor(limit)), 200);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (await prisma.proHallOfFameDedication.findMany({
    where: { hallOfFameId },
    orderBy: { createdAt: "desc" },
    take: cap,
    select: {
      id: true,
      userId: true,
      message: true,
      costCrowns: true,
      createdAt: true,
      user: { select: { coachName: true } },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any as Array<{
    id: string;
    userId: string;
    message: string;
    costCrowns: number;
    createdAt: Date;
    user: { coachName: string };
  }>;
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    coachName: r.user.coachName,
    message: r.message,
    costCrowns: r.costCrowns,
    createdAt: r.createdAt.toISOString(),
  }));
}
