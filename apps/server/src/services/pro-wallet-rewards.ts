/**
 * Pro Wallet rewards — sprint Pro League lot 1.D.6.
 *
 * Sources de Crowns "automatiques" :
 *  - First-time bonus (REWARD, ref="first_signup") : 1000 Crowns
 *    crédités une seule fois par user. Idempotence par check d'une
 *    ProTransaction antérieure du même type+ref.
 *  - Daily login bonus (DAILY) : 50 Crowns / 24h max. Le dernier
 *    DAILY tx est lu pour gating ; pas de reset à minuit (window
 *    glissante).
 */

import { prisma } from "../prisma";

import { credit, getOrCreateWallet } from "./pro-wallet";

export const FIRST_TIME_BONUS_AMOUNT = 1000;
export const FIRST_TIME_BONUS_REF = "first_signup";

export const DAILY_BONUS_AMOUNT = 50;
export const DAILY_BONUS_WINDOW_MS = 24 * 60 * 60 * 1000;

export class RewardError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "RewardError";
  }
}

export interface RewardOutcome {
  /** True si le crédit a été appliqué dans cet appel. False si déjà
   *  réclamé (idempotent). */
  readonly granted: boolean;
  /** Solde courant en Crowns (après éventuel crédit). */
  readonly balance: number;
  /** Montant du crédit appliqué (0 si déjà réclamé). */
  readonly amount: number;
  /** Date à partir de laquelle l'user pourra re-réclamer (DAILY only).
   *  null pour first-time. */
  readonly nextEligibleAt: string | null;
}

/**
 * Crédite le first-time bonus (1000 Crowns) si l'user ne l'a jamais
 * réclamé. Idempotent : appel répété renvoie `granted=false`.
 *
 * BUG fix audit round 5 (CRITICAL) : avant, le check `existing` etait
 * fait HORS transaction, puis `credit()` ouvrait sa propre transaction.
 * Deux appels concurrents pouvaient tous deux passer la verif (existing
 * === null pour les deux) et tous deux crediter 1000 Crowns → user
 * recoit 2000 au lieu de 1000 (inflation monetaire). Meme pattern que
 * la fix `claimDailyBonus` du round 4. Fix : tout dans une seule
 * `prisma.$transaction`.
 */
export async function grantFirstTimeBonus(
  userId: string,
): Promise<RewardOutcome> {
  // Garantit l'existence du wallet (creation silencieuse) HORS transaction
  // pour eviter une commit cassee si le wallet est neuf.
  await getOrCreateWallet(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx: any) => {
    // Idempotence : check ProTransaction REWARD + ref="first_signup"
    // DANS la transaction.
    const existing = await tx.proTransaction.findFirst({
      where: {
        walletId: userId,
        type: "REWARD",
        ref: FIRST_TIME_BONUS_REF,
      },
      select: { id: true },
    });
    if (existing) {
      const w = await tx.proWallet.findUnique({
        where: { userId },
        select: { crowns: true },
      });
      return {
        granted: false as const,
        balance: (w?.crowns as number | undefined) ?? 0,
        amount: 0,
        nextEligibleAt: null,
      };
    }
    // Credit dans la meme transaction.
    const w = await tx.proWallet.findUnique({
      where: { userId },
      select: { crowns: true },
    });
    const current = (w?.crowns as number | undefined) ?? 0;
    const updated = await tx.proWallet.update({
      where: { userId },
      data: { crowns: current + FIRST_TIME_BONUS_AMOUNT },
      select: { crowns: true },
    });
    await tx.proTransaction.create({
      data: {
        walletId: userId,
        type: "REWARD",
        amount: FIRST_TIME_BONUS_AMOUNT,
        ref: FIRST_TIME_BONUS_REF,
      },
    });
    return {
      granted: true as const,
      balance: updated.crowns as number,
      amount: FIRST_TIME_BONUS_AMOUNT,
      nextEligibleAt: null,
    };
  });
  return result;
}

/**
 * Crédite le daily bonus (50 Crowns) si la dernière transaction
 * DAILY date d'il y a > 24h. Renvoie `granted=false` + `nextEligibleAt`
 * sinon (UI peut afficher un compte à rebours).
 *
 * BUG fix audit round 4 : avant, le check de la fenetre DAILY etait
 * fait HORS transaction → deux appels concurrents pouvaient tous deux
 * passer la verif et crediter deux fois (race condition). Fix : tout
 * le check + credit dans une seule $transaction, en se basant sur la
 * derniere transaction DAILY lue DANS la transaction (lecture
 * sequentielle par Prisma → coherente).
 */
export async function claimDailyBonus(
  userId: string,
  now: Date = new Date(),
): Promise<RewardOutcome> {
  await getOrCreateWallet(userId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx: any) => {
    const lastDaily = await tx.proTransaction.findFirst({
      where: { walletId: userId, type: "DAILY" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastDaily) {
      const lastAt = (lastDaily.createdAt as Date).getTime();
      const windowEnd = lastAt + DAILY_BONUS_WINDOW_MS;
      if (now.getTime() < windowEnd) {
        const w = await tx.proWallet.findUnique({
          where: { userId },
          select: { crowns: true },
        });
        return {
          granted: false as const,
          balance: (w?.crowns as number | undefined) ?? 0,
          amount: 0,
          nextEligibleAt: new Date(windowEnd).toISOString(),
        };
      }
    }

    // Credit dans la meme transaction. La lecture suivante est garantie
    // de voir nos writes intermediaires (snapshot isolation).
    const w = await tx.proWallet.findUnique({
      where: { userId },
      select: { crowns: true },
    });
    const current = (w?.crowns as number | undefined) ?? 0;
    const updated = await tx.proWallet.update({
      where: { userId },
      data: { crowns: current + DAILY_BONUS_AMOUNT },
      select: { crowns: true },
    });
    await tx.proTransaction.create({
      data: {
        walletId: userId,
        type: "DAILY",
        amount: DAILY_BONUS_AMOUNT,
        ref: null,
      },
    });
    return {
      granted: true as const,
      balance: updated.crowns as number,
      amount: DAILY_BONUS_AMOUNT,
      nextEligibleAt: new Date(
        now.getTime() + DAILY_BONUS_WINDOW_MS,
      ).toISOString(),
    };
  });
  return result;
}

/**
 * Indique si l'user peut réclamer le daily bonus à `now`. Si non,
 * renvoie le timestamp où il pourra à nouveau.
 */
export async function getDailyBonusStatus(
  userId: string,
  now: Date = new Date(),
): Promise<{ available: boolean; nextEligibleAt: string | null }> {
  const lastDaily = await prisma.proTransaction.findFirst({
    where: { walletId: userId, type: "DAILY" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastDaily) {
    return { available: true, nextEligibleAt: null };
  }
  const lastAt = (lastDaily.createdAt as Date).getTime();
  const windowEnd = lastAt + DAILY_BONUS_WINDOW_MS;
  if (now.getTime() >= windowEnd) {
    return { available: true, nextEligibleAt: null };
  }
  return {
    available: false,
    nextEligibleAt: new Date(windowEnd).toISOString(),
  };
}

async function getCurrentBalance(userId: string): Promise<number> {
  const w = await prisma.proWallet.findUnique({
    where: { userId },
    select: { crowns: true },
  });
  return ((w?.crowns as number | undefined) ?? 0) as number;
}
