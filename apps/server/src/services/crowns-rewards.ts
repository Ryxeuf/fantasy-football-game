/**
 * Rattrapage des récompenses en Couronnes (change `crowns-earning`).
 *
 * Appelé par `GET /crowns/me` AVANT de servir le solde : calcule ce qui est
 * dû au coach (côtés de feuilles validées, succès, bonus de bienvenue), retire
 * ce qui figure déjà au registre `CrownsReward`, et verse le reste dans UNE
 * transaction — une opération `REWARD` (réf. `rewards:<id>`) pour tout le
 * passage, une ligne de registre par récompense, l'incrément du wallet.
 *
 * Pourquoi à la LECTURE plutôt qu'à la validation d'une feuille (design D1) :
 * un seul chemin pour l'historique, les succès débloqués ailleurs et le
 * présent ; aucune dépendance vers le service de feuille de match ni vers la
 * chaîne des résultats ; et le flag `crowns` (porté par la route) suffit à
 * tout fermer.
 *
 * Idempotence : `CrownsReward.sourceKey` est UNIQUE. Deux passages
 * simultanés écrivent les mêmes clés : le second lève P2002, sa transaction
 * est annulée en entier et il ne verse rien. Les lignes à 0 (plafonnée, bonus
 * déjà perçu en Pro League) sont écrites aussi, pour n'être jamais retentées.
 *
 * Les règles (barème, clés, plafond) vivent dans `crowns-rewards-rules` (pur).
 */

import { randomUUID } from "node:crypto";
import { prisma } from "../prisma";
import { serverLog } from "../utils/server-log";
import { ACHIEVEMENTS_CATALOG } from "./achievements";
import { getOrCreateWallet } from "./pro-wallet";
import { FIRST_TIME_BONUS_REF } from "./pro-wallet-rewards";
import {
  REWARDS_TX_REF_PREFIX,
  achievementRewardKey,
  cupPeriodKey,
  eligibleSheetSides,
  planCrownsRewards,
  seasonPeriodKey,
  sheetRewardKey,
  signupRewardKey,
  summarizeCrownsRewards,
  type AchievementRewardCandidate,
  type CrownsRewardBreakdown,
  type CrownsRewardCandidate,
  type SheetRewardCandidate,
} from "./crowns-rewards-rules";

/** Délai minimal entre deux passages pour un même coach (design D8). */
export function crownsRewardsDebounceMs(): number {
  return process.env.NODE_ENV === "production" ? 60_000 : 0;
}

const lastPassAt = new Map<string, number>();

/** Tests uniquement : oublie les passages récents. */
export function resetCrownsRewardsDebounce(): void {
  lastPassAt.clear();
}

export interface CrownsRewardsPassOutcome {
  /** Couronnes versées par ce passage. */
  readonly credited: number;
  /** Lignes écrites au registre (y compris celles à 0). */
  readonly written: number;
  /** Vrai si un passage concurrent a déjà écrit ces récompenses. */
  readonly conflict: boolean;
  /** Vrai si le passage a été sauté (débounce). */
  readonly skipped: boolean;
}

const NOTHING: CrownsRewardsPassOutcome = {
  credited: 0,
  written: 0,
  conflict: false,
  skipped: false,
};

interface SheetRow {
  readonly id: string;
  readonly validatedAt: Date | null;
  readonly pairing: {
    readonly round: { readonly seasonId: string };
    readonly homeParticipant: { readonly team: { readonly ownerId: string } };
    readonly awayParticipant: { readonly team: { readonly ownerId: string } };
  } | null;
  readonly cupPairing: {
    readonly round: { readonly cupId: string };
    readonly homeTeam: { readonly ownerId: string };
    readonly awayTeam: { readonly ownerId: string } | null;
  } | null;
}

/**
 * Côtés de feuilles VALIDÉES (ligue ou coupe) qui rapportent au coach : il
 * possède l'équipe de ce côté et l'autre côté appartient à un autre compte.
 * Le statut fait foi : `validatedAt` reste renseigné après une invalidation.
 */
export async function loadSheetRewardCandidates(
  userId: string,
): Promise<SheetRewardCandidate[]> {
  const rows: SheetRow[] = await prisma.leagueMatchSheet.findMany({
    where: {
      status: "validated",
      OR: [
        { pairing: { homeParticipant: { team: { ownerId: userId } } } },
        { pairing: { awayParticipant: { team: { ownerId: userId } } } },
        { cupPairing: { homeTeam: { ownerId: userId } } },
        { cupPairing: { awayTeam: { ownerId: userId } } },
      ],
    },
    select: {
      id: true,
      validatedAt: true,
      pairing: {
        select: {
          round: { select: { seasonId: true } },
          homeParticipant: { select: { team: { select: { ownerId: true } } } },
          awayParticipant: { select: { team: { select: { ownerId: true } } } },
        },
      },
      cupPairing: {
        select: {
          round: { select: { cupId: true } },
          homeTeam: { select: { ownerId: true } },
          awayTeam: { select: { ownerId: true } },
        },
      },
    },
  });

  const candidates: SheetRewardCandidate[] = [];
  for (const row of rows) {
    let periodKey: string;
    let homeOwnerId: string | null;
    let awayOwnerId: string | null;
    if (row.pairing) {
      periodKey = seasonPeriodKey(row.pairing.round.seasonId);
      homeOwnerId = row.pairing.homeParticipant.team.ownerId;
      awayOwnerId = row.pairing.awayParticipant.team.ownerId;
    } else if (row.cupPairing) {
      periodKey = cupPeriodKey(row.cupPairing.round.cupId);
      homeOwnerId = row.cupPairing.homeTeam.ownerId;
      awayOwnerId = row.cupPairing.awayTeam?.ownerId ?? null;
    } else {
      continue;
    }
    for (const side of eligibleSheetSides(userId, homeOwnerId, awayOwnerId)) {
      candidates.push({
        kind: "sheet",
        sourceKey: sheetRewardKey(row.id, side),
        periodKey,
        sheetId: row.id,
        validatedAt: row.validatedAt ?? new Date(0),
      });
    }
  }
  return candidates;
}

const CATALOGUE_SLUGS = new Set(ACHIEVEMENTS_CATALOG.map((a) => a.slug));

/** Succès débloqués du coach encore connus du catalogue. */
export async function loadAchievementRewardCandidates(
  userId: string,
): Promise<AchievementRewardCandidate[]> {
  const rows: Array<{ slug: string }> = await prisma.userAchievement.findMany({
    where: { userId },
    select: { slug: true },
  });
  return rows
    .filter((r) => CATALOGUE_SLUGS.has(r.slug))
    .map((r) => ({
      kind: "achievement" as const,
      sourceKey: achievementRewardKey(userId, r.slug),
    }));
}

/** Vrai si le coach a déjà touché le bonus de bienvenue de la Pro League. */
export async function hasProLeagueSignupBonus(userId: string): Promise<boolean> {
  const tx = await prisma.proTransaction.findFirst({
    where: { walletId: userId, type: "REWARD", ref: FIRST_TIME_BONUS_REF },
    select: { id: true },
  });
  return tx !== null;
}

/** Erreur Prisma de contrainte unique (P2002). */
function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/**
 * Un passage de rattrapage pour `userId`. Ne lève que sur une erreur
 * inattendue : l'appelant (la route) l'enveloppe, la lecture du solde ne doit
 * jamais en dépendre.
 */
export async function reconcileCrownsRewards(
  userId: string,
  now: number = Date.now(),
): Promise<CrownsRewardsPassOutcome> {
  const debounce = crownsRewardsDebounceMs();
  const last = lastPassAt.get(userId);
  if (debounce > 0 && last !== undefined && now - last < debounce) {
    return { ...NOTHING, skipped: true };
  }
  lastPassAt.set(userId, now);

  const [sheets, achievements] = await Promise.all([
    loadSheetRewardCandidates(userId),
    loadAchievementRewardCandidates(userId),
  ]);
  const signupKey = signupRewardKey(userId);
  const keys = [
    ...sheets.map((c) => c.sourceKey),
    ...achievements.map((c) => c.sourceKey),
    signupKey,
  ];
  const existing: Array<{ sourceKey: string }> = await prisma.crownsReward.findMany({
    where: { sourceKey: { in: keys } },
    select: { sourceKey: true },
  });
  const done = new Set(existing.map((r) => r.sourceKey));

  const pending: CrownsRewardCandidate[] = [
    ...sheets.filter((c) => !done.has(c.sourceKey)),
    ...achievements.filter((c) => !done.has(c.sourceKey)),
  ];
  if (!done.has(signupKey)) {
    pending.push({
      kind: "signup",
      sourceKey: signupKey,
      alreadyGranted: await hasProLeagueSignupBonus(userId),
    });
  }
  if (pending.length === 0) return NOTHING;

  const periods = [
    ...new Set(
      pending
        .filter((c): c is SheetRewardCandidate => c.kind === "sheet")
        .map((c) => c.periodKey),
    ),
  ];
  const earnedByPeriod = new Map<string, number>();
  if (periods.length > 0) {
    const sums: Array<{ periodKey: string | null; _sum: { amount: number | null } }> =
      await prisma.crownsReward.groupBy({
        by: ["periodKey"],
        where: { userId, periodKey: { in: periods } },
        _sum: { amount: true },
      });
    for (const s of sums) {
      if (s.periodKey) earnedByPeriod.set(s.periodKey, s._sum.amount ?? 0);
    }
  }

  const plan = planCrownsRewards(pending, earnedByPeriod);

  await getOrCreateWallet(userId);
  try {
    await prisma.$transaction(async (tx: typeof prisma) => {
      let transactionId: string | null = null;
      if (plan.total > 0) {
        const op = await tx.proTransaction.create({
          data: {
            walletId: userId,
            type: "REWARD",
            amount: plan.total,
            ref: `${REWARDS_TX_REF_PREFIX}${randomUUID()}`,
          },
          select: { id: true },
        });
        transactionId = op.id;
      }
      for (const r of plan.rewards) {
        await tx.crownsReward.create({
          data: {
            sourceKey: r.sourceKey,
            userId,
            kind: r.kind,
            periodKey: r.periodKey,
            amount: r.amount,
            baseAmount: r.baseAmount,
            // Toutes les lignes du passage, plafonnées comprises : le détail
            // servi au journal les compte (`summarizeCrownsRewards`).
            transactionId,
          },
        });
      }
      if (plan.total > 0) {
        await tx.proWallet.update({
          where: { userId },
          data: { crowns: { increment: plan.total } },
        });
      }
    });
  } catch (e: unknown) {
    if (isUniqueViolation(e)) {
      serverLog.info(`[crowns-rewards] passage concurrent pour user=${userId}, annulé`);
      return { ...NOTHING, conflict: true };
    }
    throw e;
  }

  if (plan.total > 0) {
    serverLog.info(
      `[crowns-rewards] user=${userId} +${plan.total} (${plan.rewards.length} ligne(s))`,
    );
  }
  return {
    credited: plan.total,
    written: plan.rewards.length,
    conflict: false,
    skipped: false,
  };
}

/**
 * Détail des passages de rattrapage parmi des opérations du journal : pour
 * chaque opération `REWARD` réf. `rewards:<id>`, ce qu'elle contient (feuilles,
 * succès, bonus, plafonnées). Une seule requête sur le registre.
 */
export async function loadRewardBreakdowns(
  transactions: ReadonlyArray<{ id: string; type: string; ref: string | null }>,
): Promise<Map<string, CrownsRewardBreakdown>> {
  const ids = transactions
    .filter((t) => t.type === "REWARD" && t.ref?.startsWith(REWARDS_TX_REF_PREFIX))
    .map((t) => t.id);
  const breakdowns = new Map<string, CrownsRewardBreakdown>();
  if (ids.length === 0) return breakdowns;
  const rows: Array<{
    transactionId: string | null;
    kind: string;
    amount: number;
    baseAmount: number;
  }> = await prisma.crownsReward.findMany({
    where: { transactionId: { in: ids } },
    select: { transactionId: true, kind: true, amount: true, baseAmount: true },
  });
  const byTx = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.transactionId) continue;
    byTx.set(row.transactionId, [...(byTx.get(row.transactionId) ?? []), row]);
  }
  for (const [id, group] of byTx) breakdowns.set(id, summarizeCrownsRewards(group));
  return breakdowns;
}

/** Nombre de récompenses servies à l'écran admin d'un coach. */
export const ADMIN_CROWNS_REWARDS_LIMIT = 50;

export interface AdminCrownsRewardRow {
  readonly id: string;
  readonly sourceKey: string;
  readonly kind: string;
  readonly periodKey: string | null;
  readonly amount: number;
  readonly baseAmount: number;
  readonly createdAt: string;
}

/**
 * Registre des récompenses d'un coach, plus récentes d'abord (écran admin
 * des cosmétiques). `null` si le coach n'existe pas.
 */
export async function listCrownsRewardsForAdmin(
  userId: string,
): Promise<AdminCrownsRewardRow[] | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return null;
  const rows: Array<{
    id: string;
    sourceKey: string;
    kind: string;
    periodKey: string | null;
    amount: number;
    baseAmount: number;
    createdAt: Date;
  }> = await prisma.crownsReward.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: ADMIN_CROWNS_REWARDS_LIMIT,
    select: {
      id: true,
      sourceKey: true,
      kind: true,
      periodKey: true,
      amount: true,
      baseAmount: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
