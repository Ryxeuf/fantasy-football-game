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
 */
export async function grantFirstTimeBonus(
  userId: string,
): Promise<RewardOutcome> {
  // Garantit l'existence du wallet (création silencieuse).
  await getOrCreateWallet(userId);

  // Idempotence : check ProTransaction REWARD + ref="first_signup".
  const existing = await prisma.proTransaction.findFirst({
    where: {
      walletId: userId,
      type: "REWARD",
      ref: FIRST_TIME_BONUS_REF,
    },
    select: { id: true },
  });
  if (existing) {
    const balance = await getCurrentBalance(userId);
    return {
      granted: false,
      balance,
      amount: 0,
      nextEligibleAt: null,
    };
  }

  const balance = await credit(
    userId,
    FIRST_TIME_BONUS_AMOUNT,
    "REWARD",
    FIRST_TIME_BONUS_REF,
  );
  return {
    granted: true,
    balance,
    amount: FIRST_TIME_BONUS_AMOUNT,
    nextEligibleAt: null,
  };
}

/**
 * Crédite le daily bonus (50 Crowns) si la dernière transaction
 * DAILY date d'il y a > 24h. Renvoie `granted=false` + `nextEligibleAt`
 * sinon (UI peut afficher un compte à rebours).
 */
export async function claimDailyBonus(
  userId: string,
  now: Date = new Date(),
): Promise<RewardOutcome> {
  await getOrCreateWallet(userId);

  const lastDaily = await prisma.proTransaction.findFirst({
    where: { walletId: userId, type: "DAILY" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (lastDaily) {
    const lastAt = (lastDaily.createdAt as Date).getTime();
    const windowEnd = lastAt + DAILY_BONUS_WINDOW_MS;
    if (now.getTime() < windowEnd) {
      const balance = await getCurrentBalance(userId);
      return {
        granted: false,
        balance,
        amount: 0,
        nextEligibleAt: new Date(windowEnd).toISOString(),
      };
    }
  }

  const balance = await credit(userId, DAILY_BONUS_AMOUNT, "DAILY");
  return {
    granted: true,
    balance,
    amount: DAILY_BONUS_AMOUNT,
    nextEligibleAt: new Date(now.getTime() + DAILY_BONUS_WINDOW_MS).toISOString(),
  };
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
