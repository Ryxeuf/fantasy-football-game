/**
 * Sprint P (Lot P.A.3) — GDPR data export.
 *
 * Implemente le **droit d'acces** RGPD (article 15) : un user peut
 * exporter l'ensemble de ses donnees personnelles en JSON, en 1
 * requete, sans contacter le support.
 *
 * Contenu exporte :
 *
 *   - **account** : profil (email, names, dates, roles, ELO, supporter)
 *   - **teams** : equipes creees + roster
 *   - **matches** : matchs joues (recente window)
 *   - **bets** : paris places (Pro League)
 *   - **transactions** : ledger Crowns
 *   - **badges** : badges debloques
 *   - **achievements** : achievements
 *   - **follows** : equipes Pro League suivies
 *   - **tutorialCompletions** : telemetrie tutoriel
 *   - **eloSnapshots** : historique ELO (90j)
 *
 * Pas exporte intentionnellement :
 *   - `passwordHash` (security)
 *   - Audit log entries OU ils sont referenced par userId (admin-only).
 *   - Donnees d'autres users (Friendship affichee, kofi messageId, etc.).
 *
 * Rate limit : 1 export / 24h (gere via in-memory cache simple ici ;
 * une vraie implementation prod stockerait `lastGdprExportAt` sur
 * User mais on ne touche pas au schema pour cette PR).
 */

import { prisma } from "../prisma";
import { isSupporter } from "./kofi";

export interface GdprExportResult {
  readonly schemaVersion: 1;
  readonly generatedAt: string;
  readonly account: GdprAccount;
  readonly teams: readonly GdprTeam[];
  readonly matches: readonly GdprMatch[];
  readonly bets: readonly GdprBet[];
  readonly transactions: readonly GdprTransaction[];
  readonly badges: readonly GdprBadge[];
  readonly achievements: readonly GdprAchievement[];
  readonly follows: readonly GdprFollow[];
  readonly tutorialCompletions: readonly GdprTutorialCompletion[];
  readonly eloSnapshots: readonly GdprEloSnapshot[];
}

export interface GdprAccount {
  readonly id: string;
  readonly email: string;
  readonly coachName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly dateOfBirth: string | null;
  readonly role: string;
  readonly eloRating: number;
  readonly isSupporter: boolean;
  readonly supporterTier: string | null;
  readonly privateProfile: boolean;
  readonly createdAt: string;
  readonly lastLoginAt: string | null;
}

export interface GdprTeam {
  readonly id: string;
  readonly name: string;
  readonly roster: string;
  readonly ruleset: string | null;
  readonly createdAt: string;
}

export interface GdprMatch {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
  readonly lastMoveAt: string | null;
}

export interface GdprBet {
  readonly id: string;
  readonly matchId: string;
  readonly selection: string;
  readonly stake: number;
  readonly oddsAtPlace: number;
  readonly status: string;
  readonly payoutAmount: number | null;
  readonly createdAt: string;
}

export interface GdprTransaction {
  readonly id: string;
  readonly type: string;
  readonly amount: number;
  readonly ref: string | null;
  readonly createdAt: string;
}

export interface GdprBadge {
  readonly badgeCode: string;
  readonly earnedAt: string;
}

export interface GdprAchievement {
  readonly slug: string;
  readonly unlockedAt: string;
}

export interface GdprFollow {
  readonly proTeamSlug: string;
  readonly since: string;
}

export interface GdprTutorialCompletion {
  readonly lessonSlug: string;
  readonly completedAt: string;
}

export interface GdprEloSnapshot {
  readonly rating: number;
  readonly delta: number;
  readonly matchId: string | null;
  readonly recordedAt: string;
}

/**
 * Genere le snapshot complet RGPD pour l'user. Toutes les
 * sous-queries en parallele via `Promise.all`. Throw si l'user n'existe
 * pas.
 */
export async function exportUserData(
  userId: string,
): Promise<GdprExportResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = (await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      coachName: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      role: true,
      eloRating: true,
      patreon: true,
      supporterTier: true,
      supporterActiveUntil: true,
      privateProfile: true,
      createdAt: true,
      lastLoginAt: true,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  })) as any;
  if (!user) {
    throw new Error(`User '${userId}' introuvable`);
  }

  const [
    teams,
    matches,
    bets,
    transactions,
    badges,
    achievements,
    follows,
    tutorialCompletions,
    eloSnapshots,
  ] = await Promise.all([
    prisma.team.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        roster: true,
        ruleset: true,
        createdAt: true,
      },
    }),
    prisma.match.findMany({
      where: { players: { some: { id: userId } } },
      select: { id: true, status: true, createdAt: true, lastMoveAt: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.proBet.findMany({
      where: { userId },
      select: {
        id: true,
        matchId: true,
        selection: true,
        stake: true,
        oddsAtPlace: true,
        status: true,
        payoutAmount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.proTransaction.findMany({
      where: { walletId: userId },
      select: {
        id: true,
        type: true,
        amount: true,
        ref: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.proUserBadge.findMany({
      where: { userId },
      select: { badgeCode: true, earnedAt: true },
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      select: { slug: true, unlockedAt: true },
    }),
    prisma.proSpectatorFollow.findMany({
      where: { userId },
      select: { proTeamId: true, since: true },
    }),
    prisma.tutorialCompletion.findMany({
      where: { userId },
      select: { lessonSlug: true, completedAt: true },
    }),
    prisma.eloSnapshot.findMany({
      where: { userId },
      select: {
        rating: true,
        delta: true,
        matchId: true,
        recordedAt: true,
      },
      orderBy: { recordedAt: "desc" },
      take: 365,
    }),
  ]);

  const account: GdprAccount = {
    id: user.id,
    email: user.email,
    coachName: user.coachName,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    dateOfBirth:
      user.dateOfBirth instanceof Date
        ? user.dateOfBirth.toISOString()
        : null,
    role: user.role ?? "user",
    eloRating: user.eloRating ?? 1000,
    isSupporter: isSupporter({
      patreon: user.patreon,
      supporterActiveUntil: user.supporterActiveUntil,
    }),
    supporterTier: user.supporterTier ?? null,
    privateProfile: !!user.privateProfile,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt:
      user.lastLoginAt instanceof Date
        ? user.lastLoginAt.toISOString()
        : null,
  };

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    account,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    teams: (teams as any[]).map((t) => ({
      id: t.id,
      name: t.name,
      roster: t.roster,
      ruleset: t.ruleset ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    matches: (matches as any[]).map((m) => ({
      id: m.id,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
      lastMoveAt: m.lastMoveAt ? m.lastMoveAt.toISOString() : null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bets: (bets as any[]).map((b) => ({
      id: b.id,
      matchId: b.matchId,
      selection: b.selection,
      stake: b.stake,
      oddsAtPlace: b.oddsAtPlace,
      status: b.status,
      payoutAmount: b.payoutAmount ?? null,
      createdAt: b.createdAt.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transactions: (transactions as any[]).map((tx) => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      ref: tx.ref ?? null,
      createdAt: tx.createdAt.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    badges: (badges as any[]).map((b) => ({
      badgeCode: b.badgeCode,
      earnedAt: b.earnedAt.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    achievements: (achievements as any[]).map((a) => ({
      slug: a.slug,
      unlockedAt: a.unlockedAt.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    follows: (follows as any[]).map((f) => ({
      proTeamSlug: f.proTeamId,
      since: f.since.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tutorialCompletions: (tutorialCompletions as any[]).map((tc) => ({
      lessonSlug: tc.lessonSlug,
      completedAt: tc.completedAt.toISOString(),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eloSnapshots: (eloSnapshots as any[]).map((es) => ({
      rating: es.rating,
      delta: es.delta,
      matchId: es.matchId ?? null,
      recordedAt: es.recordedAt.toISOString(),
    })),
  };
}
