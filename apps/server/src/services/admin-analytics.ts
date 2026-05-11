/**
 * Sprint P (Lot P.C.3) — Dashboard analytics admin.
 *
 * Agrege les metriques business minimales pour piloter le scaling :
 *
 *   - **DAU** (Daily Active Users) : users avec lastLoginAt sur les
 *     dernieres 24h. Approximation : on assume que login = activite
 *     minimale ; les sessions persistantes ne tracent pas chaque
 *     interaction, donc DAU ≈ lower bound.
 *   - **MAU** (Monthly Active Users) : 30 jours rolling.
 *   - **Signup funnel** : signups N derniers jours, taux de "premiere
 *     equipe creee", taux de "premier match joue".
 *   - **Crowns inflation** : sum(credits) - sum(debits) sur N jours,
 *     plus le total supply courant (sum(ProWallet.crowns)).
 *
 * Pas de cache : les requetes sont count/groupBy, optimisees par
 * index. A 10k users on est sub-100ms. Si plus, cache 1min suffit.
 */

import { prisma } from "../prisma";

export interface AnalyticsSnapshot {
  /** Genere le snapshot a `now` (ISO). */
  readonly computedAt: string;
  readonly dau: {
    /** Last 24h. */
    readonly count: number;
    /** Previous 24h (24h-48h ago) — pour calculer le delta jour-jour. */
    readonly prevCount: number;
    readonly deltaPct: number;
  };
  readonly mau: {
    /** Last 30 days rolling. */
    readonly count: number;
    /** Previous 30 days (30-60j) — delta mois sur mois. */
    readonly prevCount: number;
    readonly deltaPct: number;
  };
  readonly signupFunnel: {
    /** Signups dans la fenetre. */
    readonly signups: number;
    /** Window en jours (par defaut 30). */
    readonly windowDays: number;
    /** Signups qui ont cree au moins 1 equipe. */
    readonly withTeam: number;
    /** Signups qui ont joue au moins 1 match. */
    readonly withMatch: number;
    /** Conversion signup → equipe (%). */
    readonly conversionTeam: number;
    /** Conversion signup → first match (%). */
    readonly conversionFirstMatch: number;
  };
  readonly crowns: {
    /** Window en jours (par defaut 30). */
    readonly windowDays: number;
    /** Total credit emis (REWARD + DAILY + WIN + BADGE) sur la fenetre. */
    readonly totalIn: number;
    /** Total debits / sinks (BET + SINK) sur la fenetre. */
    readonly totalOut: number;
    /** Net = in - out. Positif = inflation. */
    readonly netInflation: number;
    /** Supply totale courante (sum ProWallet.crowns). */
    readonly currentSupply: number;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function deltaPct(current: number, prev: number): number {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 1000) / 10;
}

/**
 * Renvoie le snapshot complet. Toutes les sous-queries tournent en
 * parallele via `Promise.all` — typiquement 5 round-trips DB.
 */
export async function getAnalyticsSnapshot(
  now: Date = new Date(),
): Promise<AnalyticsSnapshot> {
  const tsNow = now.getTime();
  const t24 = new Date(tsNow - DAY_MS);
  const t48 = new Date(tsNow - 2 * DAY_MS);
  const t30d = new Date(tsNow - 30 * DAY_MS);
  const t60d = new Date(tsNow - 60 * DAY_MS);

  const [
    dauCount,
    dauPrev,
    mauCount,
    mauPrev,
    signups,
    signupsWithTeam,
    signupsWithMatch,
    crownsCredits,
    crownsDebits,
    walletSupply,
  ] = await Promise.all([
    // DAU : last 24h
    prisma.user.count({
      where: { lastLoginAt: { gte: t24, lte: now } },
    }),
    // DAU prev : 24h-48h ago
    prisma.user.count({
      where: { lastLoginAt: { gte: t48, lt: t24 } },
    }),
    // MAU : last 30d
    prisma.user.count({
      where: { lastLoginAt: { gte: t30d, lte: now } },
    }),
    // MAU prev : 30-60j ago
    prisma.user.count({
      where: { lastLoginAt: { gte: t60d, lt: t30d } },
    }),
    // Signups 30j
    prisma.user.count({
      where: { createdAt: { gte: t30d, lte: now } },
    }),
    // Signups 30j qui ont cree au moins 1 equipe
    prisma.user.count({
      where: {
        createdAt: { gte: t30d, lte: now },
        teams: { some: {} },
      },
    }),
    // Signups 30j qui ont joue au moins 1 match
    prisma.user.count({
      where: {
        createdAt: { gte: t30d, lte: now },
        matches: { some: {} },
      },
    }),
    // Crowns IN 30j (credits = amount > 0)
    prisma.proTransaction.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: t30d, lte: now }, amount: { gt: 0 } },
    }),
    // Crowns OUT 30j (debits = amount < 0)
    prisma.proTransaction.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: t30d, lte: now }, amount: { lt: 0 } },
    }),
    // Supply totale courante
    prisma.proWallet.aggregate({
      _sum: { crowns: true },
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const credits = (crownsCredits as any)?._sum?.amount ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debits = (crownsDebits as any)?._sum?.amount ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supply = (walletSupply as any)?._sum?.crowns ?? 0;

  // debits est deja signe negatif → totalOut = abs(debits).
  const totalIn = credits as number;
  const totalOut = Math.abs(debits as number);
  const netInflation = totalIn - totalOut;

  return {
    computedAt: now.toISOString(),
    dau: {
      count: dauCount,
      prevCount: dauPrev,
      deltaPct: deltaPct(dauCount, dauPrev),
    },
    mau: {
      count: mauCount,
      prevCount: mauPrev,
      deltaPct: deltaPct(mauCount, mauPrev),
    },
    signupFunnel: {
      signups,
      windowDays: 30,
      withTeam: signupsWithTeam,
      withMatch: signupsWithMatch,
      conversionTeam: signups === 0 ? 0 : Math.round((signupsWithTeam / signups) * 1000) / 10,
      conversionFirstMatch:
        signups === 0 ? 0 : Math.round((signupsWithMatch / signups) * 1000) / 10,
    },
    crowns: {
      windowDays: 30,
      totalIn,
      totalOut,
      netInflation,
      currentSupply: supply as number,
    },
  };
}
